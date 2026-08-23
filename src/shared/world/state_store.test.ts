import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageTree } from "../ai/message/tree.ts";
import { MessageTreeManager } from "../ai/message/tree_manager.ts";
import { executeStateTool, MUTATE_WORLD_STATE_TOOL, PATCH_WORLD_STATE_TOOL, READ_WORLD_STATE_TOOL, STATE_TOOL_DEFINITIONS, StateStore, UPDATE_WORLD_STATE_TOOL } from "./state_store.ts";
import type { StateChangeEvent } from "./types.ts";

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

describe("LLM State Tool Execution", () => {

	it("executes update_world_state tool successfully", () => {

		const store = new StateStore({
			"district.alert_level": 1,
		});

		const result = executeStateTool(
			"update_world_state",
			{
				key: "district.alert_level",
				value: 2,
				reason: "Sirens sounding",
			},
			store,
		);

		assert.deepEqual(result, {
			status: "success",
			key: "district.alert_level",
			previous_value: 1,
			new_value: 2,
		});

		assert.equal(store.getState("district.alert_level"), 2);

	});

	it("executes patch_world_state tool successfully", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"district.power_grid_active": true,
		});

		const result = executeStateTool(
			"patch_world_state",
			{
				updates: {
					"district.alert_level": 2,
					"district.power_grid_active": false,
				},
				reason: "EMP blast triggered",
			},
			store,
		);

		assert.deepEqual(result, {
			status: "success",
			applied_count: 2,
			updates: {
				"district.alert_level": 2,
				"district.power_grid_active": false,
			},
		});

		assert.equal(store.getState("district.alert_level"), 2);
		assert.equal(store.getState("district.power_grid_active"), false);

	});

	it("executes mutate_world_state tool successfully with set and delete operations", () => {

		const store = new StateStore({
			"district.alert_level": 1,
			"temporary.quest": "intro",
		});

		const result = executeStateTool(
			"mutate_world_state",
			{
				operations: [
					{ type: "set", key: "district.alert_level", value: 3 },
					{ type: "delete", key: "temporary.quest" },
					{ type: "set", key: "district.status", value: "evacuated" },
				],
				reason: "District evacuated",
			},
			store,
		);

		assert.deepEqual(result, {
			status: "success",
			applied_count: 3,
			operations: [
				{ type: "set", key: "district.alert_level", value: 3 },
				{ type: "delete", key: "temporary.quest" },
				{ type: "set", key: "district.status", value: "evacuated" },
			],
		});

		assert.equal(store.getState("district.alert_level"), 3);
		assert.equal(store.getState("temporary.quest"), undefined);
		assert.equal(store.getState("district.status"), "evacuated");

	});

	it("executes update_world_state tool when given an operations array", () => {

		const store = new StateStore({
			"district.alert_level": 1,
		});

		const result = executeStateTool(
			"update_world_state",
			{
				operations: [
					{ type: "set", key: "district.alert_level", value: 4 },
				],
				reason: "Emergency protocol",
			},
			store,
		);

		assert.deepEqual(result, {
			status: "success",
			applied_count: 1,
			operations: [
				{ type: "set", key: "district.alert_level", value: 4 },
			],
		});

		assert.equal(store.getState("district.alert_level"), 4);

	});

	it("executes read_world_state tool successfully with key filtering", () => {

		const store = new StateStore({
			"district.alert_level": 2,
			"district.power_grid_active": true,
			"reputation.underworld": 5,
		});

		const filteredResult = executeStateTool(
			"read_world_state",
			{
				keys: ["district.alert_level", "reputation.underworld"],
			},
			store,
		);

		assert.deepEqual(filteredResult, {
			status: "success",
			states: {
				"district.alert_level": 2,
				"reputation.underworld": 5,
			},
		});

		const allResult = executeStateTool("read_world_state", {}, store);
		assert.deepEqual(allResult, {
			status: "success",
			states: {
				"district.alert_level": 2,
				"district.power_grid_active": true,
				"reputation.underworld": 5,
			},
		});

	});

	it("returns structured error response on invalid tool parameters or type mismatch", () => {

		const store = new StateStore({
			"district.alert_level": 1,
		});

		// Type mismatch error
		const typeErrorResult = executeStateTool(
			"update_world_state",
			{
				key: "district.alert_level",
				value: "high",
			},
			store,
		);

		assert.equal(typeErrorResult.status, "error");
		assert.match(
			(typeErrorResult as { status: "error"; message: string }).message,
			/Type mismatch for key 'district.alert_level'/,
		);

		// Missing required key in update_world_state
		const missingKeyResult = executeStateTool(
			"update_world_state",
			{
				value: 10,
			},
			store,
		);

		assert.equal(missingKeyResult.status, "error");
		assert.match(
			(missingKeyResult as { status: "error"; message: string }).message,
			/Field 'key' must be a dot-notated string/,
		);

		// Unknown tool name
		const unknownToolResult = executeStateTool("delete_all_data", {}, store);
		assert.equal(unknownToolResult.status, "error");
		assert.match(
			(unknownToolResult as { status: "error"; message: string }).message,
			/Unknown state tool: delete_all_data/,
		);

		// Invalid operations parameter in mutate_world_state
		const invalidOperationsResult = executeStateTool(
			"mutate_world_state",
			{ operations: "not-an-array" },
			store,
		);
		assert.equal(invalidOperationsResult.status, "error");
		assert.match(
			(invalidOperationsResult as { status: "error"; message: string }).message,
			/Field 'operations' must be an array of state operations/,
		);

	});

	it("exposes valid JSON tool schemas conforming to OpenAI tool definition format", () => {

		assert.equal(MUTATE_WORLD_STATE_TOOL.type, "function");
		assert.equal(MUTATE_WORLD_STATE_TOOL.function.name, "mutate_world_state");
		assert.deepEqual(MUTATE_WORLD_STATE_TOOL.function.parameters.required, ["operations"]);

		assert.equal(UPDATE_WORLD_STATE_TOOL.type, "function");
		assert.equal(UPDATE_WORLD_STATE_TOOL.function.name, "update_world_state");
		assert.deepEqual(UPDATE_WORLD_STATE_TOOL.function.parameters.required, ["key", "value"]);

		assert.equal(PATCH_WORLD_STATE_TOOL.type, "function");
		assert.equal(PATCH_WORLD_STATE_TOOL.function.name, "patch_world_state");
		assert.deepEqual(PATCH_WORLD_STATE_TOOL.function.parameters.required, ["updates"]);

		assert.equal(READ_WORLD_STATE_TOOL.type, "function");
		assert.equal(READ_WORLD_STATE_TOOL.function.name, "read_world_state");

		assert.ok(STATE_TOOL_DEFINITIONS.includes(MUTATE_WORLD_STATE_TOOL));

	});

});
