import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteWorldfile, exportWorldfileToToml, getAllWorldfiles, getWorldfile, importWorldfileFromToml, resolveVariantWorldfile, SAMPLE_WORLDFILE, saveWorldfile } from "./registry.ts";
import type { Worldfile } from "./types.ts";

describe("Worldfile Registry", () => {
	it("initializes with seeded sample worldfile", () => {
		const all = getAllWorldfiles();
		assert.ok(all.length >= 1);
		assert.equal(all[0].worldfile.metadata.name, SAMPLE_WORLDFILE.metadata.name);
	});

	it("saves and retrieves a new worldfile", () => {
		const customWorldfile: Worldfile = {
			metadata: {
				name: "fantasy_realm",
				version: "1.0.0",
				title: "Kingdom of Eldoria",
				description: "A high fantasy world of magic and ancient runes.",
			},
			content: {
				backgrounds: ["The realm of Eldoria lies beneath twin moons."],
				description: "The realm of Eldoria lies beneath twin moons.",
				guidelines: [],
			},
			states: {
				"realm.peace_level": 90,
			},
		};

		const saved = saveWorldfile(customWorldfile);
		assert.equal(saved.id, "fantasy_realm");

		const fetched = getWorldfile("fantasy_realm");
		assert.ok(fetched);
		assert.equal(fetched.worldfile.metadata.title, "Kingdom of Eldoria");
	});

	it("exports and imports worldfile TOML roundtrip", () => {
		const toml = exportWorldfileToToml("fantasy_realm");
		assert.ok(toml.includes("title = \"Kingdom of Eldoria\""));

		const imported = importWorldfileFromToml(toml);
		assert.equal(imported.worldfile.metadata.title, "Kingdom of Eldoria");
	});

	it("deletes a worldfile", () => {
		const deleted = deleteWorldfile("fantasy_realm");
		assert.equal(deleted, true);

		const fetched = getWorldfile("fantasy_realm");
		assert.equal(fetched, undefined);
	});

	it("resolveVariantWorldfile returns undefined for missing id", () => {
		const result = resolveVariantWorldfile("non_existent");
		assert.equal(result, undefined);
	});

	it("resolveVariantWorldfile returns the worldfile as-is when from is absent", () => {
		const wf: Worldfile = {
			metadata: {
				name: "base_world",
				version: "1.0.0",
				title: "Base World",
				description: "",
			},
			content: {
				backgrounds: ["Base background."],
				guidelines: ["Base guideline."],
			},
			vars: [],
			args: [],
			states: {},
		};
		saveWorldfile(wf);

		const resolved = resolveVariantWorldfile("base_world");
		assert.ok(resolved);
		assert.equal(resolved.content.backgrounds[0], "Base background.");
		assert.equal(resolved.content.guidelines[0], "Base guideline.");
	});

	it("resolveVariantWorldfile merges parent content into variant", () => {
		const parent: Worldfile = {
			metadata: {
				name: "parent_world",
				version: "1.0.0",
				title: "Parent",
				description: "",
			},
			content: {
				backgrounds: ["Parent background."],
				guidelines: ["Parent guideline."],
				settings: { rules: ["Parent rule."] },
			},
			vars: [{ name: "VAR_A", type: "text", default: "parent_val" }],
			args: [],
			states: { level: 5 },
		};
		saveWorldfile(parent);

		const variant: Worldfile = {
			metadata: {
				name: "variant_world",
				version: "1.0.0",
				title: "Variant",
				description: "",
				from: "parent_world",
			},
			content: {
				backgrounds: [],
				guidelines: [],
			},
			vars: [],
			args: [],
			states: {},
		};
		saveWorldfile(variant);

		const resolved = resolveVariantWorldfile("variant_world");
		assert.ok(resolved);
		assert.equal(resolved.content.backgrounds[0], "Parent background.");
		assert.equal(resolved.content.guidelines[0], "Parent guideline.");
		assert.equal(resolved.content.settings?.rules?.[0], "Parent rule.");
		assert.equal(resolved.vars?.[0]?.name, "VAR_A");
		assert.equal(resolved.states?.["level"], 5);
	});

	it("resolveVariantWorldfile variant overrides parent content", () => {
		const parent: Worldfile = {
			metadata: {
				name: "override_parent",
				version: "1.0.0",
				title: "Override Parent",
				description: "",
			},
			content: {
				backgrounds: ["Parent bg."],
				guidelines: ["Parent guide."],
				settings: { rules: ["Parent rule."] },
			},
			vars: [{ name: "X", type: "text", default: "parent_x" }],
			args: [],
			states: { a: 1 },
		};
		saveWorldfile(parent);

		const variant: Worldfile = {
			metadata: {
				name: "override_variant",
				version: "1.0.0",
				title: "Override Variant",
				description: "",
				from: "override_parent",
			},
			content: {
				backgrounds: ["Variant bg."],
				guidelines: ["Variant guide."],
				settings: { rules: ["Variant rule."] },
			},
			vars: [{ name: "X", type: "text", default: "variant_x" }],
			args: [],
			states: { b: 2 },
		};
		saveWorldfile(variant);

		const resolved = resolveVariantWorldfile("override_variant");
		assert.ok(resolved);
		assert.equal(resolved.content.backgrounds[0], "Variant bg.");
		assert.equal(resolved.content.guidelines[0], "Variant guide.");
		assert.equal(resolved.content.settings?.rules?.[0], "Variant rule.");
		assert.equal(resolved.vars?.[0]?.default, "variant_x");
		// states merge: parent + variant
		assert.deepEqual(resolved.states, { a: 1, b: 2 });
	});

	it("resolveVariantWorldfile resolves A->B->C chain", () => {
		const worldA: Worldfile = {
			metadata: {
				name: "chain_A",
				version: "1.0.0",
				title: "Chain A",
				description: "",
			},
			content: {
				backgrounds: ["A bg."],
				guidelines: ["A guide."],
			},
			vars: [{ name: "LEVEL", type: "number", default: 1 }],
			args: [],
			states: {},
		};
		saveWorldfile(worldA);

		const worldB: Worldfile = {
			metadata: {
				name: "chain_B",
				version: "1.0.0",
				title: "Chain B",
				description: "",
				from: "chain_A",
			},
			content: {
				backgrounds: [],
				guidelines: ["B guide."],
			},
			vars: [],
			args: [],
			states: {},
		};
		saveWorldfile(worldB);

		const worldC: Worldfile = {
			metadata: {
				name: "chain_C",
				version: "1.0.0",
				title: "Chain C",
				description: "",
				from: "chain_B",
			},
			content: {
				backgrounds: ["C bg."],
				guidelines: [],
			},
			vars: [],
			args: [],
			states: {},
		};
		saveWorldfile(worldC);

		const resolved = resolveVariantWorldfile("chain_C");
		assert.ok(resolved);
		// C overrides backgrounds, B overrides guidelines, A provides vars
		assert.equal(resolved.content.backgrounds[0], "C bg.");
		assert.equal(resolved.content.guidelines[0], "B guide.");
		assert.equal(resolved.vars?.[0]?.name, "LEVEL");
	});
});
