import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDirectorPrompt, initializeDirector, updateDirectorPlan, updateDirectorThought } from "./director.ts";

describe("Director System", () => {
	it("should initialize with default state", () => {
		const state = initializeDirector();
		assert.equal(state.enabled, false);
		assert.equal(state.thoughts.length, 0);
		assert.equal(state.plans.length, 0);
		assert.ok(state.instructions.length > 0);
	});

	it("should cap thoughts and plans at 10 items", () => {
		const state = initializeDirector({ enabled: true });
		for (let i = 0; i < 15; i++) {
			updateDirectorThought(state, `Thought ${i}`);
			updateDirectorPlan(state, `Plan ${i}`);
		}
		assert.equal(state.thoughts.length, 10);
		assert.equal(state.plans.length, 10);
		assert.equal(state.thoughts[0], "Thought 5");
		assert.equal(state.plans[0], "Plan 5");
	});

	it("should build prompt correctly when enabled", () => {
		const state = initializeDirector({ enabled: true, instructions: "Test instructions" });
		updateDirectorThought(state, "Thought 1");
		updateDirectorPlan(state, "Plan 1");
		const prompt = buildDirectorPrompt(state);
		assert.ok(prompt.includes("# Director Guideline"));
		assert.ok(prompt.includes("Test instructions"));
		assert.ok(prompt.includes("- Thought 1"));
		assert.ok(prompt.includes("- Plan 1"));
	});

	it("should return empty string when disabled", () => {
		const state = initializeDirector({ enabled: false });
		const prompt = buildDirectorPrompt(state);
		assert.equal(prompt, "");
	});
});
