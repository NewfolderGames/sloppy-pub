import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CharacterStateStore } from "./state_store.ts";
import { executeCharacterTool } from "./tools.ts";
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

	describe("mutate_character Tool Execution", () => {
		it("applies atomic batch set and delete operations successfully", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool(
				"mutate_character",
				{
					character: "elena_vance",
					operations: [
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
					],
				},
				store,
			);

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

			const result = executeCharacterTool(
				"mutate_character",
				{
					character: "unknown_person",
					operations: [
						{
							type: "set",
							category: "thought",
							title: "Test",
							internal_monologue: "Monologue",
						},
					],
				},
				store,
			);

			assert.equal(result.status, "error");
			assert.ok(result.message?.includes("not found"));
		});

		it("returns error when operations parameter is invalid", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool(
				"mutate_character",
				{
					character: "elena_vance",
					operations: "not_an_array",
				},
				store,
			);

			assert.equal(result.status, "error");
			assert.ok(result.message?.includes("must be an array"));
		});

		it("returns error for unsupported operation type or category", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const invalidTypeResult = executeCharacterTool(
				"mutate_character",
				{
					character: "elena_vance",
					operations: [
						{
							type: "invalid_type",
							category: "thought",
						},
					],
				},
				store,
			);

			assert.equal(invalidTypeResult.status, "error");
			assert.ok(invalidTypeResult.message?.includes("Unsupported operation type"));

			const invalidCatResult = executeCharacterTool(
				"mutate_character",
				{
					character: "elena_vance",
					operations: [
						{
							type: "set",
							category: "invalid_category",
						},
					],
				},
				store,
			);

			assert.equal(invalidCatResult.status, "error");
			assert.ok(invalidCatResult.message?.includes("Unsupported category"));
		});
	});

	describe("read_character Tool Execution", () => {
		it("reads specific character when character argument is provided", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool(
				"read_character",
				{ character: "elena_vance" },
				store,
			);

			assert.equal(result.status, "success");
			assert.ok(result.character);
			assert.equal((result.character as CharacterInstance).name, "Dr. Elena Vance");
		});

		it("reads all characters when character argument is omitted", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool("read_character", {}, store);

			assert.equal(result.status, "success");
			assert.ok(Array.isArray(result.characters));
			assert.equal(result.characters.length, 1);
		});

		it("returns error when requested character is not found", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool(
				"read_character",
				{ character: "ghost_character" },
				store,
			);

			assert.equal(result.status, "error");
			assert.ok(result.message?.includes("not found"));
		});

		it("returns error for unknown tool name", () => {
			const store = new CharacterStateStore([createSampleInstance()]);

			const result = executeCharacterTool("unknown_tool", {}, store);

			assert.equal(result.status, "error");
			assert.ok(result.message?.includes("Unknown character tool"));
		});
	});

	describe("NPC Character Support", () => {
		it("creates NPC without characterId", () => {
			const store = new CharacterStateStore([]);

			const result = executeCharacterTool(
				"create_npc_character",
				{ name: "Guard", description: "A city guard." },
				store,
			);

			assert.equal(result.status, "success");
			assert.ok(result.character);
			assert.ok((result.character as CharacterInstance).isNpc);
			assert.equal((result.character as CharacterInstance).characterId, undefined);
			assert.equal((result.character as CharacterInstance).name, "Guard");
		});

		it("stores NPC and retrieves it by id", () => {
			const store = new CharacterStateStore([]);

			executeCharacterTool(
				"create_npc_character",
				{ name: "Merchant" },
				store,
			);

			const allInstances = store.getAllInstances();
			assert.equal(allInstances.length, 1);
			assert.equal(allInstances[0].isNpc, true);
			assert.equal(allInstances[0].name, "Merchant");
		});

		it("cloning preserves isNpc flag", () => {
			const store = new CharacterStateStore([]);

			const result = executeCharacterTool(
				"create_npc_character",
				{ name: "Barkeep" },
				store,
			);

			const npc = result.character as CharacterInstance;
			assert.ok(npc.isNpc);

			// getInstance clones, verify isNpc survives
			const fetched = store.getInstance(npc.id);
			assert.ok(fetched);
			assert.equal(fetched.isNpc, true);
		});

		it("lookup by name works for NPCs without characterId", () => {
			const store = new CharacterStateStore([]);

			executeCharacterTool(
				"create_npc_character",
				{ name: "Blacksmith" },
				store,
			);

			const found = store.getInstance("Blacksmith");
			assert.ok(found);
			assert.equal(found.name, "Blacksmith");
			assert.equal(found.isNpc, true);
		});

		it("removeInstance works for NPC without characterId", () => {
			const store = new CharacterStateStore([]);

			const result = executeCharacterTool(
				"create_npc_character",
				{ name: "Alchemist" },
				store,
			);

			const npc = result.character as CharacterInstance;

			store.removeInstance(npc.id);
			const fetched = store.getInstance(npc.id);
			assert.equal(fetched, undefined);
		});

		it("getInstance does not crash when NPC and template character coexist", () => {
			const store = new CharacterStateStore([
				{ ...createSampleInstance(), id: "tmpl_1", characterId: "hero_1", name: "Hero" },
			]);

			executeCharacterTool(
				"create_npc_character",
				{ name: "Villager" },
				store,
			);

			// These lookups should not throw despite NPC having no characterId
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
