import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteUniverse, exportUniverseToToml, getAllUniverses, getUniverse, importUniverseFromToml, SAMPLE_UNIVERSEFILE, saveUniverse } from "./registry.ts";
import type { Universefile } from "../world/types.ts";

describe("Universe Registry", () => {
	it("initializes with seeded sample universefile", () => {
		const all = getAllUniverses();
		assert.ok(all.length >= 1);
		assert.equal(all[0].universe.metadata.name, SAMPLE_UNIVERSEFILE.metadata.name);
	});

	it("saves and retrieves a custom universe", () => {
		const customUniverse: Universefile = {
			metadata: {
				name: "arcane_multiverse",
				version: "1.2.0",
				title: "Arcane Multiverse",
				description: "Cosmic realm governed by leyline matrices.",
			},
			settings: {
				rules: [
					"Mana levels deplete when ungrounded spells are cast.",
					"Dimensional rifts require a high-tier spell focus.",
				],
			},
			states: {
				"universe.mana_density": 85.5,
				"universe.active_rifts": 0,
			},
		};

		const saved = saveUniverse(customUniverse);
		assert.equal(saved.id, "arcane_multiverse");

		const fetched = getUniverse("arcane_multiverse");
		assert.ok(fetched);
		assert.equal(fetched.universe.metadata.title, "Arcane Multiverse");
		assert.equal(fetched.universe.settings.rules.length, 2);
	});

	it("exports and imports universefile TOML roundtrip", () => {
		const toml = exportUniverseToToml("arcane_multiverse");
		assert.ok(toml.includes("title = \"Arcane Multiverse\""));

		const imported = importUniverseFromToml(toml);
		assert.equal(imported.universe.metadata.title, "Arcane Multiverse");
		assert.equal(imported.universe.states["universe.mana_density"], 85.5);
	});

	it("deletes a universe", () => {
		const deleted = deleteUniverse("arcane_multiverse");
		assert.equal(deleted, true);

		const fetched = getUniverse("arcane_multiverse");
		assert.equal(fetched, undefined);
	});
});
