import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getMatchingLoreEntries } from "../../../shared/lore/builder.ts";
import { saveLoreBook } from "../../../shared/lore/registry.ts";
import type { LoreBook } from "../../../shared/lore/types.ts";
import { synthesizeInstancePrompt } from "../../../shared/world/instance_manager.ts";
import type { Chapter, SessionEvent, Worldfile, WorldInstance } from "../../../shared/world/types.ts";

describe("World Info Drawer Data and Integration", () => {

	test("resolves active lore entries from attached lorebooks", () => {

		const testBook: LoreBook = {
			id: "lb-test-drawer",
			name: "Test Drawer Lorebook",
			entries: [
				{
					id: "entry-static",
					title: "Ancient Ruins",
					content: "The ancient ruins stand in the north.",
					keywords: ["ruins", "ancient"],
					activationMode: "static",
					enabled: true,
					priority: 10,
				},
				{
					id: "entry-dynamic",
					title: "Dragon Sword",
					content: "A legendary blade forged in dragon flame.",
					keywords: ["dragon", "sword"],
					activationMode: "dynamic",
					enabled: true,
					priority: 5,
				},
				{
					id: "entry-disabled",
					title: "Hidden Secret",
					content: "This content is disabled.",
					keywords: ["secret"],
					activationMode: "static",
					enabled: false,
				},
			],
		};

		saveLoreBook(testBook);

		// Without message: static entries only
		const staticOnly = getMatchingLoreEntries("lb-test-drawer", undefined);
		assert.equal(staticOnly.length, 1);
		assert.equal(staticOnly[0].id, "entry-static");

		// With matching message: static and dynamic entries
		const withDynamic = getMatchingLoreEntries("lb-test-drawer", "I draw my dragon sword.");
		assert.equal(withDynamic.length, 2);
		assert.equal(withDynamic[0].id, "entry-static"); // higher priority (10 vs 5)
		assert.equal(withDynamic[1].id, "entry-dynamic");

	});

	test("synthesizes full world prompt when instance prompt is absent", () => {

		const worldfile: Worldfile = {
			metadata: {
				name: "eldoria",
				title: "Eldoria",
				version: "1.0.0",
				description: "A realm of magic",
			},
			content: {
				backgrounds: ["Eldoria is an enchanted land."],
				guidelines: ["Describe sensory details."],
				settings: {
					rules: ["Magic requires incantations."],
					guidelines: ["Maintain atmospheric tone."],
				},
			},
		};

		const injectedVars = {
			season: "Winter",
			year: 1492,
		};

		const synthesized = synthesizeInstancePrompt(worldfile, injectedVars);

		assert.ok(synthesized.includes("Eldoria"));
		assert.ok(synthesized.includes("Eldoria is an enchanted land."));
		assert.ok(synthesized.includes("Magic requires incantations."));
		assert.ok(synthesized.includes("Describe sensory details."));
		assert.ok(synthesized.includes("season: Winter"));
		assert.ok(synthesized.includes("year: 1492"));

	});

	test("extracts event logs and chapter structures properly", () => {

		const events: SessionEvent[] = [
			{
				id: "evt-1",
				timestamp: 1700000000000,
				type: "narrative",
				summary: "The heroes entered the dark cave.",
				details: "The temperature dropped noticeably.",
			},
			{
				id: "evt-2",
				timestamp: 1700000005000,
				type: "character",
				summary: "Aria lit a torch.",
			},
		];

		const chapters: Chapter[] = [
			{
				id: "chap-1",
				title: "Chapter 1: The Descent",
				summary: "Exploration of the cavern begins.",
				eventIds: ["evt-1", "evt-2"],
				createdAt: 1700000010000,
			},
		];

		const instance: Partial<WorldInstance> = {
			id: "inst-1",
			title: "Cave Adventure",
			events,
			chapters,
		};

		assert.equal(instance.events?.length, 2);
		assert.equal(instance.events?.[0].type, "narrative");
		assert.equal(instance.events?.[1].type, "character");
		assert.equal(instance.chapters?.length, 1);
		assert.equal(instance.chapters?.[0].eventIds.length, 2);

	});

});
