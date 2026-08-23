import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteCharacterfile, exportCharacterfileToToml, getAllCharacterfiles, getCharacterfile, importCharacterfileFromToml, SAMPLE_CHARACTERFILE, saveCharacterfile } from "./registry.ts";
import type { Characterfile } from "./types.ts";

describe("Characterfile Registry", () => {
	it("initializes with seeded sample characterfile", () => {
		const all = getAllCharacterfiles();
		assert.ok(all.length >= 1);
		assert.equal(all[0].characterfile.metadata.name, SAMPLE_CHARACTERFILE.metadata.name);
	});

	it("saves and retrieves a new characterfile", () => {
		const customCharacter: Characterfile = {
			metadata: {
				name: "marcus_valerius",
				version: "1.0.0",
				title: "Commander Marcus Valerius",
				description: "A seasoned veteran of the frontier legion.",
			},
			summary: "Commander Valerius commands the outpost garrison with strict discipline.",
			physical_characteristics: [
				{ name: "Species", description: "Human" },
				{ name: "Age", description: "48" },
				{ name: "Height", description: "188 cm" },
			],
			linguistic_patterns: [
				{ name: "Voice", description: "Deep and authoritative" },
				{ name: "Accent", description: "Roman cadence" },
				{ name: "Tone", description: "Stern" },
				{ name: "Dialect", description: "Military Latin-English" },
			],
			psychology_and_worldviews: [
				{ name: "Duty", description: "Duty to the legion above all personal desire." },
			],
			lifestyle_and_preferences: [
				{ name: "Sparring", description: "Practices swordsmanship at dawn." },
			],
			skills: [],
			backgrounds: [],
			desires: [
				{ name: "Victory", description: "Secure the northern frontier passes." },
			],
			example_dialogs: [
				{ name: "Inspection", dialog: "Shields up, recruits. Form the defensive line." },
			],
			initial_states: {
				morale: 95,
				readiness: "high",
			},
		};

		const saved = saveCharacterfile(customCharacter);
		assert.equal(saved.id, "marcus_valerius");

		const fetched = getCharacterfile("marcus_valerius");
		assert.ok(fetched);
		assert.equal(fetched.characterfile.metadata.title, "Commander Marcus Valerius");
		assert.equal(fetched.characterfile.initial_states["readiness"], "high");
	});

	it("exports and imports characterfile TOML roundtrip", () => {
		const toml = exportCharacterfileToToml("marcus_valerius");
		assert.ok(toml.includes("title = \"Commander Marcus Valerius\""));

		const imported = importCharacterfileFromToml(toml);
		assert.equal(imported.characterfile.metadata.title, "Commander Marcus Valerius");
	});

	it("deletes a characterfile", () => {
		const deleted = deleteCharacterfile("marcus_valerius");
		assert.equal(deleted, true);

		const fetched = getCharacterfile("marcus_valerius");
		assert.equal(fetched, undefined);
	});
});
