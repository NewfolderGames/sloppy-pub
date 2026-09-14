import test, { describe } from "node:test";
import assert from "node:assert/strict";
import type { FsmBlueprint, GaugeBlueprint, SemanticBlueprints, WorldStates } from "../types.ts";
import {
	clampGaugeDelta,
	detectTierCrossings,
	evaluateFsmGuard,
	evaluateFsmTransition,
	extractActiveDirectives,
	getTierForValue,
	SemanticValidationEngine,
} from "./validation_engine.ts";

const sampleGauge: GaugeBlueprint = {
	key: "sanity",
	min: 0,
	max: 100,
	defaultValue: 80,
	maxDeltaPerTurn: 20,
	tiers: [
		{
			id: "hysterical",
			label: "Hysterical",
			min: 0,
			max: 29,
			directive: "Behave erratically and whisper to shadows.",
			onEnter: [{ type: "set", key: "affliction.hallucinating", value: true }],
			onExit: [{ type: "delete", key: "affliction.hallucinating" }],
		},
		{
			id: "unsettled",
			label: "Unsettled",
			min: 30,
			max: 69,
			directive: "Notice creeping darkness and hesitate frequently.",
		},
		{
			id: "lucid",
			label: "Lucid",
			min: 70,
			max: 100,
			directive: "Think clearly and maintain logical speech.",
		},
	],
};

const sampleFsm: FsmBlueprint = {
	key: "investigation_phase",
	initialState: "briefing",
	states: {
		briefing: { directive: "Review the documents before proceeding." },
		exploration: { directive: "Explore rooms and gather forensic clues." },
		climax: { directive: "Face the ancient entity in the cellar." },
		escaped: { directive: "Flee to safety." },
	},
	transitions: [
		{
			from: "briefing",
			to: "exploration",
			guard: { requiredFlags: ["briefing_reviewed"] },
		},
		{
			from: "exploration",
			to: "climax",
			guard: {
				gaugeKey: "sanity",
				maxGauge: 40,
				requiredItems: ["crypt_key"],
			},
		},
		{
			from: "climax",
			to: "escaped",
		},
	],
};

const sampleBlueprints: SemanticBlueprints = {
	gauges: [sampleGauge],
	stateMachines: [sampleFsm],
	flags: ["briefing_reviewed"],
	inventories: [{ key: "backpack", items: ["crypt_key"] }],
};

describe("SemanticValidationEngine - Gauge Clamping", () => {
	test("permits delta within per-turn limit", () => {
		const current = 80;
		const target = 95; // delta +15 <= 20
		const result = clampGaugeDelta(current, target, sampleGauge);

		assert.equal(result, 95);
	});

	test("clamps positive delta exceeding per-turn limit", () => {
		const current = 50;
		const target = 90; // delta +40 > 20
		const result = clampGaugeDelta(current, target, sampleGauge);

		assert.equal(result, 70);
	});

	test("clamps negative delta exceeding per-turn limit", () => {
		const current = 80;
		const target = 30; // delta -50, clamped to -20
		const result = clampGaugeDelta(current, target, sampleGauge);

		assert.equal(result, 60);
	});

	test("enforces minimum gauge boundary", () => {
		const current = 10;
		const target = -25;
		const result = clampGaugeDelta(current, target, sampleGauge);

		assert.equal(result, 0);
	});

	test("enforces maximum gauge boundary", () => {
		const current = 95;
		const target = 110;
		const result = clampGaugeDelta(current, target, sampleGauge);

		assert.equal(result, 100);
	});

	test("clamps only to min/max when maxDeltaPerTurn is omitted", () => {
		const unboundedGauge: GaugeBlueprint = {
			key: "heat",
			min: 0,
			max: 100,
			defaultValue: 50,
			tiers: sampleGauge.tiers,
		};

		assert.equal(clampGaugeDelta(50, 95, unboundedGauge), 95);
		assert.equal(clampGaugeDelta(50, 150, unboundedGauge), 100);
		assert.equal(clampGaugeDelta(50, -50, unboundedGauge), 0);
	});
});

describe("SemanticValidationEngine - Tier Detection and Crossings", () => {
	test("identifies correct tier for gauge value", () => {
		assert.equal(getTierForValue(85, sampleGauge)?.id, "lucid");
		assert.equal(getTierForValue(70, sampleGauge)?.id, "lucid");
		assert.equal(getTierForValue(50, sampleGauge)?.id, "unsettled");
		assert.equal(getTierForValue(29, sampleGauge)?.id, "hysterical");
		assert.equal(getTierForValue(0, sampleGauge)?.id, "hysterical");
	});

	test("returns no crossing when staying within same tier", () => {
		const crossing = detectTierCrossings(85, 75, sampleGauge);

		assert.deepEqual(crossing.exitedTiers, []);
		assert.deepEqual(crossing.enteredTiers, []);
		assert.deepEqual(crossing.operations, []);
	});

	test("detects crossing across tier boundary with transition actions", () => {
		// Drop from unsettled (30) to hysterical (25)
		const crossing = detectTierCrossings(30, 25, sampleGauge);

		assert.equal(crossing.exitedTiers.length, 1);
		assert.equal(crossing.exitedTiers[0].id, "unsettled");
		assert.equal(crossing.enteredTiers.length, 1);
		assert.equal(crossing.enteredTiers[0].id, "hysterical");

		assert.deepEqual(crossing.operations, [
			{ type: "set", key: "affliction.hallucinating", value: true },
		]);
	});

	test("detects recovery out of hysterical tier triggers onExit action", () => {
		// Rise from hysterical (20) to unsettled (40)
		const crossing = detectTierCrossings(20, 40, sampleGauge);

		assert.equal(crossing.exitedTiers.length, 1);
		assert.equal(crossing.exitedTiers[0].id, "hysterical");
		assert.equal(crossing.enteredTiers.length, 1);
		assert.equal(crossing.enteredTiers[0].id, "unsettled");

		assert.deepEqual(crossing.operations, [
			{ type: "delete", key: "affliction.hallucinating" },
		]);
	});
});

describe("SemanticValidationEngine - FSM Transition Guards", () => {
	test("evaluates guard with required flags", () => {
		const statesWithoutFlag: WorldStates = {};
		const resultFail = evaluateFsmGuard(
			{ requiredFlags: ["briefing_reviewed"] },
			statesWithoutFlag,
		);
		assert.equal(resultFail.satisfied, false);

		const statesWithFlag: WorldStates = { briefing_reviewed: true };
		const resultPass = evaluateFsmGuard(
			{ requiredFlags: ["briefing_reviewed"] },
			statesWithFlag,
		);
		assert.equal(resultPass.satisfied, true);
	});

	test("evaluates guard with flags array in state", () => {
		const states: WorldStates = { flags: ["briefing_reviewed", "torch_lit"] };
		const result = evaluateFsmGuard(
			{ requiredFlags: ["briefing_reviewed"] },
			states,
		);
		assert.equal(result.satisfied, true);
	});

	test("evaluates guard with required items and gauge thresholds", () => {
		const statesFailingGauge: WorldStates = {
			sanity: 60,
			backpack: ["crypt_key"],
		};
		const guard = {
			gaugeKey: "sanity",
			maxGauge: 40,
			requiredItems: ["crypt_key"],
		};

		const checkGauge = evaluateFsmGuard(guard, statesFailingGauge, sampleBlueprints);
		assert.equal(checkGauge.satisfied, false);
		assert.ok(checkGauge.reason?.includes("sanity"));

		const statesFailingItem: WorldStates = {
			sanity: 30,
			backpack: ["bandage"],
		};
		const checkItem = evaluateFsmGuard(guard, statesFailingItem, sampleBlueprints);
		assert.equal(checkItem.satisfied, false);
		assert.ok(checkItem.reason?.includes("crypt_key"));

		const statesPassingAll: WorldStates = {
			sanity: 30,
			backpack: ["crypt_key"],
		};
		const checkAll = evaluateFsmGuard(guard, statesPassingAll, sampleBlueprints);
		assert.equal(checkAll.satisfied, true);
	});

	test("evaluates full FSM transitions", () => {
		// Valid transition with satisfied guard
		const validStates: WorldStates = { briefing_reviewed: true };
		const eval1 = evaluateFsmTransition(
			"briefing",
			"exploration",
			sampleFsm,
			validStates,
			sampleBlueprints,
		);
		assert.equal(eval1.allowed, true);

		// Valid transition with failed guard
		const invalidStates: WorldStates = {};
		const eval2 = evaluateFsmTransition(
			"briefing",
			"exploration",
			sampleFsm,
			invalidStates,
			sampleBlueprints,
		);
		assert.equal(eval2.allowed, false);

		// Nonexistent transition path (briefing -> climax)
		const eval3 = evaluateFsmTransition(
			"briefing",
			"climax",
			sampleFsm,
			validStates,
			sampleBlueprints,
		);
		assert.equal(eval3.allowed, false);
		assert.ok(eval3.reason?.includes("No permitted transition"));

		// Target state not in states dictionary
		const eval4 = evaluateFsmTransition(
			"briefing",
			"unknown_phase",
			sampleFsm,
			validStates,
			sampleBlueprints,
		);
		assert.equal(eval4.allowed, false);
		assert.ok(eval4.reason?.includes("not declared"));

		// Self-transition is allowed
		const eval5 = evaluateFsmTransition(
			"briefing",
			"briefing",
			sampleFsm,
			invalidStates,
			sampleBlueprints,
		);
		assert.equal(eval5.allowed, true);
	});
});

describe("SemanticValidationEngine - Directive Extraction", () => {
	test("extracts active directives from gauges and state machines", () => {
		const currentStates: WorldStates = {
			sanity: 80, // Lucid tier
			investigation_phase: "exploration",
		};

		const directives = extractActiveDirectives(sampleBlueprints, currentStates);

		assert.equal(directives.tierDirectives.length, 1);
		assert.equal(directives.tierDirectives[0].gaugeKey, "sanity");
		assert.equal(directives.tierDirectives[0].tierId, "lucid");
		assert.equal(
			directives.tierDirectives[0].directive,
			"Think clearly and maintain logical speech.",
		);

		assert.equal(directives.fsmDirectives.length, 1);
		assert.equal(directives.fsmDirectives[0].fsmKey, "investigation_phase");
		assert.equal(directives.fsmDirectives[0].state, "exploration");
		assert.equal(
			directives.fsmDirectives[0].directive,
			"Explore rooms and gather forensic clues.",
		);

		assert.equal(directives.allDirectives.length, 2);
	});
});

describe("SemanticValidationEngine Class Integration", () => {
	const engine = new SemanticValidationEngine(sampleBlueprints);

	test("validates gauge mutation with delta clamping and tier action dispatch", () => {
		const currentStates: WorldStates = { sanity: 45 };

		// Target 10 is delta -35; clamped by maxDeltaPerTurn (20) to 25 (Hysterical tier)
		const result = engine.validateMutation("sanity", 10, currentStates);

		assert.equal(result.allowed, true);
		assert.ok(result.mutation);
		assert.equal(result.mutation.key, "sanity");
		assert.equal(result.mutation.value, 25);
		assert.equal(result.mutation.previousValue, 45);
		assert.equal(result.mutation.clamped, true);
		assert.deepEqual(result.mutation.transitionOperations, [
			{ type: "set", key: "affliction.hallucinating", value: true },
		]);
	});

	test("rejects invalid non-numeric mutation for gauge", () => {
		const result = engine.validateMutation("sanity", "insane" as unknown as number, {});

		assert.equal(result.allowed, false);
		assert.ok(result.error?.includes("numeric values"));
	});

	test("validates FSM mutation respecting transition guards", () => {
		const statesPassing: WorldStates = {
			investigation_phase: "briefing",
			briefing_reviewed: true,
		};

		const resultPass = engine.validateMutation(
			"investigation_phase",
			"exploration",
			statesPassing,
		);

		assert.equal(resultPass.allowed, true);
		assert.equal(resultPass.mutation?.value, "exploration");

		const statesFailing: WorldStates = {
			investigation_phase: "briefing",
		};

		const resultFail = engine.validateMutation(
			"investigation_phase",
			"exploration",
			statesFailing,
		);

		assert.equal(resultFail.allowed, false);
		assert.ok(resultFail.error?.includes("Transition guard failed"));
	});

	test("passes through baseline state mutations without blueprints", () => {
		const result = engine.validateMutation("untracked_key", "custom_val", {});

		assert.equal(result.allowed, true);
		assert.equal(result.mutation?.value, "custom_val");
		assert.equal(result.mutation?.clamped, false);
	});
});
