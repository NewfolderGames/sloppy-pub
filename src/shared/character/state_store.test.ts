import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CharacterStateStore } from "./state_store.ts";
import type { CharacterInstance } from "./types.ts";

describe("CharacterStateStore & Character Tools", () => {
	const createSampleInstance = (): CharacterInstance => ({
		id: "inst_vance",
		characterId: "elena_vance",
		name: "Dr. Elena Vance",
		thoughts: [
			{
				id: "t1",
				title: "Pulsar Anomaly",
				internal_monologue: "The pulse frequency shifted by 0.3 hertz.",
			},
		],
		emotions: [
			{
				id: "e1",
				name: "Focus",
				internal_monologue: "Completely absorbed in stellar spectrograms.",
			},
		],
		goals: [
			{
				id: "g1",
				name: "Record Telemetry",
				internal_monologue: "Maintain continuous sensor feed until dawn.",
			},
		],
		states: {
			energy: 90,
			lab_door_locked: true,
			tools: ["spectrometer", "scanner"],
		},
	});

	describe("Store Operations & Subscriptions", () => {
		it("initializes with provided instances", () => {
			const store = new CharacterStateStore([createSampleInstance()]);
			const instances = store.getAllInstances();

			assert.equal(instances.length, 1);
			assert.equal(instances[0].name, "Dr. Elena Vance");
			assert.equal(instances[0].thoughts.length, 1);
		});

		it("finds instance by id, characterId, or name", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			assert.ok(store.getInstance("inst_vance"));
			assert.ok(store.getInstance("elena_vance"));
			assert.ok(store.getInstance("Dr. Elena Vance"));
			assert.ok(store.getInstance("dr. elena vance"));
			assert.equal(store.getInstance("non_existent"), undefined);
		});

		it("notifies subscribers when changes occur", () => {
			const store = new CharacterStateStore([createSampleInstance()]);
			let callCount = 0;

			const unsubscribe = store.subscribe(() => {
				callCount += 1;
			});

			store.setThought("inst_vance", {
				title: "New Thought",
				internal_monologue: "Contemplating cosmos.",
			});

			assert.equal(callCount, 1);

			unsubscribe();

			store.setEmotion("inst_vance", {
				name: "Curiosity",
				internal_monologue: "Intrigued by findings.",
			});

			assert.equal(callCount, 1);
		});

		it("sets and deletes thoughts, emotions, goals, and states directly", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			// Add and update thought
			store.setThought("inst_vance", {
				title: "Calibration",
				internal_monologue: "Sensors calibrated.",
			});
			assert.equal(store.getInstance("inst_vance")?.thoughts.length, 2);

			store.deleteThought("inst_vance", "Calibration");
			assert.equal(store.getInstance("inst_vance")?.thoughts.length, 1);

			// Add and delete emotion
			store.setEmotion("inst_vance", {
				name: "Surprise",
				internal_monologue: "Unexpected reading.",
			});
			assert.equal(store.getInstance("inst_vance")?.emotions.length, 2);

			store.deleteEmotion("inst_vance", "Surprise");
			assert.equal(store.getInstance("inst_vance")?.emotions.length, 1);

			// Add and delete goal
			store.setGoal("inst_vance", {
				name: "Alert Team",
				internal_monologue: "Notify the night shift.",
			});
			assert.equal(store.getInstance("inst_vance")?.goals.length, 2);

			store.deleteGoal("inst_vance", "Alert Team");
			assert.equal(store.getInstance("inst_vance")?.goals.length, 1);

			// Set and delete state
			store.setState("inst_vance", "telescope_target", "Sector 12");
			assert.equal(
				store.getInstance("inst_vance")?.states["telescope_target"],
				"Sector 12",
			);

			store.deleteState("inst_vance", "telescope_target");
			assert.equal(
				store.getInstance("inst_vance")?.states["telescope_target"],
				undefined,
			);
		});
	});

	describe("applyOperations", () => {
		it("applies atomic batch set and delete operations successfully", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = store.applyOperations("elena_vance", [
				{
					type: "set",
					category: "thought",
					title: "Hypothesis",
					internal_monologue: "The signal contains binary prime patterns.",
				},
				{
					type: "delete",
					category: "thought",
					title: "Pulsar Anomaly",
				},
				{
					type: "set",
					category: "emotion",
					name: "Wonder",
					internal_monologue: "A profound sense of contact.",
				},
				{
					type: "delete",
					category: "emotion",
					name: "Focus",
				},
				{
					type: "set",
					category: "goal",
					name: "Decode Header",
					internal_monologue: "Extract the synchronization bytes.",
				},
				{
					type: "set",
					category: "state",
					key: "decoding_progress",
					value: 15,
				},
				{
					type: "delete",
					category: "state",
					key: "energy",
				},
			]);

			assert.equal(result.status, "success");
			assert.equal(result.applied_count, 7);

			const updated = store.getInstance("elena_vance");
			assert.ok(updated);

			assert.equal(updated.thoughts.length, 1);
			assert.equal(updated.thoughts[0].title, "Hypothesis");

			assert.equal(updated.emotions.length, 1);
			assert.equal(updated.emotions[0].name, "Wonder");

			assert.equal(updated.goals.length, 2);
			assert.equal(updated.states["decoding_progress"], 15);
			assert.equal(updated.states["energy"], undefined);
		});

		it("returns error when character is not found", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = store.applyOperations("unknown_person", [
				{
					type: "set",
					category: "thought",
					title: "Test",
					internal_monologue: "Monologue",
				},
			]);

			assert.equal(result.status, "error");
			assert.ok(result.message?.includes("not found"));
		});
	});

	describe("NPC Character Support", () => {
		it("stores NPC and retrieves it by id", () => {
			const store = new CharacterStateStore([]);

			store.addInstance({
				id: "npc_merchant",
				name: "Merchant",
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			});

			const allInstances = store.getAllInstances();
			assert.equal(allInstances.length, 1);
			assert.equal(allInstances[0].isNpc, true);
			assert.equal(allInstances[0].name, "Merchant");
		});

		it("cloning preserves isNpc flag", () => {
			const store = new CharacterStateStore([]);

			store.addInstance({
				id: "npc_barkeep",
				name: "Barkeep",
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			});

			const fetched = store.getInstance("npc_barkeep");
			assert.ok(fetched);
			assert.equal(fetched.isNpc, true);
		});

		it("lookup by name works for NPCs without characterId", () => {
			const store = new CharacterStateStore([]);

			store.addInstance({
				id: "npc_blacksmith",
				name: "Blacksmith",
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			});

			const found = store.getInstance("Blacksmith");
			assert.ok(found);
			assert.equal(found.name, "Blacksmith");
			assert.equal(found.isNpc, true);
		});

		it("removeInstance works for NPC without characterId", () => {
			const store = new CharacterStateStore([]);

			store.addInstance({
				id: "npc_alchemist",
				name: "Alchemist",
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			});

			store.removeInstance("npc_alchemist");
			const fetched = store.getInstance("npc_alchemist");
			assert.equal(fetched, undefined);
		});

		it("getInstance does not crash when NPC and template character coexist", () => {
			const store = new CharacterStateStore([
				{ ...createSampleInstance(), id: "tmpl_1", characterId: "hero_1", name: "Hero" },
			]);

			store.addInstance({
				id: "npc_villager",
				name: "Villager",
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			});

			const hero = store.getInstance("Hero");
			assert.ok(hero);

			const villager = store.getInstance("Villager");
			assert.ok(villager);
			assert.equal(villager.isNpc, true);

			const all = store.getAllInstances();
			assert.equal(all.length, 2);
		});
	});
});
