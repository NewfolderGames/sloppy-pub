import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageTree } from "../ai/message/tree.ts";
import { MessageTreeManager } from "../ai/message/tree_manager.ts";
import { StateStore } from "./state_store.ts";
import type { FsmBlueprint, GaugeBlueprint, SemanticBlueprints, StateChangeEvent } from "./types.ts";

describe("StateStore Core Operations", () => {

	it("initializes with initial states and retrieves values via dot notation", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"district.power_grid_active": true,
			"player.inventory.gold": 150,
			"factions.allies": ["police", "hackers"],
		});

		assert.equal(store.getState("district.alert_level"), 1);
		assert.equal(store.getState("district.power_grid_active"), true);
		assert.equal(store.getState("player.inventory.gold"), 150);
		assert.deepEqual(store.getState("factions.allies"), ["police", "hackers"]);
		assert.equal(store.getState("nonexistent.key"), undefined);

	});

	it("sets and updates single state variable with type checking", () => {

		const store = new StateStore({
			"district.alert_level": 1,
		});

		const updateResult = store.setState("district.alert_level", 2, "Incident escalated");

		assert.equal(updateResult.previousValue, 1);
		assert.equal(updateResult.newValue, 2);
		assert.equal(store.getState("district.alert_level"), 2);

		// Setting new key that didn't exist before

		const newKeyResult = store.setState("reputation.underworld", 5);
		assert.equal(newKeyResult.previousValue, null);
		assert.equal(newKeyResult.newValue, 5);
		assert.equal(store.getState("reputation.underworld"), 5);

	});

	it("rejects state updates that violate type constraints", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"district.name": "Downtown",
			"district.is_locked": false,
		});

		// Number to string
		assert.throws(
			() => store.setState("district.alert_level", "high"),
			/Type mismatch for key 'district.alert_level'. Expected number, got string./,
		);

		// String to number
		assert.throws(
			() => store.setState("district.name", 42),
			/Type mismatch for key 'district.name'. Expected string, got number./,
		);

		// Boolean to array
		assert.throws(
			() => store.setState("district.is_locked", [true]),
			/Type mismatch for key 'district.is_locked'. Expected boolean, got array./,
		);

	});

	it("rejects invalid key formats", () => {

		const store = new StateStore();

		assert.throws(() => store.setState("", 10), /cannot be empty/);
		assert.throws(() => store.setState("district..alert", 10), /empty segment/);
		assert.throws(() => store.setState(".district.alert", 10), /empty segment/);
		assert.throws(() => store.setState("district alert", 10), /Invalid state key/);

	});

	it("applies atomic batch patch updates or rejects entirely on error", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"district.power_grid_active": true,
		});

		// Successful patch
		const patchResult = store.patchStates({
			"district.alert_level": 3,
			"district.power_grid_active": false,
			"district.curfew": true,
		});

		assert.equal(patchResult.appliedCount, 3);
		assert.equal(store.getState("district.alert_level"), 3);
		assert.equal(store.getState("district.power_grid_active"), false);
		assert.equal(store.getState("district.curfew"), true);

		// Failed patch due to type mismatch: neither update should be applied
		assert.throws(
			() =>
				store.patchStates({
					"district.alert_level": 4,
					"district.curfew": "not a boolean",
				}),
			/Type mismatch for key 'district.curfew'/,
		);

		// Check atomicity: district.alert_level remains 3, not 4
		assert.equal(store.getState("district.alert_level"), 3);
		assert.equal(store.getState("district.curfew"), true);

	});

	it("applies atomic batch mutations via applyOperations with set and delete", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"district.power_grid_active": true,
			"temporary.flag": "active",
		});

		const result = store.applyOperations([
			{ type: "set", key: "district.alert_level", value: 3 },
			{ type: "delete", key: "temporary.flag" },
			{ type: "set", key: "district.curfew", value: true },
		]);

		assert.equal(result.appliedCount, 3);
		assert.equal(store.getState("district.alert_level"), 3);
		assert.equal(store.getState("temporary.flag"), undefined);
		assert.equal(store.getState("district.curfew"), true);

	});

	it("rolls back atomic batch mutations if any operation fails validation", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"temporary.flag": "keep_me",
		});

		assert.throws(
			() =>
				store.applyOperations([
					{ type: "set", key: "district.alert_level", value: 5 },
					{ type: "delete", key: "temporary.flag" },
					{ type: "set", key: "district.alert_level", value: "high" }, // Type mismatch
				]),
			/Type mismatch for key 'district.alert_level'/,
		);

		// Atomicity check: nothing changed
		assert.equal(store.getState("district.alert_level"), 1);
		assert.equal(store.getState("temporary.flag"), "keep_me");

	});

	it("completes state deletion on non-existent key without error", () => {

		const store = new StateStore({
			"player.gold": 100,
		});

		const result = store.applyOperations([
			{ type: "delete", key: "nonexistent.key" },
		]);

		assert.equal(result.appliedCount, 1);
		assert.equal(store.getState("player.gold"), 100);

	});

	it("handles empty operations array returning zero applied count", () => {

		const store = new StateStore({
			"player.gold": 100,
		});

		const result = store.applyOperations([]);

		assert.equal(result.appliedCount, 0);
		assert.deepEqual(result.operations, []);
		assert.equal(store.getState("player.gold"), 100);

	});

	it("reads specific subsets of state keys", () => {

		const store = new StateStore({
			"district.alert_level": 2,
			"district.power_grid_active": true,
			"reputation.underworld": 5,
		});

		const subset = store.readStates(["district.alert_level", "reputation.underworld", "missing.key"]);

		assert.deepEqual(subset, {
			"district.alert_level": 2,
			"reputation.underworld": 5,
		});

		const allStates = store.readStates();
		assert.deepEqual(allStates, {
			"district.alert_level": 2,
			"district.power_grid_active": true,
			"reputation.underworld": 5,
		});

	});

	it("notifies subscribers on state mutations", () => {

		const store = new StateStore({
			"player.hp": 100,
		});

		const events: StateChangeEvent[] = [];
		const unsubscribe = store.subscribe((event) => {
			events.push(event);
		});

		store.setState("player.hp", 80, "Took damage");
		store.setState("player.shield", 50, "Shield activated");

		assert.equal(events.length, 2);
		assert.equal(events[0].key, "player.hp");
		assert.equal(events[0].previousValue, 100);
		assert.equal(events[0].newValue, 80);
		assert.equal(events[0].reason, "Took damage");

		assert.equal(events[1].key, "player.shield");
		assert.equal(events[1].previousValue, null);
		assert.equal(events[1].newValue, 50);

		unsubscribe();
		store.setState("player.hp", 60);
		assert.equal(events.length, 2);

	});

});

describe("StateStore Snapshots and Tree Rollback", () => {

	it("captures and restores snapshots accurately", () => {

		const store = new StateStore({
			"story.chapter": 1,
			"player.gold": 100,
		});

		const snapshot1 = store.createSnapshot();

		store.setState("story.chapter", 2);
		store.setState("player.gold", 250);
		store.setState("player.has_key", true);

		assert.equal(store.getState("story.chapter"), 2);
		assert.equal(store.getState("player.gold"), 250);
		assert.equal(store.getState("player.has_key"), true);

		// Rollback to snapshot 1
		store.restoreSnapshot(snapshot1);

		assert.equal(store.getState("story.chapter"), 1);
		assert.equal(store.getState("player.gold"), 100);
		assert.equal(store.getState("player.has_key"), undefined);

	});

	it("binds state snapshots to MessageTree nodes and supports branch navigation rollback", () => {

		const tree = new MessageTree();
		const store = new StateStore({
			"turn.count": 0,
			"character.mood": "neutral",
		});

		// Turn 1
		store.setState("turn.count", 1);
		store.setState("character.mood", "happy");
		const node1 = tree.addNode(
			{
				id: "msg-1",
				finishReason: "stop",
				data: { role: "user", content: "Hello friend!" },
			},
			null,
			store.createSnapshot(),
		);

		// Turn 2 (Branch A)
		store.setState("turn.count", 2);
		store.setState("character.mood", "excited");
		const node2a = tree.addNode(
			{
				id: "msg-2a",
				finishReason: "stop",
				data: { role: "assistant", content: "Great to see you!" },
			},
			node1.id,
			store.createSnapshot(),
		);

		// Turn 2 (Branch B - navigate back to node 1 and take different action)
		tree.setHead(node1.id);
		const node1Snapshot = tree.getNode(node1.id)?.stateSnapshot;
		assert.ok(node1Snapshot);
		store.restoreSnapshot(node1Snapshot);

		assert.equal(store.getState("turn.count"), 1);
		assert.equal(store.getState("character.mood"), "happy");

		store.setState("turn.count", 2);
		store.setState("character.mood", "angry");
		const node2b = tree.addNode(
			{
				id: "msg-2b",
				finishReason: "stop",
				data: { role: "assistant", content: "Why did you say that?" },
			},
			node1.id,
			store.createSnapshot(),
		);

		// Verify Branch A snapshot remains intact
		assert.equal(node2a.stateSnapshot?.["character.mood"], "excited");
		assert.equal(node2b.stateSnapshot?.["character.mood"], "angry");

		// Navigating to branch A node restores branch A state
		store.restoreSnapshot(tree.getNode(node2a.id)!.stateSnapshot!);
		assert.equal(store.getState("character.mood"), "excited");

	});

	it("manages tree snapshots via MessageTreeManager", () => {

		const manager = new MessageTreeManager();
		const store = new StateStore({ "location.room": "entrance" });

		const node = manager.appendMessage("user", "Look around", {
			stateSnapshot: store.createSnapshot(),
		});

		assert.deepEqual(manager.getStateSnapshot(node.id), { "location.room": "entrance" });
		assert.deepEqual(manager.getStateSnapshot(), { "location.room": "entrance" });

	});

});

describe("StateStore Semantic Blueprint Integration", () => {

	const sampleGauge: GaugeBlueprint = {
		key: "sanity",
		min: 0,
		max: 100,
		defaultValue: 80,
		maxDeltaPerTurn: 15,
		tiers: [
			{
				id: "hysterical",
				label: "Hysterical",
				min: 0,
				max: 29,
				directive: "Speak in disjointed phrases and fear shadows.",
				onEnter: [{ type: "set", key: "is_hallucinating", value: true }],
				onExit: [{ type: "delete", key: "is_hallucinating" }],
			},
			{
				id: "unsettled",
				label: "Unsettled",
				min: 30,
				max: 69,
				directive: "Notice unnatural geometry and hesitate.",
			},
			{
				id: "lucid",
				label: "Lucid",
				min: 70,
				max: 100,
				directive: "Think clearly and maintain composure.",
			},
		],
	};

	const sampleFsm: FsmBlueprint = {
		key: "investigation_phase",
		initialState: "briefing",
		states: {
			briefing: { directive: "Prepare investigation supplies." },
			manor: { directive: "Search rooms in the manor." },
			cellar: { directive: "Confront the ritual circle." },
		},
		transitions: [
			{
				from: "briefing",
				to: "manor",
				guard: { requiredFlags: ["briefing_done"] },
			},
			{
				from: "manor",
				to: "cellar",
				guard: {
					gaugeKey: "sanity",
					maxGauge: 50,
					requiredItems: ["cellar_key"],
				},
			},
		],
	};

	const sampleBlueprints: SemanticBlueprints = {
		gauges: [sampleGauge],
		stateMachines: [sampleFsm],
		flags: ["briefing_done"],
		inventories: [{ key: "backpack", items: ["cellar_key"] }],
	};

	it("initializes default gauge and state machine values when blueprints are provided", () => {

		const store = new StateStore(undefined, sampleBlueprints);

		assert.equal(store.getState("sanity"), 80);
		assert.equal(store.getState("investigation_phase"), "briefing");

	});

	it("preserves explicit initial states overriding blueprint defaults", () => {

		const store = new StateStore(
			{
				sanity: 40,
				investigation_phase: "manor",
			},
			sampleBlueprints,
		);

		assert.equal(store.getState("sanity"), 40);
		assert.equal(store.getState("investigation_phase"), "manor");

	});

	it("clamps gauge mutations to maxDeltaPerTurn", () => {

		const store = new StateStore(undefined, sampleBlueprints); // starts at 80

		// Target is 40 (delta -40), maxDeltaPerTurn is 15 -> clamps to 65
		const result = store.setState("sanity", 40);

		assert.equal(result.newValue, 65);
		assert.equal(store.getState("sanity"), 65);

	});

	it("executes registered tier onEnter and onExit transition actions", () => {

		const store = new StateStore({ sanity: 35 }, sampleBlueprints); // Unsettled tier

		assert.equal(store.getState("is_hallucinating"), undefined);

		// Drop from 35 to 25 (Hysterical tier)
		store.setState("sanity", 25);

		assert.equal(store.getState("sanity"), 25);
		assert.equal(store.getState("is_hallucinating"), true);

		// Rise back to 40 (Unsettled tier) -> triggers onExit delete
		store.setState("sanity", 40);

		assert.equal(store.getState("sanity"), 40);
		assert.equal(store.getState("is_hallucinating"), undefined);

	});

	it("enforces FSM transition guards and prevents illegal state mutations", () => {

		const store = new StateStore(undefined, sampleBlueprints); // briefing state

		// Attempt transition to manor without required flag
		assert.throws(
			() => store.setState("investigation_phase", "manor"),
			/Transition guard failed/,
		);
		assert.equal(store.getState("investigation_phase"), "briefing");

		// Set flag and try again
		store.setState("briefing_done", true);
		store.setState("investigation_phase", "manor");
		assert.equal(store.getState("investigation_phase"), "manor");

		// Attempt illegal transition (manor -> briefing is not declared)
		assert.throws(
			() => store.setState("investigation_phase", "briefing"),
			/No permitted transition/,
		);

	});

	it("validates atomic batch mutations across multiple updates in patchStates", () => {

		const store = new StateStore({ sanity: 80 }, sampleBlueprints);

		// Batch includes a valid flag update, a clamped gauge update, and an FSM transition
		store.patchStates({
			briefing_done: true,
			sanity: 70,
			investigation_phase: "manor",
		});

		assert.equal(store.getState("briefing_done"), true);
		assert.equal(store.getState("sanity"), 70);
		assert.equal(store.getState("investigation_phase"), "manor");

		// Batch where an FSM guard fails: nothing should be applied
		assert.throws(() => {
			store.patchStates({
				investigation_phase: "cellar", // fails: sanity is 70 > 50 and missing key
				another_variable: 999,
			});
		}, /Transition guard failed/);

		assert.equal(store.getState("investigation_phase"), "manor");
		assert.equal(store.getState("another_variable"), undefined);

	});

	it("extracts and caches active directives from gauges and state machines", () => {

		const store = new StateStore(undefined, sampleBlueprints); // sanity=80 (Lucid), phase=briefing

		const directives = store.getActiveDirectives();
		assert.equal(directives.tierDirectives.length, 1);
		assert.equal(directives.tierDirectives[0].tierId, "lucid");
		assert.equal(directives.fsmDirectives[0].state, "briefing");
		assert.equal(directives.allDirectives.length, 2);

		// Mutate state to update directives
		store.setState("sanity", 35); // Unsettled
		const updatedDirectives = store.getActiveDirectives();
		assert.equal(updatedDirectives.tierDirectives[0].tierId, "unsettled");

	});

});
