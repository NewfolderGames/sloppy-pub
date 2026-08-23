import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageTreeManager } from "../ai/message/tree_manager.ts";
import { getInstance } from "../world/instance_manager.ts";
import type { SessionEvent, WorldInstance } from "../world/types.ts";
import { compactSession, createChapterCheckpoint } from "./chapter_manager.ts";

function createTestInstance(id: string): WorldInstance {
	const now = Date.now();

	return {
		id,
		title: "Chapter Test",
		worldId: "chapter-test-world",
		universeMode: "isolated",
		injectedVars: {},
		messageTreeData: null,
		activeStates: {},
		createdAt: now,
		updatedAt: now,
	};
}

const events: SessionEvent[] = [
	{
		id: "evt-1",
		timestamp: 1,
		type: "narrative",
		summary: "The party enters the vault.",
	},
];

describe("Chapter Manager", () => {
	it("creates a chapter from an LLM response and recent messages", async () => {
		const instance = createTestInstance(`chapter-llm-${Date.now()}`);
		const treeManager = new MessageTreeManager();
		treeManager.appendMessage("user", "We enter the vault.");

		let prompt = "";
		const chapter = await createChapterCheckpoint(
			instance,
			events,
			treeManager,
			async (receivedPrompt) => {
				prompt = receivedPrompt;
				return "Title: The Vault\nSummary: The party crossed the vault threshold.";
			},
		);

		assert.match(prompt, /The party enters the vault/);
		assert.match(prompt, /We enter the vault/);
		assert.equal(chapter.title, "The Vault");
		assert.equal(chapter.summary, "The party crossed the vault threshold.");
		assert.deepEqual(chapter.eventIds, ["evt-1"]);
		assert.deepEqual(instance.chapters, [chapter]);
	});

	it("creates a fallback chapter without an LLM", async () => {
		const instance = createTestInstance(`chapter-fallback-${Date.now()}`);

		const chapter = await createChapterCheckpoint(instance, events);

		assert.equal(chapter.title, "Chapter 1");
		assert.match(chapter.summary, /The party enters the vault/);
		assert.deepEqual(chapter.eventIds, ["evt-1"]);
	});

	it("compacts the tree, stores the chapter, and persists the compacted state", () => {
		const instance = createTestInstance(`chapter-compact-${Date.now()}`);
		const treeManager = new MessageTreeManager();
		treeManager.appendMessage("user", "Before compaction.");

		const chapter = {
			id: "chapter-1",
			title: "The Vault",
			summary: "The party entered the vault.",
			eventIds: ["evt-1"],
			createdAt: 1,
		};

		compactSession(instance, chapter, treeManager);

		assert.equal(treeManager.getHeadId(), null);
		assert.equal(instance.compacted, true);
		assert.equal(instance.isCompacted, true);
		assert.deepEqual(instance.chapters, [chapter]);
		assert.deepEqual(getInstance(instance.id)?.chapters, [chapter]);
		assert.deepEqual((getInstance(instance.id)?.messageTreeData as { nodes: Record<string, unknown> }).nodes, {});
	});
});
