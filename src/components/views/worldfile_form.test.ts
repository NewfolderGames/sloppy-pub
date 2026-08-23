import test from "node:test";
import assert from "node:assert/strict";
import { mergeWorldfileFormState } from "./worldfile_form.ts";
import type { Worldfile } from "../../shared/world/types.ts";

test("mergeWorldfileFormState preserves fields that the form does not edit", () => {
	const baseWorldfile: Worldfile = {
		metadata: {
			name: "sample-world",
			version: "1.0.0",
			title: "Sample World",
			description: "Original metadata description.",
			authors: ["Author"],
			tags: ["sample"],
			from: "parent-world:1.0",
		},
		content: {
			backgrounds: ["Original content."],
			description: "Original content.",
			guidelines: [],
			generation: {
				engine: "draft",
				seed: 42,
			},
			settings: {
				rules: ["Original rule"],
				guidelines: ["Original guideline"],
			},
			plot: {
				intro: {
					mode: "random",
					list: [
						{ value: "Original intro", hidden: true },
					],
				},
				incident: {
					list: [
						{
							value: "Original incident",
							trigger: "manual",
						},
					],
				},
			},
		},
		states: {
			"world.status": "ready",
		},
	};

	const mergedWorldfile = mergeWorldfileFormState(baseWorldfile, {
		metaName: "edited-world",
		metaVersion: "2.0.0",
		metaTitle: "Edited World",
		metaDescription: "Edited metadata description.",
		metaAuthors: "Editor",
		metaTags: "edited",
		backgroundsList: ["Edited background 1.", "Edited background 2."],
		rulesList: ["Edited rule"],
		guidelinesList: ["Edited guideline"],
		plotIntroMode: "user_select",
		plotIntroList: ["Edited intro"],
		argsList: [],
		varsList: [],
		stateRows: [],
	});

	assert.equal(mergedWorldfile.metadata.from, "parent-world:1.0");
	assert.deepEqual(mergedWorldfile.content.generation, baseWorldfile.content.generation);
	assert.deepEqual(mergedWorldfile.content.plot?.incident, baseWorldfile.content.plot?.incident);
	assert.equal(mergedWorldfile.content.plot?.intro?.list?.[0].hidden, true);
	assert.equal(mergedWorldfile.content.plot?.intro?.list?.[0].value, "Edited intro");
	assert.equal(mergedWorldfile.content.plot?.intro?.mode, "user_select");
	assert.deepEqual(mergedWorldfile.content.backgrounds, ["Edited background 1.", "Edited background 2."]);
	assert.equal(mergedWorldfile.content.description, undefined);
});

test("mergeWorldfileFormState removes legacy description and saves backgroundsList", () => {
	const legacyBase = {
		metadata: {
			name: "legacy-world",
			version: "1.0.0",
			title: "Legacy World",
			description: "Legacy metadata description",
		},
		content: {
			description: "Old narrative description.",
		},
	} as unknown as Worldfile;

	const merged = mergeWorldfileFormState(legacyBase, {
		metaName: "legacy-world",
		metaVersion: "1.0.0",
		metaTitle: "Legacy World",
		metaDescription: "",
		metaAuthors: "",
		metaTags: "",
		backgroundsList: ["Segment 1", "Segment 2", "Segment 3"],
		rulesList: [],
		guidelinesList: [],
		plotIntroMode: "random",
		plotIntroList: [],
		argsList: [],
		varsList: [],
		stateRows: [],
	});

	assert.deepEqual(merged.content.backgrounds, ["Segment 1", "Segment 2", "Segment 3"]);
	assert.equal(merged.content.description, undefined);
});
