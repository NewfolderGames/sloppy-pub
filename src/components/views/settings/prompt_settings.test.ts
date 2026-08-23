import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { addPrompt, getPromptSettings, getSystemPromptItem, resetPromptSettings, updatePrompt, updateSystemPromptRole } from "../../../shared/settings/prompt_registry.ts";
import type { SystemPromptId } from "../../../shared/settings/types.ts";

describe("Prompt role configuration and settings UI integration", () => {

	beforeEach(() => {
		resetPromptSettings();
	});

	test("updates role on custom user prompt", () => {
		const created = addPrompt({ name: "Custom", content: "Hello" });

		assert.strictEqual(created.role, "user");

		const updated = updatePrompt(created.id, { role: "system" });

		assert.ok(updated);
		assert.strictEqual(updated?.role, "system");

		const settings = getPromptSettings();

		assert.strictEqual(settings.userPrompts[created.id]?.role, "system");
	});

	test("updates role on eligible system prompts", () => {
		const eligibleIds: SystemPromptId[] = [
			"system:world_prompt",
			"system:app_prompt",
			"system:world_states",
		];

		for (const id of eligibleIds) {
			const initial = getSystemPromptItem(id);

			assert.ok(initial);

			const newRole = initial?.role === "system" ? "user" : "system";
			const updated = updateSystemPromptRole(id, newRole);

			assert.strictEqual(updated, true);

			const after = getSystemPromptItem(id);

			assert.strictEqual(after?.role, newRole);
		}
	});

	test("rejects role update for system:chat_history", () => {
		const result = updateSystemPromptRole("system:chat_history", "user");

		assert.strictEqual(result, false);

		const item = getSystemPromptItem("system:chat_history");

		assert.strictEqual(item?.role, undefined);
	});

	test("system prompt role eligibility matches UI criteria", () => {
		const isEligibleForRoleControl = (id: SystemPromptId) => id !== "system:chat_history";

		assert.strictEqual(isEligibleForRoleControl("system:world_prompt"), true);
		assert.strictEqual(isEligibleForRoleControl("system:app_prompt"), true);
		assert.strictEqual(isEligibleForRoleControl("system:world_states"), true);
		assert.strictEqual(isEligibleForRoleControl("system:chat_history"), false);
	});

});
