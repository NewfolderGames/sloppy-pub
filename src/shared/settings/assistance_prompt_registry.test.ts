import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { addAssistancePrompt, clearAssistancePromptSettingsMemory, deleteAssistancePrompt, getAssistancePromptSettings, getEnabledAssistancePrompts, reorderAssistancePrompt, resetAssistancePromptSettings, setAssistancePromptSettingsRawForTesting, subscribeAssistancePromptSettings, updateAssistancePrompt } from "./assistance_prompt_registry.ts";

describe("Assistance Prompt Registry", () => {

	beforeEach(() => {
		clearAssistancePromptSettingsMemory();
		resetAssistancePromptSettings();
	});

	it("initializes with default assistance prompts", () => {
		const settings = getAssistancePromptSettings();

		assert.ok(settings.order.length > 0);
		const defaultPrompt = settings.prompts[settings.order[0]];
		assert.ok(defaultPrompt);
		assert.strictEqual(defaultPrompt.enabled, true);
	});

	it("adds a new assistance prompt", () => {
		const created = addAssistancePrompt("Plot Generator", "Generate intricate plot twists.");
		const settings = getAssistancePromptSettings();

		assert.strictEqual(created.name, "Plot Generator");
		assert.strictEqual(created.content, "Generate intricate plot twists.");
		assert.strictEqual(created.enabled, true);
		assert.ok(settings.order.includes(created.id));
		assert.deepStrictEqual(settings.prompts[created.id], created);
	});

	it("updates an existing assistance prompt", () => {
		const created = addAssistancePrompt("Original Name", "Original Content");

		updateAssistancePrompt(created.id, {
			name: "Updated Name",
			content: "Updated Content",
			enabled: false,
		});

		const settings = getAssistancePromptSettings();
		const updated = settings.prompts[created.id];

		assert.strictEqual(updated.name, "Updated Name");
		assert.strictEqual(updated.content, "Updated Content");
		assert.strictEqual(updated.enabled, false);
	});

	it("deletes an assistance prompt and removes it from order", () => {
		const prompt1 = addAssistancePrompt("Prompt 1", "Content 1");
		const prompt2 = addAssistancePrompt("Prompt 2", "Content 2");

		deleteAssistancePrompt(prompt1.id);
		const settings = getAssistancePromptSettings();

		assert.strictEqual(settings.prompts[prompt1.id], undefined);
		assert.ok(!settings.order.includes(prompt1.id));
		assert.ok(settings.order.includes(prompt2.id));
	});

	it("reorders assistance prompts", () => {
		const prompt1 = addAssistancePrompt("Alpha", "Content Alpha");
		const prompt2 = addAssistancePrompt("Beta", "Content Beta");

		const initialSettings = getAssistancePromptSettings();
		const idxAlpha = initialSettings.order.indexOf(prompt1.id);
		const idxBeta = initialSettings.order.indexOf(prompt2.id);

		reorderAssistancePrompt(idxAlpha, idxBeta);
		const reorderedSettings = getAssistancePromptSettings();

		const newIdxAlpha = reorderedSettings.order.indexOf(prompt1.id);
		const newIdxBeta = reorderedSettings.order.indexOf(prompt2.id);

		assert.ok(newIdxAlpha > newIdxBeta);
	});

	it("notifies subscribers when settings change", () => {
		let callCount = 0;
		const unsubscribe = subscribeAssistancePromptSettings(() => {
			callCount++;
		});

		addAssistancePrompt("Subscriber Test", "Checking notifications");
		assert.strictEqual(callCount, 1);

		unsubscribe();
		addAssistancePrompt("Second Test", "Should not increment");
		assert.strictEqual(callCount, 1);
	});

	it("recovers gracefully from corrupted storage payload", () => {
		setAssistancePromptSettingsRawForTesting("not valid json");
		const settings = getAssistancePromptSettings();

		assert.ok(settings.order.length > 0);
		assert.ok(settings.prompts[settings.order[0]]);
	});

	it("retrieves only enabled assistance prompts with non-empty content", () => {
		clearAssistancePromptSettingsMemory();
		resetAssistancePromptSettings();

		const enabledPrompt = addAssistancePrompt("Active", "Active instruction");
		const disabledPrompt = addAssistancePrompt("Inactive", "Inactive instruction");
		updateAssistancePrompt(disabledPrompt.id, { enabled: false });

		const emptyPrompt = addAssistancePrompt("Empty", "   ");

		const enabledList = getEnabledAssistancePrompts();
		const ids = enabledList.map(item => item.id);

		assert.ok(ids.includes(enabledPrompt.id));
		assert.ok(!ids.includes(disabledPrompt.id));
		assert.ok(!ids.includes(emptyPrompt.id));
	});

});
