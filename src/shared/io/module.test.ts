import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCharacterfile, saveCharacterfile } from "../character/registry.ts";
import type { Characterfile } from "../character/types.ts";
import { getLoreBook, saveLoreBook } from "../lore/registry.ts";
import type { LoreBook } from "../lore/types.ts";
import { getUniverse, saveUniverse } from "../universe/registry.ts";
import { getWorldfile, saveWorldfile } from "../world/registry.ts";
import type { Universefile, Worldfile } from "../world/types.ts";
import { exportModule, importModule } from "./module.ts";

describe("Module ZIP Import and Export", () => {
	it("exports and imports world, universe, character, and lorebook assets", async () => {
		const testWorld: Worldfile = {
			metadata: {
				name: "mod-test-world-1",
				title: "Module Test World",
				authors: ["Tester"],
				version: "1.0.0",
				description: "A world for testing module export",
			},
			content: {
				description: "Detailed world description",
				guidelines: ["Be adventurous"],
				backgrounds: ["A fantasy realm"],
				settings: {
					rules: ["No cheating"],
				},
			},
			states: {},
		};

		const testUniverse: Universefile = {
			metadata: {
				name: "mod-test-universe-1",
				title: "Module Test Universe",
				authors: ["Tester"],
				version: "1.0.0",
				description: "Universe for testing",
			},
			settings: {
				rules: ["Gravity applies"],
			},
			states: {},
		};

		const testCharacter: Characterfile = {
			metadata: {
				name: "mod-test-char-1",
				title: "The Protagonist",
				authors: ["Tester"],
				version: "1.0.0",
				description: "A brave protagonist",
			},
			summary: "Summary of the protagonist",
			physical_characteristics: [],
			linguistic_patterns: [],
			psychology_and_worldviews: [],
			lifestyle_and_preferences: [],
			desires: [],
			skills: [
				{ name: "Archery", description: "Master of bows" },
			],
			backgrounds: [{ name: "Origin", content: "Grew up in the forest" }],
			example_dialogs: [],
			initial_states: {},
		};

		const testLore: LoreBook = {
			id: "mod-test-lore-1",
			name: "Test Lore Book",
			entries: [
				{
					id: "entry-1",
					title: "Ancient Ruins",
					content: "Old stone ruins with mysteries",
					keywords: ["ruins", "stone"],
					activationMode: "dynamic",
					enabled: true,
				},
			],
		};

		// Save them first to registries
		saveWorldfile(testWorld, testWorld.metadata.name);
		saveUniverse(testUniverse, testUniverse.metadata.name);
		saveCharacterfile(testCharacter, testCharacter.metadata.name);
		saveLoreBook(testLore);

		// Export module
		const zipBlob = await exportModule({
			worldIds: [testWorld.metadata.name],
			universeIds: [testUniverse.metadata.name],
			characterIds: [testCharacter.metadata.name],
			lorebookIds: [testLore.id],
		}, {
			id: "mod-pkg-1",
			title: "Comprehensive Test Module",
			description: "Package for unit test",
		});

		assert.ok(zipBlob.size > 0);

		// Test importing with overwrite = true
		const importResult = await importModule(zipBlob, { overwrite: true });

		assert.equal(importResult.success, true);
		assert.equal(importResult.errors.length, 0);
		assert.equal(importResult.conflicts.length, 0);

		assert.ok(importResult.imported.worldIds.includes("mod-test-world-1"));
		assert.ok(importResult.imported.universeIds.includes("mod-test-universe-1"));
		assert.ok(importResult.imported.characterIds.includes("mod-test-char-1"));
		assert.ok(importResult.imported.lorebookIds.includes("mod-test-lore-1"));

		// Verify data in registries
		const retrievedWf = getWorldfile("mod-test-world-1");
		assert.equal(retrievedWf?.worldfile.metadata.title, "Module Test World");

		const retrievedUf = getUniverse("mod-test-universe-1");
		assert.equal(retrievedUf?.universe.metadata.title, "Module Test Universe");

		const retrievedCf = getCharacterfile("mod-test-char-1");
		assert.equal(retrievedCf?.characterfile.metadata.title, "The Protagonist");

		const retrievedLb = getLoreBook("mod-test-lore-1");
		assert.equal(retrievedLb?.lorebook.name, "Test Lore Book");
	});

	it("detects conflicts when importing existing assets without overwrite", async () => {
		const zipBlob = await exportModule({
			worldIds: ["mod-test-world-1"],
			lorebookIds: ["mod-test-lore-1"],
		});

		// Import without overwrite
		const importResult = await importModule(zipBlob, { overwrite: false });

		assert.equal(importResult.success, false);
		assert.ok(importResult.conflicts.length >= 2);
		assert.ok(importResult.conflicts.some(c => c.id === "mod-test-world-1"));
		assert.ok(importResult.conflicts.some(c => c.id === "mod-test-lore-1"));
	});
});
