import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ChatCompletionMessageParam } from "../ai/llm/common.ts";
import { deleteLoreBook, saveLoreBook } from "../lore/registry.ts";
import type { LoreBook } from "../lore/types.ts";
import {
	addPrompt,
	APP_PROMPT,
	assembleChatPromptMessages,
	clearPromptSettingsMemory,
	deletePrompt,
	formatSemanticDirectivesPrompt,
	formatSessionStatesPrompt,
	getPromptSettings,
	getPromptSettingsSnapshot,
	getSystemPromptItem,
	isSystemPromptId,
	reorderPrompt,
	resetPromptSettings,
	savePromptSettings,
	setPromptSettingsRawForTesting,
	subscribePromptSettings,
	SYSTEM_PROMPT_DEFINITIONS,
	SYSTEM_PROMPT_IDS,
	updatePrompt,
	updateSystemPrompt,
	updateSystemPromptRole,
} from "./prompt_registry.ts";
import { evaluateChoiceOptionGating } from "../world/semantic/validation_engine.ts";
import type { PromptSettings, SystemPromptId } from "./types.ts";

describe("Prompt Registry", () => {

	beforeEach(() => {
		clearPromptSettingsMemory();
	});

	// Default Initialization

	describe("APP_PROMPT", () => {

		it("contains required XML tag specifications", () => {
			assert.ok(APP_PROMPT.includes("<character"));
			assert.ok(APP_PROMPT.includes("<system"));
			assert.ok(APP_PROMPT.includes("<choices"));
			assert.ok(APP_PROMPT.includes("<turn"));
		});

		it("contains directives for documents, newspapers, screens, and item cards", () => {
			assert.ok(APP_PROMPT.includes("m-doc"));
			assert.ok(APP_PROMPT.includes("m-newspaper"));
			assert.ok(APP_PROMPT.includes("m-screen"));
			assert.ok(APP_PROMPT.includes("m-item-card"));
		});

		it("contains directives for badges, callouts, and layout utilities", () => {
			assert.ok(APP_PROMPT.includes("m-badge"));
			assert.ok(APP_PROMPT.includes("m-callout"));
			assert.ok(APP_PROMPT.includes("m-grid-2"));
			assert.ok(APP_PROMPT.includes("m-grid-3"));
			assert.ok(APP_PROMPT.includes("m-meter"));
			assert.ok(APP_PROMPT.includes("m-divider"));
		});

		it("contains roleplay instructions and behavioral rules", () => {
			assert.ok(APP_PROMPT.includes("# Roleplay Instructions"));
			assert.ok(APP_PROMPT.includes("## Perceptual Subjectivity"));
			assert.ok(APP_PROMPT.includes("## Emergent Vitality"));
			assert.ok(APP_PROMPT.includes("## Steering and Momentum"));
			assert.ok(APP_PROMPT.includes("## Character Integrity and Friction"));
			assert.ok(APP_PROMPT.includes("## Immersive Roleplay Extensions"));
		});

	});

	it("initializes with default system prompt entries in order", () => {
		const settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);

		assert.deepEqual(settings.userPrompts, {});

		assert.deepEqual(settings.systemPrompts, {
			"system:app_prompt": { enabled: true, role: "system" },
			"system:world_prompt": { enabled: true, role: "system" },
			"system:character_prompt": { enabled: true, role: "system" },
			"system:lore_prompt": { enabled: true, role: "system" },
			"system:chapters_summary": { enabled: true, role: "system" },
			"system:chat_history": { enabled: true },
			"system:character_instances": { enabled: true, role: "user" },
			"system:world_states": { enabled: true, role: "user" },
			"system:semantic_directives": { enabled: true, role: "system" },
			"system:session_events": { enabled: true, role: "user" },
			"system:director_prompt": { enabled: true, role: "user" },
			"system:wizard_prompt": { enabled: true, role: "system" },
		});
	});

	it("identifies system prompt ids correctly", () => {
		assert.equal(isSystemPromptId("system:app_prompt"), true);
		assert.equal(isSystemPromptId("system:world_prompt"), true);
		assert.equal(isSystemPromptId("system:character_prompt"), true);
		assert.equal(isSystemPromptId("system:chapters_summary"), true);
		assert.equal(isSystemPromptId("system:chat_history"), true);
		assert.equal(isSystemPromptId("system:world_states"), true);
		assert.equal(isSystemPromptId("system:semantic_directives"), true);
		assert.equal(isSystemPromptId("system:character_instances"), true);
		assert.equal(isSystemPromptId("system:lore_prompt"), true);
		assert.equal(isSystemPromptId("system:session_events"), true);
		assert.equal(isSystemPromptId("system:wizard_prompt"), true);

		assert.equal(isSystemPromptId("custom-prompt"), false);
		assert.equal(isSystemPromptId("system:unknown"), false);
	});

	it("retrieves system prompt items with metadata via getSystemPromptItem", () => {
		for (const systemId of SYSTEM_PROMPT_IDS) {
			const item = getSystemPromptItem(systemId);

			assert.ok(item);
			assert.equal(item.id, systemId);
			assert.equal(item.name, SYSTEM_PROMPT_DEFINITIONS[systemId].name);
			assert.equal(item.description, SYSTEM_PROMPT_DEFINITIONS[systemId].description);
			assert.equal(item.enabled, true);

			if (
				systemId === "system:world_prompt"
				|| systemId === "system:app_prompt"
				|| systemId === "system:character_prompt"
				|| systemId === "system:lore_prompt"
				|| systemId === "system:chapters_summary"
				|| systemId === "system:wizard_prompt"
				|| systemId === "system:semantic_directives"
			) {
				assert.equal(item.role, "system");
			}
			else if (
				systemId === "system:character_instances"
				|| systemId === "system:world_states"
				|| systemId === "system:session_events"
				|| systemId === "system:director_prompt"
			) {
				assert.equal(item.role, "user");
			}
			else {
				assert.equal(item.role, undefined);
			}
		}

		assert.equal(getSystemPromptItem("invalid_id" as SystemPromptId), null);
	});

	// Mutations: Add Prompt

	it("adds a user prompt to userPrompts and appends id to order", () => {
		const createdPrompt = addPrompt({
			name: "Character Background",
			description: "Backstory of the protagonist",
			content: "You are a seasoned rogue.",
			enabled: true,
		});

		assert.ok(createdPrompt.id);
		assert.equal(createdPrompt.name, "Character Background");
		assert.equal(createdPrompt.description, "Backstory of the protagonist");
		assert.equal(createdPrompt.content, "You are a seasoned rogue.");
		assert.equal(createdPrompt.enabled, true);
		assert.equal(createdPrompt.role, "user");

		const settings = getPromptSettings();

		assert.equal(settings.order.length, 13);
		assert.equal(settings.order[12], createdPrompt.id);
		assert.deepEqual(settings.userPrompts[createdPrompt.id], createdPrompt);
	});

	it("creates prompt with default empty fields when not provided", () => {
		const createdPrompt = addPrompt();

		assert.ok(createdPrompt.id);
		assert.equal(createdPrompt.name, "");
		assert.equal(createdPrompt.description, "");
		assert.equal(createdPrompt.content, "");
		assert.equal(createdPrompt.enabled, true);

		const settings = getPromptSettings();

		assert.equal(settings.userPrompts[createdPrompt.id].name, "");
		assert.equal(settings.userPrompts[createdPrompt.id].content, "");
	});

	it("supports custom id during creation when valid and unique", () => {
		const customIdPrompt = addPrompt({
			id: "custom-prompt-1",
			name: "Custom ID Prompt",
			content: "Custom Content",
		});

		assert.equal(customIdPrompt.id, "custom-prompt-1");

		const settings = getPromptSettings();

		assert.ok(settings.userPrompts["custom-prompt-1"]);
		assert.ok(settings.order.includes("custom-prompt-1"));
	});

	it("supports custom role during creation", () => {
		const customRolePrompt = addPrompt({
			id: "custom-system-prompt",
			name: "Custom System Prompt",
			content: "System instructions",
			role: "system",
		});

		assert.equal(customRolePrompt.role, "system");

		const settings = getPromptSettings();
		assert.equal(settings.userPrompts["custom-system-prompt"].role, "system");
	});

	// Mutations: Update Prompt

	it("updates an existing user prompt", () => {
		const prompt = addPrompt({
			name: "Initial Name",
			description: "Initial Desc",
			content: "Initial Content",
			enabled: true,
		});

		const updated = updatePrompt(prompt.id, {
			name: "Updated Name",
			content: "Updated Content",
			enabled: false,
		});

		assert.ok(updated);
		assert.equal(updated.id, prompt.id);
		assert.equal(updated.name, "Updated Name");
		assert.equal(updated.description, "Initial Desc");
		assert.equal(updated.content, "Updated Content");
		assert.equal(updated.enabled, false);

		const settings = getPromptSettings();

		assert.equal(settings.userPrompts[prompt.id].name, "Updated Name");
		assert.equal(settings.userPrompts[prompt.id].content, "Updated Content");
		assert.equal(settings.userPrompts[prompt.id].enabled, false);
	});

	it("returns null when updating non-existent user prompt", () => {
		const result = updatePrompt("non-existent-id", {
			name: "New Name",
		});

		assert.equal(result, null);
	});

	it("updates user prompt role via updatePrompt", () => {
		const prompt = addPrompt({
			name: "Role Prompt",
			content: "Initial Content",
		});

		assert.equal(prompt.role, "user");

		const updatedToSystem = updatePrompt(prompt.id, {
			role: "system",
		});

		assert.ok(updatedToSystem);
		assert.equal(updatedToSystem.role, "system");

		const settings = getPromptSettings();
		assert.equal(settings.userPrompts[prompt.id].role, "system");

		const updatedBackToUser = updatePrompt(prompt.id, {
			role: "user",
		});

		assert.ok(updatedBackToUser);
		assert.equal(updatedBackToUser.role, "user");
	});

	// System Prompt Protection and Toggles

	it("toggles enabled state of system prompt via updateSystemPrompt", () => {
		const toggleResult = updateSystemPrompt("system:world_states", { enabled: false });

		assert.equal(toggleResult, true);

		const settings = getPromptSettings();

		assert.equal(settings.systemPrompts["system:world_states"].enabled, false);
		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);

		const item = getSystemPromptItem("system:world_states");

		assert.ok(item);
		assert.equal(item.enabled, false);
	});

	it("updates system prompt role via updateSystemPromptRole", () => {
		const updateResult = updateSystemPromptRole("system:world_states", "system");

		assert.equal(updateResult, true);

		const settings = getPromptSettings();

		assert.equal(settings.systemPrompts["system:world_states"].role, "system");

		const item = getSystemPromptItem("system:world_states");

		assert.ok(item);
		assert.equal(item.role, "system");

		// Cannot update chat_history role
		const chatResult = updateSystemPromptRole("system:chat_history", "user");

		assert.equal(chatResult, false);

		// Invalid role or prompt id
		assert.equal(updateSystemPromptRole("custom_id" as SystemPromptId, "user"), false);
	});

	it("returns false when calling updateSystemPrompt with invalid system id", () => {
		const result = updateSystemPrompt("custom_id" as SystemPromptId, { enabled: false });

		assert.equal(result, false);
	});

	it("prevents updating system prompts via updatePrompt", () => {
		const result = updatePrompt("system:chat_history", {
			name: "Modified Name",
			content: "Modified Content",
		});

		assert.equal(result, null);
	});

	it("prevents deleting system prompts via deletePrompt", () => {
		for (const systemId of SYSTEM_PROMPT_IDS) {
			const result = deletePrompt(systemId);

			assert.equal(result, false);
		}

		const settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);
	});

	// Mutations: Delete Prompt

	it("deletes a user prompt from userPrompts and order", () => {
		const prompt = addPrompt({
			name: "To Delete",
			content: "Delete me",
		});

		let settings = getPromptSettings();

		assert.ok(settings.userPrompts[prompt.id]);
		assert.ok(settings.order.includes(prompt.id));

		const deleteResult = deletePrompt(prompt.id);

		assert.equal(deleteResult, true);

		settings = getPromptSettings();

		assert.equal(settings.userPrompts[prompt.id], undefined);
		assert.equal(settings.order.includes(prompt.id), false);
	});

	it("returns false when deleting non-existent prompt", () => {
		const deleteResult = deletePrompt("non-existent-id");

		assert.equal(deleteResult, false);
	});

	// Reordering Prompts

	it("reorders prompts up and down within unified order array", () => {
		const prompt1 = addPrompt({ name: "User 1" });
		const prompt2 = addPrompt({ name: "User 2" });

		// Initial order: app_prompt, world_prompt, character_prompt, lore_prompt, chapters_summary, chat_history, character_instances, world_states, session_events, director_prompt, wizard_prompt, prompt1, prompt2
		let settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
			prompt1.id,
			prompt2.id,
		]);

		// Move prompt1 up (swaps with wizard_prompt)
		const moveUpResult = reorderPrompt(prompt1.id, "up");

		assert.equal(moveUpResult, true);

		settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			prompt1.id,
			"system:wizard_prompt",
			prompt2.id,
		]);

		// Move system:lore_prompt down to swap with chapters_summary
		const moveDownResult = reorderPrompt("system:lore_prompt", "down");

		assert.equal(moveDownResult, true);

		settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:chapters_summary",
			"system:lore_prompt",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			prompt1.id,
			"system:wizard_prompt",
			prompt2.id,
		]);

		// Move prompt1 to the top (11 moves to go from index 11 to index 0)
		for (let i = 0; i < 11; i++) {
			reorderPrompt(prompt1.id, "up");
		}

		settings = getPromptSettings();

		assert.deepEqual(settings.order, [
			prompt1.id,
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:chapters_summary",
			"system:lore_prompt",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
			prompt2.id,
		]);
	});

	it("returns false and does not reorder when moving top item up or bottom item down", () => {
		const settings = getPromptSettings();
		const topItemId = settings.order[0];
		const bottomItemId = settings.order[settings.order.length - 1];

		const topUpResult = reorderPrompt(topItemId, "up");

		assert.equal(topUpResult, false);

		const bottomDownResult = reorderPrompt(bottomItemId, "down");

		assert.equal(bottomDownResult, false);

		const nonExistentResult = reorderPrompt("missing-id", "up");

		assert.equal(nonExistentResult, false);
	});

	// Subscriptions

	it("notifies listeners on mutations and supports unsubscribe", () => {
		let notificationCount = 0;

		const unsubscribe = subscribePromptSettings(() => {
			notificationCount += 1;
		});

		const prompt = addPrompt({ name: "Test" });

		assert.equal(notificationCount, 1);

		updatePrompt(prompt.id, { name: "Test Renamed" });

		assert.equal(notificationCount, 2);

		updateSystemPrompt("system:world_states", { enabled: false });

		assert.equal(notificationCount, 3);

		reorderPrompt(prompt.id, "up");

		assert.equal(notificationCount, 4);

		reorderPrompt(prompt.id, "up");

		assert.equal(notificationCount, 5);

		deletePrompt(prompt.id);

		assert.equal(notificationCount, 6);

		resetPromptSettings();

		assert.equal(notificationCount, 7);

		unsubscribe();

		addPrompt({ name: "After Unsubscribe" });

		assert.equal(notificationCount, 7);
	});

	// Reset

	it("resets settings to default preset", () => {
		const prompt = addPrompt({ name: "Custom Prompt" });

		updateSystemPrompt("system:world_states", { enabled: false });
		reorderPrompt(prompt.id, "up");

		const resetResult = resetPromptSettings();

		assert.deepEqual(resetResult.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);
		assert.deepEqual(resetResult.userPrompts, {});
		assert.equal(resetResult.systemPrompts["system:world_states"].enabled, true);

		const fetched = getPromptSettings();

		assert.deepEqual(fetched.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);
		assert.deepEqual(fetched.userPrompts, {});
	});

	// Fallback & Resilience

	it("handles corrupted or invalid storage data gracefully", () => {
		setPromptSettingsRawForTesting("INVALID_JSON{{}");

		let fallbackSettings: PromptSettings | undefined;

		assert.doesNotThrow(() => {
			fallbackSettings = getPromptSettings();
		});

		assert.ok(fallbackSettings);
		assert.deepEqual(fallbackSettings.order, [
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);
	});

	it("sanitizes partial stored object and ensures all system prompt ids are present", () => {
		savePromptSettings({
			order: ["custom_1"],
			userPrompts: {
				custom_1: {
					id: "custom_1",
					name: "Valid Prompt",
					description: "Description",
					content: "Content",
					enabled: true,
				},
				// Malformed item without id
				invalid: {
					id: "",
					name: "Invalid",
					description: "",
					content: "",
					enabled: true,
				},
			},
			systemPrompts: {
				"system:app_prompt": { enabled: true },
				"system:world_prompt": { enabled: true },
				"system:character_prompt": { enabled: true },
				"system:chapters_summary": { enabled: true },
				"system:director_prompt": { enabled: true },
				"system:chat_history": { enabled: true },
				"system:world_states": { enabled: false },
				"system:semantic_directives": { enabled: false },
				"system:character_instances": { enabled: true },
				"system:lore_prompt": { enabled: true, role: "user" },
				"system:session_events": { enabled: true, role: "user" },
				"system:wizard_prompt": { enabled: true, role: "system" },
			},
		});

		const settings = getPromptSettings();

		assert.equal(settings.userPrompts.custom_1.name, "Valid Prompt");
		assert.equal(settings.userPrompts.invalid, undefined);

		// Missing system prompt ids in order are appended
		assert.deepEqual(settings.order, [
			"custom_1",
			"system:app_prompt",
			"system:world_prompt",
			"system:character_prompt",
			"system:lore_prompt",
			"system:chapters_summary",
			"system:chat_history",
			"system:character_instances",
			"system:world_states",
			"system:semantic_directives",
			"system:session_events",
			"system:director_prompt",
			"system:wizard_prompt",
		]);

		assert.equal(settings.systemPrompts["system:world_states"].enabled, false);
	});

	it("provides a stable snapshot reference until mutations occur", () => {
		const snapshot1 = getPromptSettingsSnapshot();
		const snapshot2 = getPromptSettingsSnapshot();

		assert.equal(snapshot1, snapshot2);

		addPrompt({ name: "New Prompt" });

		const snapshot3 = getPromptSettingsSnapshot();

		assert.notEqual(snapshot1, snapshot3);
		assert.equal(Object.keys(snapshot3.userPrompts).length, 1);

		const snapshot4 = getPromptSettingsSnapshot();

		assert.equal(snapshot3, snapshot4);
	});

	// Migration of Legacy Settings

	it("migrates legacy settings schema containing before, after, and general sections", () => {
		const legacySettings = {
			before: [
				{
					id: "b1",
					name: "Before Prompt 1",
					description: "Before Desc",
					content: "Before Content",
					enabled: true,
				},
			],
			after: [
				{
					id: "default-response-formatting",
					name: "Response Formatting",
					description: "Default response prompt",
					content: APP_PROMPT,
					enabled: false,
				},
				{
					id: "a1",
					name: "After Prompt 1",
					description: "After Desc",
					content: "After Content",
					enabled: true,
				},
			],
			general: [
				{
					id: "g1",
					name: "General Prompt 1",
					description: "General Desc",
					content: "General Content",
					enabled: false,
				},
			],
		};

		setPromptSettingsRawForTesting(JSON.stringify(legacySettings));

		const migrated = getPromptSettings();

		assert.deepEqual(migrated.order, [
			"system:world_prompt",
			"system:character_prompt",
			"system:chapters_summary",
			"b1",
			"system:chat_history",
			"system:world_states",
			"system:semantic_directives",
			"system:character_instances",
			"system:lore_prompt",
			"system:session_events",
			"system:wizard_prompt",
			"system:app_prompt",
			"a1",
			"g1",
		]);

		assert.equal(migrated.userPrompts.b1.name, "Before Prompt 1");
		assert.equal(migrated.userPrompts.a1.name, "After Prompt 1");
		assert.equal(migrated.userPrompts.g1.name, "General Prompt 1");

		assert.equal(migrated.systemPrompts["system:app_prompt"].enabled, false);
		assert.equal(migrated.systemPrompts["system:world_prompt"].enabled, true);
		assert.equal(migrated.systemPrompts["system:character_prompt"].enabled, true);
		assert.equal(migrated.systemPrompts["system:chapters_summary"].enabled, true);
		assert.equal(migrated.systemPrompts["system:chat_history"].enabled, true);
		assert.equal(migrated.systemPrompts["system:world_states"].enabled, true);
		assert.equal(migrated.systemPrompts["system:character_instances"].enabled, true);
		assert.equal(migrated.systemPrompts["system:session_events"].enabled, true);
	});

	// Session States Prompt Formatting

	describe("formatSessionStatesPrompt", () => {

		it("returns null when states is undefined or null", () => {
			assert.equal(formatSessionStatesPrompt(undefined), null);
			assert.equal(formatSessionStatesPrompt(null), null);
		});

		it("returns null when states is an empty object", () => {
			assert.equal(formatSessionStatesPrompt({}), null);
		});

		it("formats active states into key-value Markdown list with header", () => {
			const states = {
				player_location: "Cyberspace Station",
				security_level: 4,
				is_alarm_active: true,
				inventory: ["deck", "keycard", "datapad"],
			};

			const result = formatSessionStatesPrompt(states);

			const expected = [
				"Current Session State:",
				"- player_location: Cyberspace Station",
				"- security_level: 4",
				"- is_alarm_active: true",
				"- inventory: [deck, keycard, datapad]",
			].join("\n");

			assert.equal(result, expected);
		});

	});

	// Chat Prompt Context Assembly

	describe("assembleChatPromptMessages", () => {

		it("assembles default context with session messages and system prompts", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello world" },
			];

			const assembled = assembleChatPromptMessages(sessionMessages);

			assert.equal(assembled.length, 2);
			assert.deepEqual(assembled[0], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembled[1], { role: "user", content: "Hello world" });
		});

		it("assembles messages strictly following custom order sequence", () => {
			const customSettings: PromptSettings = {
				order: [
					"u1",
					"system:chat_history",
					"system:world_states",
					"u2",
					"system:app_prompt",
					"u3",
				],
				userPrompts: {
					u1: {
						id: "u1",
						name: "Prompt 1",
						description: "",
						content: "System Rule 1",
						enabled: true,
						role: "system",
					},
					u2: {
						id: "u2",
						name: "Prompt 2",
						description: "",
						content: "User Rule 2",
						enabled: true,
						role: "user",
					},
					u3: {
						id: "u3",
						name: "Prompt 3",
						description: "",
						content: "System Rule 3",
						enabled: true,
						role: "system",
					},
				},
				systemPrompts: {
					"system:app_prompt": { enabled: true, role: "system" },
					"system:world_prompt": { enabled: true, role: "system" },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: true, role: "user" },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Chat message 1" },
				{ role: "assistant", content: "Chat message 2" },
			];

			const states = { location: "Command Bridge" };

			const assembled = assembleChatPromptMessages(sessionMessages, customSettings, states);

			assert.equal(assembled.length, 7);
			assert.deepEqual(assembled[0], { role: "system", content: "System Rule 1" });
			assert.deepEqual(assembled[1], { role: "user", content: "Chat message 1" });
			assert.deepEqual(assembled[2], { role: "assistant", content: "Chat message 2" });
			assert.deepEqual(assembled[3], {
				role: "user",
				content: "Current Session State:\n- location: Command Bridge",
			});
			assert.deepEqual(assembled[4], { role: "user", content: "User Rule 2" });
			assert.deepEqual(assembled[5], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembled[6], { role: "system", content: "System Rule 3" });
		});

		it("skips disabled user prompts and disabled system prompts without changing order", () => {
			const customSettings: PromptSettings = {
				order: [
					"u1",
					"system:chat_history",
					"system:world_states",
					"system:app_prompt",
				],
				userPrompts: {
					u1: {
						id: "u1",
						name: "Prompt 1",
						description: "",
						content: "System Rule 1",
						enabled: false,
					},
				},
				systemPrompts: {
					"system:app_prompt": { enabled: false },
					"system:world_prompt": { enabled: false },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Test" },
			];

			const states = { hp: 100 };

			const assembled = assembleChatPromptMessages(sessionMessages, customSettings, states);

			assert.equal(assembled.length, 1);
			assert.deepEqual(assembled[0], { role: "user", content: "Test" });
		});

		it("omits empty or whitespace-only user prompt content", () => {
			const customSettings: PromptSettings = {
				order: ["u1", "u2", "system:chat_history"],
				userPrompts: {
					u1: {
						id: "u1",
						name: "Empty Prompt",
						description: "",
						content: "   ",
						enabled: true,
					},
					u2: {
						id: "u2",
						name: "Valid Prompt",
						description: "",
						content: "Non-empty content",
						enabled: true,
					},
				},
				systemPrompts: {
					"system:app_prompt": { enabled: true },
					"system:world_prompt": { enabled: true },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: true },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const assembled = assembleChatPromptMessages([], customSettings);

			assert.equal(assembled.length, 1);
			assert.deepEqual(assembled[0], { role: "user", content: "Non-empty content" });
		});

		it("does not inject state system message when states is empty or null", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello" },
			];

			const assembledNull = assembleChatPromptMessages(sessionMessages, undefined, null);

			assert.equal(assembledNull.length, 2);
			assert.deepEqual(assembledNull[0], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembledNull[1], { role: "user", content: "Hello" });

			const assembledEmpty = assembleChatPromptMessages(sessionMessages, undefined, {});

			assert.equal(assembledEmpty.length, 2);
			assert.deepEqual(assembledEmpty[0], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembledEmpty[1], { role: "user", content: "Hello" });
		});

		it("injects states when chat history is empty", () => {
			const states = {
				location: "Tavern",
			};

			const assembled = assembleChatPromptMessages([], undefined, states);

			assert.equal(assembled.length, 2);
			assert.deepEqual(assembled[0], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembled[1], {
				role: "user",
				content: "Current Session State:\n- location: Tavern",
			});
		});

		it("formats system:world_prompt when provided", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello" },
			];

			const assembled = assembleChatPromptMessages(
				sessionMessages,
				undefined,
				undefined,
				"You are in a fantasy world.",
			);

			assert.equal(assembled.length, 3);
			assert.deepEqual(assembled[0], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembled[1], {
				role: "system",
				content: "You are in a fantasy world.",
			});
			assert.deepEqual(assembled[2], { role: "user", content: "Hello" });
		});

		it("formats character prompt after world prompt and character instances before world states", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello" },
			];
			const states = { alert: "none" };
			const characterPrompt = "Dr. Elena Vance profile";
			const characterInstances = "Dr. Elena Vance thoughts and emotions";

			const assembled = assembleChatPromptMessages(
				sessionMessages,
				undefined,
				states,
				"World context instructions",
				characterPrompt,
				characterInstances,
			);

			assert.equal(assembled.length, 6);
			// 1. app_prompt
			assert.deepEqual(assembled[0], { role: "system", content: APP_PROMPT });
			// 2. world_prompt
			assert.deepEqual(assembled[1], {
				role: "system",
				content: "World context instructions",
			});
			// 3. character_prompt
			assert.deepEqual(assembled[2], {
				role: "system",
				content: "Dr. Elena Vance profile",
			});
			// 4. chat_history
			assert.deepEqual(assembled[3], { role: "user", content: "Hello" });
			// 5. character_instances
			assert.deepEqual(assembled[4], {
				role: "user",
				content: "Dr. Elena Vance thoughts and emotions",
			});
			// 6. world_states
			assert.deepEqual(assembled[5], {
				role: "user",
				content: "Current Session State:\n- alert: none",
			});
		});

		it("injects session events after chat history", () => {
			const settings: PromptSettings = {
				order: ["system:chat_history", "system:session_events"],
				userPrompts: {},
				systemPrompts: {
					"system:app_prompt": { enabled: false },
					"system:world_prompt": { enabled: false },
					"system:character_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:session_events": { enabled: true, role: "user" },
					"system:wizard_prompt": { enabled: true, role: "system" },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
				},
			};

			const assembled = assembleChatPromptMessages(
				[{ role: "user", content: "The gate opens." }],
				settings,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				[
					{
						id: "evt-1",
						timestamp: 1,
						type: "narrative",
						summary: "The gate opens.",
						details: "A blue light fills the corridor.",
					},
				],
			);

			assert.deepEqual(assembled, [
				{ role: "user", content: "The gate opens." },
				{
					role: "user",
					content: "Session Events:\n- [narrative] The gate opens. - A blue light fills the corridor.",
				},
			]);
		});

		it("injects compacted chapter summaries before chat history", () => {
			const settings: PromptSettings = {
				order: ["system:chapters_summary", "system:director_prompt", "system:chat_history"],
				userPrompts: {},
				systemPrompts: {
					"system:app_prompt": { enabled: false },
					"system:world_prompt": { enabled: false },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: true, role: "system" },
					"system:director_prompt": { enabled: true, role: "system" },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: false },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const assembled = assembleChatPromptMessages(
				[{ role: "user", content: "Continue." }],
				settings,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				[
					{
						id: "chapter-1",
						title: "The Open Gate",
						summary: "The party entered the corridor.",
						eventIds: ["evt-1"],
						createdAt: 1,
					},
				],
				true,
			);

			assert.deepEqual(assembled, [
				{
					role: "system",
					content: "Previous Chapters Summary:\n\n### The Open Gate\n\nThe party entered the corridor.",
				},
				{ role: "user", content: "Continue." },
			]);
		});

		it("formats system:world_prompt with configured user role", () => {
			const customSettings: PromptSettings = {
				order: [
					"system:world_prompt",
					"system:app_prompt",
					"system:chat_history",
				],
				userPrompts: {},
				systemPrompts: {
					"system:world_prompt": { enabled: true, role: "user" },
					"system:app_prompt": { enabled: true, role: "system" },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:semantic_directives": { enabled: false },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello" },
			];

			const assembled = assembleChatPromptMessages(
				sessionMessages,
				customSettings,
				undefined,
				"World context instructions",
			);

			assert.equal(assembled.length, 3);
			assert.deepEqual(assembled[0], {
				role: "user",
				content: "World context instructions",
			});
			assert.deepEqual(assembled[1], { role: "system", content: APP_PROMPT });
			assert.deepEqual(assembled[2], { role: "user", content: "Hello" });
		});

		it("injects default response prompt when system:app_prompt is enabled", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Test query" },
			];

			const assembled = assembleChatPromptMessages(sessionMessages);
			const responseFormatMessage = assembled.find(
				msg => msg.role === "system" && msg.content === APP_PROMPT,
			);

			assert.ok(responseFormatMessage);
		});

		it("omits default response prompt when system:app_prompt is disabled", () => {
			const customSettings: PromptSettings = {
				order: [
					"system:chat_history",
					"system:app_prompt",
				],
				userPrompts: {},
				systemPrompts: {
					"system:app_prompt": { enabled: false },
					"system:world_prompt": { enabled: false },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Test query" },
			];

			const assembled = assembleChatPromptMessages(sessionMessages, customSettings);
			const responseFormatMessage = assembled.find(
				msg => msg.role === "system" && msg.content === APP_PROMPT,
			);

			assert.equal(responseFormatMessage, undefined);
		});

		it("formats system:app_prompt with configured user role", () => {
			const customSettings: PromptSettings = {
				order: [
					"system:app_prompt",
					"system:chat_history",
				],
				userPrompts: {},
				systemPrompts: {
					"system:world_prompt": { enabled: false },
					"system:app_prompt": { enabled: true, role: "user" },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Hello" },
			];

			const assembled = assembleChatPromptMessages(sessionMessages, customSettings);
			assert.equal(assembled.length, 2);
			assert.deepEqual(assembled[0], { role: "user", content: APP_PROMPT });
			assert.deepEqual(assembled[1], { role: "user", content: "Hello" });
		});

		it("defaults legacy user prompt without role to user role during assembly", () => {
			const customSettings: PromptSettings = {
				order: [
					"legacy-prompt",
					"system:chat_history",
				],
				userPrompts: {
					"legacy-prompt": {
						id: "legacy-prompt",
						name: "Legacy Prompt",
						content: "Legacy content without role property",
						enabled: true,
					} as any,
				},
				systemPrompts: {
					"system:world_prompt": { enabled: false },
					"system:app_prompt": { enabled: false },
					"system:character_prompt": { enabled: false },
					"system:chapters_summary": { enabled: false },
					"system:director_prompt": { enabled: false },
					"system:chat_history": { enabled: true },
					"system:world_states": { enabled: false },
					"system:semantic_directives": { enabled: false },
					"system:character_instances": { enabled: false },
					"system:lore_prompt": { enabled: true, role: "user" },
					"system:session_events": { enabled: false },
					"system:wizard_prompt": { enabled: false },
				},
			};

			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Query" },
			];

			const assembled = assembleChatPromptMessages(sessionMessages, customSettings);
			assert.equal(assembled.length, 2);
			assert.deepEqual(assembled[0], {
				role: "user",
				content: "Legacy content without role property",
			});
			assert.deepEqual(assembled[1], { role: "user", content: "Query" });
		});

		it("injects static lore entries into assembled messages", () => {
			const lorebook: LoreBook = {
				id: "lb_test_static",
				name: "Static Lorebook",
				entries: [
					{
						id: "entry_1",
						title: "Capital City",
						content: "Aetheria is the grand capital.",
						keywords: [],
						activationMode: "static",
						enabled: true,
					},
					{
						id: "entry_2",
						title: "Dragon Lore",
						content: "Dragons breath fire.",
						keywords: ["dragon"],
						activationMode: "dynamic",
						enabled: true,
					},
				],
			};

			saveLoreBook(lorebook, "lb_test_static");

			try {
				const sessionMessages: ChatCompletionMessageParam[] = [
					{ role: "user", content: "Hello world" },
				];

				const assembled = assembleChatPromptMessages(
					sessionMessages,
					undefined,
					null,
					null,
					null,
					null,
					"lb_test_static",
				);

				const loreMsg = assembled.find(m => typeof m.content === "string" && m.content.includes("Aetheria"));
				assert.ok(loreMsg, "Static lore entry should be present in assembled prompt");
				assert.ok(!String(loreMsg?.content ?? "").includes("Dragons breath fire"), "Dynamic lore without keyword should not be present");
			}
			finally {
				deleteLoreBook("lb_test_static");
			}
		});

		it("activates dynamic lore entries matching latest user message from session messages", () => {
			const lorebook: LoreBook = {
				id: "lb_test_dynamic",
				name: "Dynamic Lorebook",
				entries: [
					{
						id: "entry_dragon",
						title: "Dragon Lore",
						content: "Dragons hoard gold.",
						keywords: ["dragon"],
						activationMode: "dynamic",
						enabled: true,
					},
				],
			};

			saveLoreBook(lorebook, "lb_test_dynamic");

			try {
				const sessionMessages: ChatCompletionMessageParam[] = [
					{ role: "user", content: "Tell me about the dragon in the mountain" },
				];

				const assembled = assembleChatPromptMessages(
					sessionMessages,
					undefined,
					null,
					null,
					null,
					null,
					"lb_test_dynamic",
				);

				const loreMsg = assembled.find(m => typeof m.content === "string" && m.content.includes("Dragons hoard gold"));
				assert.ok(loreMsg, "Dynamic lore matching keyword in user message should be present");
			}
			finally {
				deleteLoreBook("lb_test_dynamic");
			}
		});

		it("activates dynamic lore entries when currentMessage is passed explicitly", () => {
			const lorebook: LoreBook = {
				id: "lb_test_explicit",
				name: "Explicit Message Lorebook",
				entries: [
					{
						id: "entry_wizard",
						title: "Wizard Lore",
						content: "Wizards cast ancient spells.",
						keywords: ["wizard", "mage"],
						activationMode: "dynamic",
						enabled: true,
					},
				],
			};

			saveLoreBook(lorebook, "lb_test_explicit");

			try {
				const sessionMessages: ChatCompletionMessageParam[] = [];

				const assembled = assembleChatPromptMessages(
					sessionMessages,
					undefined,
					null,
					null,
					null,
					null,
					"lb_test_explicit",
					"I seek the wise wizard",
				);

				const loreMsg = assembled.find(m => typeof m.content === "string" && m.content.includes("Wizards cast ancient spells"));
				assert.ok(loreMsg, "Dynamic lore matching explicit currentMessage should be present");
			}
			finally {
				deleteLoreBook("lb_test_explicit");
			}
		});

		it("omits lore prompt when lorebookId is undefined or system:lore_prompt is disabled", () => {
			const lorebook: LoreBook = {
				id: "lb_test_disabled",
				name: "Disabled Lorebook",
				entries: [
					{
						id: "entry_static",
						title: "Always Active",
						content: "Should not appear when disabled.",
						keywords: [],
						activationMode: "static",
						enabled: true,
					},
				],
			};

			saveLoreBook(lorebook, "lb_test_disabled");

			try {
				// 1. Without lorebookId
				const assembledNoId = assembleChatPromptMessages([
					{ role: "user", content: "Hello" },
				]);
				const loreMsg1 = assembledNoId.find(m => typeof m.content === "string" && m.content.includes("Should not appear"));
				assert.equal(loreMsg1, undefined);

				// 2. With lorebookId but disabled setting
				const customSettings: PromptSettings = {
					...getPromptSettings(),
					systemPrompts: {
						...getPromptSettings().systemPrompts,
						"system:lore_prompt": { enabled: false },
					},
				};

				const assembledDisabled = assembleChatPromptMessages(
					[{ role: "user", content: "Hello" }],
					customSettings,
					null,
					null,
					null,
					null,
					"lb_test_disabled",
				);
				const loreMsg2 = assembledDisabled.find(m => typeof m.content === "string" && m.content.includes("Should not appear"));
				assert.equal(loreMsg2, undefined);
			}
			finally {
				deleteLoreBook("lb_test_disabled");
			}
		});

		it("formats semantic directives prompt block correctly", () => {
			assert.equal(formatSemanticDirectivesPrompt(null), null);
			assert.equal(formatSemanticDirectivesPrompt([]), null);

			const formatted = formatSemanticDirectivesPrompt([
				"The investigator perceives reality accurately and speaks calmly.",
				"Review case files before entering the manor.",
			]);

			assert.ok(formatted);
			assert.ok(formatted.includes("Active Behavioral Directives and Constraints:"));
			assert.ok(formatted.includes("- The investigator perceives reality accurately and speaks calmly."));
			assert.ok(formatted.includes("- Review case files before entering the manor."));
		});

		it("assembles semantic directives block into prompt messages", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "What do we do now?" },
			];
			const directives = [
				"Do not mention the occult directly.",
			];

			const assembled = assembleChatPromptMessages(
				sessionMessages,
				undefined,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				directives,
			);

			const directiveMsg = assembled.find(
				m => typeof m.content === "string" && m.content.includes("Do not mention the occult directly."),
			);
			assert.ok(directiveMsg);
			assert.equal(directiveMsg.role, "system");
		});

		it("automatically extracts semantic directives from blueprints and states during assembly", () => {
			const sessionMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Look around." },
			];
			const states = { sanity: 80, phase: "briefing" };
			const blueprints = {
				gauges: [
					{
						key: "sanity",
						min: 0,
						max: 100,
						defaultValue: 100,
						tiers: [
							{
								id: "lucid",
								label: "Lucid",
								min: 70,
								max: 100,
								directive: "Maintain logical reasoning.",
							},
						],
					},
				],
				stateMachines: [
					{
						key: "phase",
						initialState: "briefing",
						states: {
							briefing: { directive: "Prepare investigation kit." },
						},
						transitions: [],
					},
				],
			};

			const assembled = assembleChatPromptMessages(
				sessionMessages,
				undefined,
				states,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				blueprints,
			);

			const directiveMsg = assembled.find(
				m => typeof m.content === "string" && m.content.includes("Maintain logical reasoning."),
			);
			assert.ok(directiveMsg);
			assert.ok((directiveMsg.content as string).includes("Prepare investigation kit."));
		});

		it("evaluates choice option gating with flags and items", () => {
			// 1. Missing required flag
			const optionWithFlag = {
				id: "opt-1",
				text: "Unlock the iron gate",
				requiredFlags: ["found_key_flag"],
			};
			const gatingNoFlag = evaluateChoiceOptionGating(optionWithFlag, {});
			assert.equal(gatingNoFlag.isLocked, true);
			assert.equal(gatingNoFlag.lockReason, "Requires flag: found_key_flag");

			// 2. Active required flag
			const gatingWithFlag = evaluateChoiceOptionGating(optionWithFlag, { found_key_flag: true });
			assert.equal(gatingWithFlag.isLocked, false);

			// 3. Missing required item
			const optionWithItem = {
				id: "opt-2",
				text: "Open the safe",
				requiredItems: ["brass_key"],
			};
			const gatingNoItem = evaluateChoiceOptionGating(optionWithItem, { backpack: ["lantern"] });
			assert.equal(gatingNoItem.isLocked, true);
			assert.equal(gatingNoItem.lockReason, "Requires item: brass_key");

			// 4. Active required item in inventory array
			const gatingWithItem = evaluateChoiceOptionGating(optionWithItem, { backpack: ["brass_key"] });
			assert.equal(gatingWithItem.isLocked, false);

			// 5. Explicit locked option
			const lockedOption = {
				id: "opt-3",
				text: "Secret ritual",
				locked: true,
				lockReason: "Requires ancient knowledge",
			};
			const gatingLocked = evaluateChoiceOptionGating(lockedOption, {});
			assert.equal(gatingLocked.isLocked, true);
			assert.equal(gatingLocked.lockReason, "Requires ancient knowledge");
		});

	});

});
