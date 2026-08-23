import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AssistantToolContext } from "./tools.ts";
import { createStagedModificationStore, executeAssistantTool, getAssistantToolsForTab, PROPOSE_PROMPT_MODIFICATION_TOOL, PROPOSE_UNIVERSE_MODIFICATION_TOOL, PROPOSE_WORLD_MODIFICATION_TOOL } from "./tools.ts";

describe("Assistant Tools and Staged Modifications", () => {

	it("exposes valid function tool definitions conforming to tool schema", () => {
		assert.strictEqual(PROPOSE_WORLD_MODIFICATION_TOOL.function.name, "propose_world_modification");
		assert.strictEqual(PROPOSE_UNIVERSE_MODIFICATION_TOOL.function.name, "propose_universe_modification");
		assert.strictEqual(PROPOSE_PROMPT_MODIFICATION_TOOL.function.name, "propose_prompt_modification");

		const worldProps = PROPOSE_WORLD_MODIFICATION_TOOL.function.parameters?.properties as Record<string, unknown>;
		assert.ok(worldProps.title);
		assert.ok(worldProps.edits);
		assert.ok(worldProps.operation);
		assert.ok(worldProps.startLine);
		assert.ok(worldProps.proposedToml);
	});

	it("returns appropriate tools per tab with function tool wrapper type", () => {
		const tabs = ["world-manager", "universe-manager", "character-manager", "lore", "settings"] as const;

		for (const tab of tabs) {
			const tools = getAssistantToolsForTab(tab);
			assert.strictEqual(tools.length, 1);
			assert.strictEqual(tools[0].type, "function");
			assert.ok(tools[0].function);
			assert.ok(typeof tools[0].function.name === "string" && tools[0].function.name.length > 0);
			assert.ok(typeof tools[0].function.description === "string" && tools[0].function.description.length > 0);
			assert.strictEqual(tools[0].function.parameters?.type, "object");
		}

		const worldTools = getAssistantToolsForTab("world-manager");
		const universeTools = getAssistantToolsForTab("universe-manager");
		const characterTools = getAssistantToolsForTab("character-manager");
		const loreTools = getAssistantToolsForTab("lore");
		const settingsTools = getAssistantToolsForTab("settings");

		assert.strictEqual(worldTools[0].function.name, "propose_world_modification");
		assert.strictEqual(universeTools[0].function.name, "propose_universe_modification");
		assert.strictEqual(characterTools[0].function.name, "propose_character_modification");
		assert.strictEqual(loreTools[0].function.name, "propose_lore_modification");
		assert.strictEqual(settingsTools[0].function.name, "propose_prompt_modification");
	});

	it("manages staged modifications and transitions status to applied or rejected", () => {
		const store = createStagedModificationStore();
		let notifications = 0;
		store.subscribe(() => {
			notifications++;
		});

		store.stage({
			toolCallId: "call_123",
			tab: "world-manager",
			title: "Add character",
			originalText: "old content",
			proposedText: "new content",
			status: "pending",
		});

		assert.strictEqual(notifications, 1);
		const staged = store.getStaged("call_123");
		assert.ok(staged);
		assert.strictEqual(staged.status, "pending");

		const applied = store.apply("call_123");
		assert.ok(applied);
		assert.strictEqual(applied.status, "applied");
		assert.strictEqual(notifications, 2);

		store.stage({
			toolCallId: "call_456",
			tab: "universe-manager",
			title: "Reject me",
			originalText: "old",
			proposedText: "new",
			status: "pending",
		});

		const rejected = store.reject("call_456");
		assert.ok(rejected);
		assert.strictEqual(rejected.status, "rejected");

		assert.strictEqual(store.getAllStaged().length, 2);
		store.clear();
		assert.strictEqual(store.getAllStaged().length, 0);
	});

	it("executes propose_world_modification and stages valid changes", () => {
		const store = createStagedModificationStore();
		const context: AssistantToolContext = {
			tab: "world-manager",
			originalText: "name = \"Fantasy World\"\n",
			activeId: "world_1",
			store,
		};

		const result = executeAssistantTool(
			"call_world_01",
			"propose_world_modification",
			{
				title: "Add Eldrin character",
				proposedToml: "name = \"Fantasy World\"\n\n[[characters]]\nname = \"Eldrin\"\n",
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		assert.strictEqual(result.title, "Add Eldrin character");
		assert.ok(result.diff);
		assert.ok(result.diff.additionsCount > 0);

		const staged = store.getStaged("call_world_01");
		assert.ok(staged);
		assert.strictEqual(staged.title, "Add Eldrin character");
		assert.strictEqual(staged.status, "pending");
	});

	it("executes propose_world_modification with partial line edits array", () => {
		const store = createStagedModificationStore();
		const originalText = "[metadata]\nname = \"eldoria\"\nversion = \"1.0.0\"\n";
		const context: AssistantToolContext = {
			tab: "world-manager",
			originalText,
			activeId: "world_eldoria",
			store,
		};

		const result = executeAssistantTool(
			"call_partial_01",
			"propose_world_modification",
			{
				title: "Update version to 1.1.0 and insert author",
				edits: [
					{
						operation: "replace",
						startLine: 3,
						endLine: 3,
						content: "version = \"1.1.0\"",
					},
					{
						operation: "insert",
						startLine: 3,
						position: "after",
						content: "authors = [\"Aria\"]",
					},
				],
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		assert.ok(result.diff);
		assert.strictEqual(result.diff.hasChanges, true);

		const staged = store.getStaged("call_partial_01");
		assert.ok(staged);
		assert.strictEqual(
			staged.proposedText,
			"[metadata]\nname = \"eldoria\"\nversion = \"1.1.0\"\nauthors = [\"Aria\"]\n",
		);
	});

	it("executes propose_universe_modification with single partial edit fields", () => {
		const store = createStagedModificationStore();
		const originalText = "[metadata]\nname = \"prime\"\n\n[settings]\nrules = [\"Rule 1\"]\n";
		const context: AssistantToolContext = {
			tab: "universe-manager",
			originalText,
			activeId: "univ_prime",
			store,
		};

		const result = executeAssistantTool(
			"call_univ_partial",
			"propose_universe_modification",
			{
				title: "Add temporal stability rule",
				operation: "insert",
				startLine: 4,
				position: "after",
				content: "    \"Rule 2: Temporal stability enforced\",",
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		const staged = store.getStaged("call_univ_partial");
		assert.ok(staged);
		assert.ok(staged.proposedText.includes("Rule 2: Temporal stability enforced"));
	});

	it("handles partial line deletion via propose_prompt_modification", () => {
		const store = createStagedModificationStore();
		const originalText = "# Line 1\n# Line 2 to remove\n# Line 3\n";
		const context: AssistantToolContext = {
			tab: "settings",
			originalText,
			activeId: "p_1",
			store,
		};

		const result = executeAssistantTool(
			"call_prompt_del",
			"propose_prompt_modification",
			{
				title: "Remove redundant line",
				operation: "delete",
				startLine: 2,
				endLine: 2,
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		const staged = store.getStaged("call_prompt_del");
		assert.ok(staged);
		assert.strictEqual(staged.proposedText, "# Line 1\n# Line 3\n");
	});

	it("detects zero changes and returns no_change status without staging", () => {
		const store = createStagedModificationStore();
		const context: AssistantToolContext = {
			tab: "universe-manager",
			originalText: "title = \"Cosmos\"\n",
			activeId: "univ_1",
			store,
		};

		const result = executeAssistantTool(
			"call_univ_same",
			"propose_universe_modification",
			{
				title: "No-op change",
				proposedToml: "title = \"Cosmos\"\n",
			},
			context,
		);

		assert.strictEqual(result.status, "no_change");
		assert.strictEqual(store.getAllStaged().length, 0);
	});

	it("executes propose_prompt_modification in settings", () => {
		const store = createStagedModificationStore();
		const context: AssistantToolContext = {
			tab: "settings",
			originalText: "Base prompt text",
			activeId: "settings_prompts",
			store,
		};

		const result = executeAssistantTool(
			"call_prompt_01",
			"propose_prompt_modification",
			{
				title: "Fantasy Tone",
				proposedContent: "New fantasy tone guidelines",
				targetPromptId: "p_1",
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		assert.strictEqual(result.payload?.targetPath, "p_1");
		assert.strictEqual(store.getStaged("call_prompt_01")?.status, "pending");
	});

	it("stages multiline TOML proposals and multiline line replacements", () => {
		const store = createStagedModificationStore();
		const originalText = `[metadata]
name = "cyber_world"
version = "1.0.0"
title = "Cyber World"
description = """
Initial line 1.
Initial line 2."""

[content]
backgrounds = [
  "District 1"
]
`;
		const context: AssistantToolContext = {
			tab: "world-manager",
			originalText,
			activeId: "world_1",
			store,
		};

		const result = executeAssistantTool(
			"call_multiline_edit",
			"propose_world_modification",
			{
				title: "Update description to multiline text",
				operation: "replace",
				startLine: 5,
				endLine: 7,
				content: `description = """
Updated line 1.
Updated line 2.
Updated line 3."""`,
			},
			context,
		);

		assert.strictEqual(result.status, "staged");
		const staged = store.getStaged("call_multiline_edit");
		assert.ok(staged);
		assert.ok(staged.proposedText.includes("Updated line 1.\nUpdated line 2.\nUpdated line 3."));
	});

	it("returns structured error for missing arguments or unknown tools", () => {
		const context: AssistantToolContext = {
			tab: "world-manager",
			originalText: "text",
			activeId: null,
		};

		const missingTitle = executeAssistantTool(
			"call_err_1",
			"propose_world_modification",
			{ proposedToml: "foo" },
			context,
		);
		assert.strictEqual(missingTitle.status, "error");
		assert.ok(missingTitle.message.includes("title"));

		const unknown = executeAssistantTool(
			"call_err_2",
			"unknown_tool_name",
			{},
			context,
		);
		assert.strictEqual(unknown.status, "error");
		assert.ok(unknown.message.includes("Unknown assistant tool"));
	});

});
