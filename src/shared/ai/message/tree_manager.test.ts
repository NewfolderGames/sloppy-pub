import assert from "node:assert";
import { describe, it } from "node:test";
import { OpenAIClient } from "../llm/client.ts";
import type { ChatCompletionAssistantMessageParam, ChatCompletionToolMessageParam } from "../llm/common.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import { calculateMessageTokens, chunksToMessage } from "./node.ts";
import { MessageTreeManager } from "./tree_manager.ts";

describe("MessageTreeManager", () => {

	it("notifies listeners on node mutations", () => {
		const manager = new MessageTreeManager();
		let callCount = 0;

		const unsubscribe = manager.subscribe(() => {
			callCount += 1;
		});

		manager.appendMessage("user", "Hello");
		assert.strictEqual(callCount, 1);

		manager.appendMessage("assistant", "Hi");
		assert.strictEqual(callCount, 2);

		unsubscribe();
		manager.appendMessage("user", "Another message");
		assert.strictEqual(callCount, 2);
	});

	it("transforms active branch path to LLM context parameters", () => {
		const manager = new MessageTreeManager();
		manager.appendMessage("user", "Hello");
		manager.appendMessage("assistant", "Hi");

		const params = manager.getLLMContext(null, [
			{ role: "system", content: "System prompt" },
		]);

		assert.strictEqual(params.length, 3);
		assert.strictEqual(params[0].role, "user");
		assert.strictEqual(params[0].content, "Hello");
		assert.strictEqual(params[1].role, "assistant");
		assert.strictEqual(params[1].content, "Hi");
		assert.strictEqual(params[2].role, "system");
		assert.strictEqual(params[2].content, "System prompt");
	});

	it("transforms assistant tool calls and sequential tool responses into LLM context", () => {
		const manager = new MessageTreeManager();
		manager.appendMessage("user", "Perform multi-actions");

		manager.appendMessage("assistant", "Executing tools", {
			tool_calls: [
				{
					id: "call_1",
					type: "function",
					function: {
						name: "mutate_world_state",
						arguments: "{\"operations\":[]}",
					},
				},
				{
					id: "call_2",
					type: "function",
					function: {
						name: "read_world_state",
						arguments: "{}",
					},
				},
			],
		});

		manager.appendMessage("tool", "{\"status\":\"success\",\"applied_count\":0}", {
			tool_call_id: "call_1",
		});

		manager.appendMessage("tool", "{\"status\":\"success\",\"states\":{}}", {
			tool_call_id: "call_2",
		});

		const context = manager.getLLMContext();

		assert.strictEqual(context.length, 4);

		assert.strictEqual(context[0].role, "user");
		assert.strictEqual(context[0].content, "Perform multi-actions");

		const assistantParam = context[1] as ChatCompletionAssistantMessageParam;
		assert.strictEqual(assistantParam.role, "assistant");
		assert.strictEqual(assistantParam.content, "Executing tools");
		assert.strictEqual(assistantParam.tool_calls?.length, 2);
		assert.strictEqual(assistantParam.tool_calls[0].id, "call_1");
		assert.strictEqual(assistantParam.tool_calls[1].id, "call_2");

		const tool1Param = context[2] as ChatCompletionToolMessageParam;
		assert.strictEqual(tool1Param.role, "tool");
		assert.strictEqual(tool1Param.tool_call_id, "call_1");
		assert.strictEqual(tool1Param.content, "{\"status\":\"success\",\"applied_count\":0}");

		const tool2Param = context[3] as ChatCompletionToolMessageParam;
		assert.strictEqual(tool2Param.role, "tool");
		assert.strictEqual(tool2Param.tool_call_id, "call_2");
		assert.strictEqual(tool2Param.content, "{\"status\":\"success\",\"states\":{}}");
	});

	it("accumulates multi-tool streaming chunks into complete tool calls via chunksToMessage", () => {
		const chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_1",
				created: 1,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: null,
						delta: {
							role: "assistant",
							content: "Calling tools",
							tool_calls: [
								{
									index: 0,
									id: "call_100",
									type: "function",
									function: {
										name: "mutate_world",
										arguments: "{\"oper",
									},
								},
							],
						},
					},
				],
			},
			{
				id: "chunk_2",
				created: 2,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: null,
						delta: {
							tool_calls: [
								{
									index: 0,
									function: {
										name: "_state",
										arguments: "ations\":[]}",
									},
								},
								{
									index: 1,
									id: "call_200",
									type: "function",
									function: {
										name: "read_world_state",
										arguments: "{}",
									},
								},
							],
						},
					},
				],
			},
			{
				id: "chunk_3",
				created: 3,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: "tool_calls",
						delta: {},
					},
				],
			},
		];

		const message = chunksToMessage(chunks);

		assert.strictEqual(message.finishReason, "tool_calls");
		assert.strictEqual(message.data.role, "assistant");
		assert.strictEqual(message.data.content, "Calling tools");

		const toolCalls = (message.data as any).tool_calls;
		assert.strictEqual(toolCalls?.length, 2);

		assert.strictEqual(toolCalls[0].id, "call_100");
		assert.strictEqual(toolCalls[0].function.name, "mutate_world_state");
		assert.strictEqual(toolCalls[0].function.arguments, "{\"operations\":[]}");

		assert.strictEqual(toolCalls[1].id, "call_200");
		assert.strictEqual(toolCalls[1].function.name, "read_world_state");
		assert.strictEqual(toolCalls[1].function.arguments, "{}");

		// Also test OpenAIClient.chunksToMessage
		const clientMessage = OpenAIClient.chunksToMessage(chunks) as ChatCompletionAssistantMessageParam;
		assert.strictEqual(clientMessage.role, "assistant");
		assert.strictEqual(clientMessage.content, "Calling tools");
		assert.strictEqual(clientMessage.tool_calls?.length, 2);
		assert.strictEqual(clientMessage.tool_calls![0].id, "call_100");
		assert.strictEqual(clientMessage.tool_calls![0].function.name, "mutate_world_state");
		assert.strictEqual(clientMessage.tool_calls![1].id, "call_200");
		assert.strictEqual(clientMessage.tool_calls![1].function.name, "read_world_state");
	});

	it("updates message content and metadata through manager and notifies listeners", () => {
		const manager = new MessageTreeManager();
		let notifications = 0;

		manager.subscribe(() => {
			notifications += 1;
		});

		const node = manager.appendMessage("assistant", "Initial answer", {
			metadata: {
				tokens: 15,
			},
		});

		assert.strictEqual(notifications, 1);
		assert.deepStrictEqual(node.message.metadata, { tokens: 15 });

		const contentNode = manager.updateMessageContent(node.id, "Edited answer");

		assert.strictEqual(notifications, 2);
		assert.strictEqual(contentNode.message.data.content, "Edited answer");
		assert.strictEqual(manager.getNode(node.id)?.message.data.content, "Edited answer");

		const metaNode = manager.updateMessageMetadata(node.id, {
			durationMs: 400,
			error: "Network reset",
		});

		assert.strictEqual(notifications, 3);
		assert.deepStrictEqual(metaNode.message.metadata, {
			tokens: 15,
			durationMs: 400,
			error: "Network reset",
		});
		assert.deepStrictEqual(manager.getNode(node.id)?.message.metadata, {
			tokens: 15,
			durationMs: 400,
			error: "Network reset",
		});
	});

	it("retrieves parent node via getParent", () => {
		const manager = new MessageTreeManager();
		const root = manager.appendMessage("user", "Hello");
		const reply = manager.appendMessage("assistant", "Hi there");

		assert.strictEqual(manager.getParent(root.id), null);
		assert.strictEqual(manager.getParent(reply.id)?.id, root.id);
	});

	it("records completed assistant message metrics with duration and token counts", () => {
		const manager = new MessageTreeManager();
		manager.appendMessage("user", "What is the capital of France?");

		const chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_metric_1",
				created: 1,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: null,
						delta: { role: "assistant", content: "Paris is the capital of France." },
					},
				],
			},
			{
				id: "chunk_metric_2",
				created: 2,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: "stop",
						delta: {},
					},
				],
				usage: {
					prompt_tokens: 12,
					completion_tokens: 7,
					total_tokens: 19,
				},
			},
		];

		const message = chunksToMessage(chunks);
		const tokens = calculateMessageTokens(message);
		const durationMs = 350;

		message.metadata = {
			...message.metadata,
			durationMs,
			tokens,
		};

		const node = manager.addMessage(message);

		assert.strictEqual(node.message.data.role, "assistant");
		assert.strictEqual(node.message.data.content, "Paris is the capital of France.");
		assert.strictEqual(node.message.metadata?.tokens, 19);
		assert.strictEqual(node.message.metadata?.durationMs, 350);
		assert.strictEqual(node.message.metadata?.error, undefined);
	});

	it("calculates estimated tokens when chunk usage is omitted", () => {
		const manager = new MessageTreeManager();
		manager.appendMessage("user", "Count this");

		const chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_est_1",
				created: 1,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: "stop",
						delta: { role: "assistant", content: "Short message" },
					},
				],
			},
		];

		const message = chunksToMessage(chunks);
		assert.strictEqual(message.metadata?.tokens, undefined);

		const tokens = calculateMessageTokens(message);
		assert.strictEqual(tokens, 4);

		message.metadata = {
			...message.metadata,
			durationMs: 120,
			tokens,
		};

		const node = manager.addMessage(message);
		assert.strictEqual(node.message.metadata?.tokens, 4);
		assert.strictEqual(node.message.metadata?.durationMs, 120);
	});

	it("records stream failure before completion by creating an error node with metadata", () => {
		const manager = new MessageTreeManager();
		const userNode = manager.appendMessage("user", "Calculate value");

		const errorNode = manager.appendMessage("assistant", "", {
			finishReason: "error",
			metadata: {
				durationMs: 85,
				error: "Failed to fetch: connection refused",
				tokens: 0,
			},
		});

		assert.strictEqual(errorNode.parentId, userNode.id);
		assert.strictEqual(errorNode.message.finishReason, "error");
		assert.strictEqual(errorNode.message.data.role, "assistant");
		assert.strictEqual(errorNode.message.data.content, "");
		assert.strictEqual(errorNode.message.metadata?.error, "Failed to fetch: connection refused");
		assert.strictEqual(errorNode.message.metadata?.tokens, 0);
		assert.strictEqual(errorNode.message.metadata?.durationMs, 85);
	});

	it("records stream failure after partial chunks with partial content and error metadata", () => {
		const manager = new MessageTreeManager();
		manager.appendMessage("user", "Explain quantum computing");

		const partialChunks: ChatCompletionChunk[] = [
			{
				id: "chunk_err_1",
				created: 1,
				model: "any",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						finish_reason: null,
						delta: { role: "assistant", content: "Quantum computers use qubits" },
					},
				],
			},
		];

		const chunkMessage = chunksToMessage(partialChunks);
		const tokens = calculateMessageTokens(chunkMessage);
		const durationMs = 450;
		chunkMessage.finishReason = "error";
		chunkMessage.metadata = {
			...chunkMessage.metadata,
			durationMs,
			error: "Network stream disconnected",
			tokens,
		};

		const errorNode = manager.addMessage(chunkMessage);

		assert.strictEqual(errorNode.message.finishReason, "error");
		assert.strictEqual(errorNode.message.data.content, "Quantum computers use qubits");
		assert.strictEqual(errorNode.message.metadata?.error, "Network stream disconnected");
		assert.strictEqual(errorNode.message.metadata?.durationMs, 450);
		assert.strictEqual(errorNode.message.metadata?.tokens, 7);
	});

	it("supports regeneration flow by rewinding head to parent and adding sibling branch", () => {
		const manager = new MessageTreeManager();
		const userNode = manager.appendMessage("user", "Tell me a joke");
		const firstAssistant = manager.appendMessage("assistant", "Why did the chicken cross the road?", {
			metadata: { tokens: 10, durationMs: 200 },
		});

		assert.strictEqual(manager.getHeadId(), firstAssistant.id);

		const parentId = manager.getParent(firstAssistant.id)?.id ?? null;
		assert.strictEqual(parentId, userNode.id);

		manager.setHead(parentId);
		assert.strictEqual(manager.getHeadId(), userNode.id);

		const regeneratedAssistant = manager.appendMessage("assistant", "Knock knock. Who's there?", {
			metadata: { tokens: 8, durationMs: 180 },
		});

		assert.strictEqual(manager.getHeadId(), regeneratedAssistant.id);
		assert.strictEqual(regeneratedAssistant.parentId, userNode.id);

		const siblings = manager.getSiblings(firstAssistant.id);
		assert.strictEqual(siblings.length, 2);
		assert.strictEqual(siblings[0].id, firstAssistant.id);
		assert.strictEqual(siblings[1].id, regeneratedAssistant.id);
	});

	it("supports message edit flow by branching from parent node", () => {
		const manager = new MessageTreeManager();
		const user1 = manager.appendMessage("user", "Hello first");
		const assistant1 = manager.appendMessage("assistant", "Hello! How can I help?");

		assert.strictEqual(manager.getHeadId(), assistant1.id);

		const parentId = manager.getParent(user1.id)?.id ?? null;
		assert.strictEqual(parentId, null);

		manager.setHead(parentId);
		const editedUser = manager.appendMessage("user", "Hello edited");
		const editedAssistant = manager.appendMessage("assistant", "Greetings from the edited branch!");

		const pathOriginal = manager.getPath(assistant1.id);
		assert.strictEqual(pathOriginal.length, 2);
		assert.strictEqual(pathOriginal[0].id, user1.id);
		assert.strictEqual(pathOriginal[1].id, assistant1.id);

		const pathEdited = manager.getPath(editedAssistant.id);
		assert.strictEqual(pathEdited.length, 2);
		assert.strictEqual(pathEdited[0].id, editedUser.id);
		assert.strictEqual(pathEdited[1].id, editedAssistant.id);
	});

	it("supports message deletion and head restoration", () => {
		const manager = new MessageTreeManager();
		const userNode = manager.appendMessage("user", "Keep this");
		const assistantNode = manager.appendMessage("assistant", "Delete this");

		assert.strictEqual(manager.getHeadId(), assistantNode.id);

		const isHead = manager.getHeadId() === assistantNode.id;
		const parentId = assistantNode.parentId;

		manager.deleteNode(assistantNode.id);

		if (isHead && parentId) {
			manager.setHead(parentId);
		}

		assert.strictEqual(manager.getHeadId(), userNode.id);
		assert.strictEqual(manager.getNode(assistantNode.id), null);
		assert.strictEqual(manager.getMessages().length, 1);
		assert.strictEqual(manager.getMessages()[0].data.content, "Keep this");
	});

});
