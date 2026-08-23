import { describe, it } from "node:test";
import assert from "node:assert";
import { MessageTree } from "./tree.ts";
import { chunksToMessage, type Message } from "./node.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";

describe("MessageTree", () => {

	const createDummyMessage = (id: string, content: string): Message => {
		return {
			id,
			finishReason: "stop",
			data: {
				role: "user",
				content,
			},
		};
	};

	it("initializes empty tree", () => {
		const tree = new MessageTree();
		assert.strictEqual(tree.getHeadId(), null);
		assert.strictEqual(tree.getHead(), null);
		assert.deepStrictEqual(tree.getPath(), []);
		assert.deepStrictEqual(tree.getRootIds(), []);
	});

	it("adds linear sequence of messages and tracks path", () => {
		const tree = new MessageTree();
		const msg1 = createDummyMessage("1", "Hello");
		const msg2 = createDummyMessage("2", "Hi there");

		tree.addNode(msg1);
		assert.strictEqual(tree.getHeadId(), "1");
		assert.deepStrictEqual(tree.getRootIds(), ["1"]);

		tree.addNode(msg2);
		assert.strictEqual(tree.getHeadId(), "2");

		const path = tree.getPath();
		assert.strictEqual(path.length, 2);
		assert.strictEqual(path[0].id, "1");
		assert.strictEqual(path[1].id, "2");
	});

	it("supports branching and head navigation", () => {
		const tree = new MessageTree();
		const m1 = createDummyMessage("1", "Root");
		const m2a = createDummyMessage("2a", "Branch A");
		const m2b = createDummyMessage("2b", "Branch B");

		tree.addNode(m1);
		tree.addNode(m2a);
		assert.strictEqual(tree.getHeadId(), "2a");

		// Branch from m1
		tree.setHead("1");
		assert.strictEqual(tree.getHeadId(), "1");

		tree.addNode(m2b);
		assert.strictEqual(tree.getHeadId(), "2b");

		const siblings = tree.getSiblings("2b");
		assert.strictEqual(siblings.length, 2);
		assert.strictEqual(siblings[0].id, "2a");
		assert.strictEqual(siblings[1].id, "2b");

		const pathB = tree.getPath();
		assert.deepStrictEqual(pathB.map(n => n.id), ["1", "2b"]);

		tree.setHead("2a");
		const pathA = tree.getPath();
		assert.deepStrictEqual(pathA.map(n => n.id), ["1", "2a"]);
	});

	it("handles node deletion and recursive subtree cleanup", () => {
		const tree = new MessageTree();
		tree.addNode(createDummyMessage("1", "1"));
		tree.addNode(createDummyMessage("2", "2"));
		tree.addNode(createDummyMessage("3", "3"));

		tree.deleteNode("2");
		assert.strictEqual(tree.getNode("2"), null);
		assert.strictEqual(tree.getNode("3"), null);
		assert.strictEqual(tree.getHeadId(), "1");

		const path = tree.getPath();
		assert.deepStrictEqual(path.map(n => n.id), ["1"]);
	});

	it("removes a node and promotes its children to roots", () => {
		const tree = new MessageTree();
		tree.addNode(createDummyMessage("1", "Root"));
		tree.addNode(createDummyMessage("2", "Child A"));
		tree.setHead("1");
		tree.addNode(createDummyMessage("3", "Child B"));

		assert.equal(tree.removeNodeAndPromoteChildren("1"), true);
		assert.equal(tree.getNode("1"), null);
		assert.deepStrictEqual(tree.getRootIds(), ["2", "3"]);
		assert.equal(tree.getNode("2")?.parentId, null);
		assert.equal(tree.getNode("3")?.parentId, null);
		assert.equal(tree.getHeadId(), "3");
	});

	it("serializes to and deserializes from JSON", () => {
		const tree = new MessageTree();
		tree.addNode(createDummyMessage("1", "First"));
		tree.addNode(createDummyMessage("2", "Second"));

		const json = tree.toJSON();
		const restored = MessageTree.fromJSON(json);

		assert.strictEqual(restored.getHeadId(), "2");
		assert.deepStrictEqual(restored.getPath().map(n => n.id), ["1", "2"]);
	});

	it("retains and serializes message metadata", () => {
		const tree = new MessageTree();

		const msg: Message = {
			id: "meta-1",
			finishReason: "stop",
			metadata: {
				tokens: 42,
				durationMs: 1250,
				error: "Temporary network timeout",
			},
			data: {
				role: "assistant",
				content: "Hello from assistant",
			},
		};

		tree.addNode(msg);

		const node = tree.getNode("meta-1");
		assert.notStrictEqual(node, null);
		assert.deepStrictEqual(node?.message.metadata, {
			tokens: 42,
			durationMs: 1250,
			error: "Temporary network timeout",
		});

		const json = tree.toJSON();
		const restored = MessageTree.fromJSON(json);
		const restoredNode = restored.getNode("meta-1");

		assert.notStrictEqual(restoredNode, null);
		assert.deepStrictEqual(restoredNode?.message.metadata, {
			tokens: 42,
			durationMs: 1250,
			error: "Temporary network timeout",
		});
	});

	it("updates message content in tree nodes", () => {
		const tree = new MessageTree();
		const msg = createDummyMessage("edit-1", "Original text");

		tree.addNode(msg);

		const updatedNode = tree.updateMessageContent("edit-1", "Updated text");

		assert.strictEqual(updatedNode.message.data.content, "Updated text");
		assert.strictEqual(tree.getNode("edit-1")?.message.data.content, "Updated text");

		assert.throws(() => {
			tree.updateMessageContent("non-existent", "Throws");
		}, /Node not found: non-existent/);
	});

	it("updates and merges message metadata in tree nodes", () => {
		const tree = new MessageTree();

		const msg: Message = {
			id: "meta-update-1",
			finishReason: "stop",
			metadata: {
				tokens: 20,
			},
			data: {
				role: "assistant",
				content: "Thinking...",
			},
		};

		tree.addNode(msg);

		const updatedNode = tree.updateMessageMetadata("meta-update-1", {
			durationMs: 800,
			error: "API rate limit",
		});

		assert.deepStrictEqual(updatedNode.message.metadata, {
			tokens: 20,
			durationMs: 800,
			error: "API rate limit",
		});

		assert.deepStrictEqual(tree.getNode("meta-update-1")?.message.metadata, {
			tokens: 20,
			durationMs: 800,
			error: "API rate limit",
		});

		assert.throws(() => {
			tree.updateMessageMetadata("non-existent", { tokens: 1 });
		}, /Node not found: non-existent/);
	});

	it("copies usage metrics into message metadata via chunksToMessage", () => {
		const chunks: ChatCompletionChunk[] = [
			{
				id: "chunk-meta-1",
				object: "chat.completion.chunk",
				created: 12345,
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "Streamed content",
						},
						finish_reason: null,
					},
				],
			},
			{
				id: "chunk-meta-1",
				object: "chat.completion.chunk",
				created: 12346,
				model: "any",
				choices: [
					{
						index: 0,
						delta: {},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 15,
					completion_tokens: 30,
					total_tokens: 45,
				},
			},
		];

		const message = chunksToMessage(chunks);

		assert.strictEqual(message.finishReason, "stop");
		assert.strictEqual(message.data.content, "Streamed content");
		assert.strictEqual(message.metadata?.tokens, 45);
	});

	it("preserves finish_reason when usage chunk has empty choices", () => {
		const chunks: ChatCompletionChunk[] = [
			{
				id: "chunk-meta-2",
				object: "chat.completion.chunk",
				created: 12347,
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "Complete response",
						},
						finish_reason: "stop",
					},
				],
			},
			{
				id: "chunk-meta-2",
				object: "chat.completion.chunk",
				created: 12348,
				model: "any",
				choices: [],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30,
				},
			},
		];

		const message = chunksToMessage(chunks);

		assert.strictEqual(message.finishReason, "stop");
		assert.strictEqual(message.data.content, "Complete response");
		assert.strictEqual(message.metadata?.tokens, 30);
	});

});
