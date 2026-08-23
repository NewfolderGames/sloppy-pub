import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Characterfile } from "../character/types.ts";
import type { LoreBook } from "../lore/types.ts";
import { createWorldInstance } from "../world/instance_manager.ts";
import { saveWorldfile } from "../world/registry.ts";
import type { Universefile, Worldfile } from "../world/types.ts";
import { buildFieldGenerationPrompt, generateFieldContent, preprocessFeelingLucky } from "./feeling_lucky.ts";

describe("Feeling Lucky field generation", () => {

	it("builds a prompt with template type, field name, context, and current value", () => {
		const prompt = buildFieldGenerationPrompt({
			templateType: "character",
			fieldName: "summary",
			context: {
				title: "Aria Vale",
				tags: ["investigator"],
			},
			currentValue: "A quiet detective.",
		});

		assert.ok(prompt.includes("Template type: character"));
		assert.ok(prompt.includes("Field name: summary"));
		assert.ok(prompt.includes("Aria Vale"));
		assert.ok(prompt.includes("A quiet detective."));
	});

	it("returns generated plain text from llmCall", async () => {
		const result = await generateFieldContent({
			templateType: "world",
			fieldName: "backgrounds",
			llmCall: async () => "Rain-soaked neon alleys hide black-market clinics.",
		});

		assert.strictEqual(result, "Rain-soaked neon alleys hide black-market clinics.");
	});

	it("extracts content from JSON schema style responses", async () => {
		const result = await generateFieldContent({
			templateType: "lore",
			fieldName: "content",
			llmCall: async () => JSON.stringify({
				content: "The Obsidian Gate opens only at midnight.",
			}),
		});

		assert.strictEqual(result, "The Obsidian Gate opens only at midnight.");
	});

	it("falls back to current value when generation fails", async () => {
		const result = await generateFieldContent({
			templateType: "universe",
			fieldName: "rules",
			currentValue: "Gravity always pulls downward.",
			llmCall: async () => {
				throw new Error("network down");
			},
		});

		assert.strictEqual(result, "Gravity always pulls downward.");
	});

	it("preprocesses checked feeling lucky fields across world, universe, characters, and lore", async () => {
		const sampleWorld: Worldfile = {
			metadata: {
				name: "cyber_world",
				version: "1.0.0",
				title: "Cyber World",
				description: "A dark neon city.",
			},
			content: {
				backgrounds: ["Old placeholder background", "Static second background"],
				guidelines: [],
				settings: {
					rules: ["Magic is strictly forbidden.", "Laws of physics apply."],
					guidelines: ["Be dramatic."],
				},
				plot: {
					intro: {
						mode: "random",
						list: [
							{ value: "Old intro scenario", feelingLucky: true },
						],
					},
				},
				feeling_lucky: {
					backgrounds: [0],
					rules: [0],
				},
			},
		};

		const sampleUniverse: Universefile = {
			metadata: {
				name: "uni_test",
				version: "1.0.0",
				title: "Uni Test",
				description: "The cosmos.",
			},
			settings: {
				rules: ["Old universe rule"],
				backgrounds: ["Old cosmic background"],
				feeling_lucky: {
					rules: [0],
					backgrounds: [0],
				},
			},
			states: {},
		};

		const sampleCharacter: Characterfile = {
			metadata: {
				name: "char_eva",
				version: "1.0.0",
				title: "Eva Lin",
				description: "Hacker.",
			},
			summary: "Old summary",
			summary_lucky: true,
			physical_characteristics: [
				{ name: "Eyes", description: "Brown", feelingLucky: true },
			],
			linguistic_patterns: [],
			psychology_and_worldviews: [],
			lifestyle_and_preferences: [],
			desires: [],
			skills: [],
			backgrounds: [
				{ name: "Origin", content: "Born in district 9", feelingLucky: true },
			],
			example_dialogs: [
				{ name: "Combat", dialog: "Get down!", feelingLucky: true },
			],
			initial_states: {},
		};

		const sampleLore: LoreBook = {
			id: "lb_test",
			name: "Test Lore",
			entries: [
				{
					id: "e1",
					title: "Old Title",
					content: "Old Content",
					keywords: ["old"],
					activationMode: "static",
					enabled: true,
					feelingLucky: {
						title: true,
						content: true,
						keywords: true,
					},
				},
			],
		};

		const processed = await preprocessFeelingLucky({
			worldfile: sampleWorld,
			universe: sampleUniverse,
			characters: [sampleCharacter],
			lorebooks: [sampleLore],
			llmCall: async (prompt) => {
				if (prompt.includes("backgrounds[0].content")) {
					return "Raised in subterranean cybernetic laboratories.";
				}
				if (prompt.includes("Field name: backgrounds")) {
					return "Generated rich cyberpunk background.";
				}
				if (prompt.includes("Field name: rules")) {
					return "Generated dynamic rule statement.";
				}
				if (prompt.includes("Field name: plot.intro")) {
					return "Generated thrilling intro scenario.";
				}
				if (prompt.includes("Field name: summary")) {
					return "Generated Eva Lin hacker summary.";
				}
				if (prompt.includes("trait[0].description")) {
					return "Glowing cybernetic blue optical implants.";
				}
				if (prompt.includes("example_dialogs[0].dialog")) {
					return "I've breached their central mainframe firewall.";
				}
				if (prompt.includes("Field name: entry.title")) {
					return "The Neon Syndicate";
				}
				if (prompt.includes("Field name: entry.content")) {
					return "A secret cabal of neural hackers.";
				}
				if (prompt.includes("Field name: entry.keywords")) {
					return "syndicate, neural, cabal";
				}
				return "Generated default text.";
			},
		});

		// Check Worldfile
		assert.strictEqual(processed.worldfile.content.backgrounds[0], "Generated rich cyberpunk background.");
		assert.strictEqual(processed.worldfile.content.backgrounds[1], "Static second background");
		assert.strictEqual(processed.worldfile.content.settings?.rules?.[0], "Generated dynamic rule statement.");
		assert.strictEqual(processed.worldfile.content.settings?.rules?.[1], "Laws of physics apply.");
		assert.strictEqual(processed.worldfile.content.plot?.intro?.list?.[0].value, "Generated thrilling intro scenario.");

		// Check Universe
		assert.strictEqual(processed.universe?.settings.rules[0], "Generated dynamic rule statement.");
		assert.strictEqual(processed.universe?.settings.backgrounds?.[0], "Generated rich cyberpunk background.");

		// Check Character
		assert.strictEqual(processed.characters?.[0].summary, "Generated Eva Lin hacker summary.");
		assert.strictEqual(processed.characters?.[0].physical_characteristics[0].description, "Glowing cybernetic blue optical implants.");
		assert.strictEqual(processed.characters?.[0].backgrounds[0].content, "Raised in subterranean cybernetic laboratories.");
		assert.strictEqual(processed.characters?.[0].example_dialogs[0].dialog, "I've breached their central mainframe firewall.");

		// Check Lore
		assert.strictEqual(processed.lorebooks?.[0].entries[0].title, "The Neon Syndicate");
		assert.strictEqual(processed.lorebooks?.[0].entries[0].content, "A secret cabal of neural hackers.");
		assert.deepStrictEqual(processed.lorebooks?.[0].entries[0].keywords, ["syndicate", "neural", "cabal"]);
	});

	it("replaces feeling lucky values before synthesizing initial instance prompt in createWorldInstance", async () => {
		const savedWf = saveWorldfile({
			metadata: {
				name: "lucky_world_test",
				version: "1.0.0",
				title: "Lucky World",
				description: "Testing lucky preprocessor",
			},
			content: {
				backgrounds: ["Default background"],
				guidelines: [],
				feeling_lucky: {
					backgrounds: [0],
				},
			},
		});

		const instance = await createWorldInstance({
			title: "Lucky World Instance",
			worldId: savedWf.id,
			llmCall: async () => "Dynamically synthesized atmospheric lore for Lucky World.",
		});

		assert.ok(instance.worldPrompt?.includes("Dynamically synthesized atmospheric lore for Lucky World."));
		assert.ok(!instance.worldPrompt?.includes("Default background"));
	});

});
