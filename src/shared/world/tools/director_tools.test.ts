import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeDirectorTool } from "./director_tools.ts";
import { initializeDirector } from "../../session/director.ts";

describe("Director Tools", () => {
	it("should execute director_think", () => {
		const state = initializeDirector({ enabled: true });
		const result = executeDirectorTool("director_think", { thought: "New thought" }, state);
		assert.equal(result.status, "success");
		assert.equal(state.thoughts.length, 1);
		assert.equal(state.thoughts[0], "New thought");
	});

	it("should execute director_plan", () => {
		const state = initializeDirector({ enabled: true });
		const result = executeDirectorTool("director_plan", { plan: "New plan" }, state);
		assert.equal(result.status, "success");
		assert.equal(state.plans.length, 1);
		assert.equal(state.plans[0], "New plan");
	});

	it("should execute director_steer", () => {
		const state = initializeDirector({ enabled: true });
		const result = executeDirectorTool("director_steer", { instructions: "New steering" }, state);
		assert.equal(result.status, "success");
		assert.equal(state.instructions, "New steering");
	});
});
