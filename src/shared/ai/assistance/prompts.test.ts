import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ChatCompletionMessageParam } from "../llm/common.ts";
import type { AssistancePromptItem, AssistantContextData } from "./types.ts";
import { assembleAssistantPromptMessages, assembleAssistantSystemPrompt, formatEditorContext, getBaseAssistantPrompt } from "./prompts.ts";

describe("Assistance Prompts and Context Assembler", () => {

	it("provides distinct base prompts for supported tabs with TOML specifications", () => {
		const worldPrompt = getBaseAssistantPrompt("world-manager");
		const universePrompt = getBaseAssistantPrompt("universe-manager");
		const characterPrompt = getBaseAssistantPrompt("character-manager");
		const lorePrompt = getBaseAssistantPrompt("lore");
		const settingsPrompt = getBaseAssistantPrompt("settings");

		assert.ok(worldPrompt.includes("Autonomous Tool Calling"));
		assert.ok(universePrompt.includes("Autonomous Tool Calling"));
		assert.ok(characterPrompt.includes("Autonomous Tool Calling"));
		assert.ok(lorePrompt.includes("Autonomous Tool Calling"));
		assert.ok(settingsPrompt.includes("Autonomous Tool Calling"));

		assert.ok(worldPrompt.includes("World Manager"));
		assert.ok(worldPrompt.includes("Worldfile TOML Structure and Syntax"));
		assert.ok(worldPrompt.includes("[metadata]"));
		assert.ok(worldPrompt.includes("[[args]]"));
		assert.ok(worldPrompt.includes("[content]"));
		assert.ok(worldPrompt.includes("Partial Line Editing"));

		assert.ok(universePrompt.includes("Universe Manager"));
		assert.ok(universePrompt.includes("Universefile TOML Structure and Syntax"));
		assert.ok(universePrompt.includes("[settings]"));
		assert.ok(universePrompt.includes("Partial Line Editing"));

		assert.ok(characterPrompt.includes("Character Manager Wizard"));
		assert.ok(characterPrompt.includes("propose_character_modification"));
		assert.ok(characterPrompt.includes("[[backgrounds]]"));

		assert.ok(lorePrompt.includes("Lore Book Wizard"));
		assert.ok(lorePrompt.includes("propose_lore_modification"));
		assert.ok(lorePrompt.includes("activation_mode"));

		assert.ok(settingsPrompt.includes("Settings"));
		assert.notStrictEqual(worldPrompt, universePrompt);
		assert.notStrictEqual(universePrompt, settingsPrompt);
		assert.notStrictEqual(characterPrompt, lorePrompt);
	});

	it("formats editor context with activeId, line-numbered rawToml, and summary", () => {
		const context: AssistantContextData = {
			tab: "world-manager",
			activeId: "world_fantasy_01",
			rawToml: "[world]\nname = \"Fantasy Realm\"",
			summary: { characterCount: 5, locationsCount: 2 },
		};

		const formatted = formatEditorContext(context);

		assert.ok(formatted.includes("Active Context: world-manager"));
		assert.ok(formatted.includes("world_fantasy_01"));
		assert.ok(formatted.includes("1 | [world]"));
		assert.ok(formatted.includes("2 | name = \"Fantasy Realm\""));
		assert.ok(formatted.includes("2 total lines"));
		assert.ok(formatted.includes("\"characterCount\": 5"));

		const emptyContext: AssistantContextData = {
			tab: "world-manager",
			activeId: null,
			rawToml: "",
		};
		const emptyFormatted = formatEditorContext(emptyContext);
		assert.ok(emptyFormatted.includes("The editor is currently empty"));
		assert.ok(emptyFormatted.includes("proposedToml"));
	});

	it("assembles complete system prompt with base, editor context, and custom prompts", () => {
		const context: AssistantContextData = {
			tab: "universe-manager",
			activeId: "universe_scifi",
			rawToml: "[universe]\ntitle = \"Galactic Void\"",
		};

		const customPrompts: AssistancePromptItem[] = [
			{
				id: "custom_1",
				name: "Hard Sci-Fi Rules",
				content: "Enforce realistic orbital mechanics.",
				enabled: true,
			},
		];

		const systemPrompt = assembleAssistantSystemPrompt(context, customPrompts);

		assert.ok(systemPrompt.includes("Universe Manager AI Assistant"));
		assert.ok(systemPrompt.includes("Galactic Void"));
		assert.ok(systemPrompt.includes("Hard Sci-Fi Rules"));
		assert.ok(systemPrompt.includes("Enforce realistic orbital mechanics."));
	});

	it("assembles ChatCompletion messages combining system prompt and session history", () => {
		const context: AssistantContextData = {
			tab: "settings",
			activeId: "prompt_config",
		};

		const sessionMessages: ChatCompletionMessageParam[] = [
			{ role: "user", content: "Suggest a tone for a detective RPG." },
			{ role: "assistant", content: "Use a noir atmosphere with cynical narration." },
		];

		const messages = assembleAssistantPromptMessages(context, sessionMessages, []);

		assert.strictEqual(messages.length, 3);
		assert.strictEqual(messages[0].role, "system");
		assert.ok(typeof messages[0].content === "string" && messages[0].content.includes("Settings & Prompts"));
		assert.strictEqual(messages[1].role, "user");
		assert.strictEqual(messages[2].role, "assistant");
	});

});
