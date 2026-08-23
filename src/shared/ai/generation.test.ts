import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saveWorldfile } from "../world/registry.ts";
import type { Worldfile } from "../world/types.ts";
import { buildGenerationPrompt } from "./generation.ts";

describe("Feeling Lucky Instance Generation", () => {
	const testWorld: Worldfile = {
		metadata: {
			name: "gen-test-world",
			title: "Generation Test World",
			authors: ["Tester"],
			version: "1.0.0",
			description: "World for testing lucky generation",
		},
		content: {
			description: "World setting description",
			guidelines: ["Guideline 1"],
			backgrounds: ["Background 1"],
			settings: {
				rules: ["Rule 1"],
			},
		},
		vars: [
			{ name: "difficulty", type: "text", default: "normal" },
			{ name: "maxPlayers", type: "number", default: 4 },
			{ name: "hardcore", type: "boolean", default: false },
		],
		states: {},
	};

	saveWorldfile(testWorld, testWorld.metadata.name);

	it("builds prompt with world info and variable descriptions", () => {
		const prompt = buildGenerationPrompt({
			worldId: "gen-test-world",
			vars: {
				difficulty: { name: "difficulty", type: "text", default: "normal" },
				maxPlayers: { name: "maxPlayers", type: "number", default: 4 },
			},
		});

		assert.ok(prompt.includes("Generation Test World"));
		assert.ok(prompt.includes("difficulty"));
		assert.ok(prompt.includes("maxPlayers"));
	});
});
