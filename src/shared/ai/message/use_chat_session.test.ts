import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSessionLorebookIds } from "./session_lorebooks.ts";
import { ALL_CHAT_TOOLS, runChatStream } from "./use_chat_session.ts";
import { MessageTree } from "./tree.ts";
import { MessageTreeManager } from "./tree_manager.ts";
import { StateStore } from "../../world/state_store.ts";
import { CharacterStateStore } from "../../character/state_store.ts";
import { initializeDirector } from "../../session/director.ts";
import type { InstanceSession } from "../../world/instance_manager.ts";
import type { WorldInstance } from "../../world/types.ts";
import type { OpenAIClient } from "../llm/client.ts";
import type { ChatCompletionMessageParam } from "../llm/common.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import type { ChatCompletionRequest } from "../llm/request.ts";
import { assembleChatPromptMessages } from "../../settings/prompt_registry.ts";

function createMockSession(): InstanceSession {

	const tree = new MessageTree();
	const treeManager = new MessageTreeManager(tree);
	const stateStore = new StateStore({ "player.health": 100 });
	const characterStore = new CharacterStateStore();
	const director = initializeDirector();

	const instance: WorldInstance = {
		id: "inst_test",
		worldId: "world_test",
		title: "Test World",
		universeMode: "isolated",
		injectedVars: {},
		messageTreeData: { rootId: "root", headId: "root", nodes: {} },
		activeStates: { "player.health": 100 },
		createdAt: Date.now(),
		updatedAt: Date.now(),
		events: [],
		chapters: [],
		director,
	};

	return {
		instance,
		stateStore,
		characterStore,
		treeManager,
		director,
		detach: () => {},
	};

}

describe("resolveSessionLorebookIds", () => {

	it("passes every selected instance lore book to the runtime prompt", () => {
		const ids = resolveSessionLorebookIds(
			{
				lorebookIds: ["lore_primary", "lore_secondary"],
				lorebookId: "lore_legacy",
			},
			{
				lorebookIds: ["lore_session"],
				lorebookId: "lore_session_legacy",
			},
		);

		assert.deepEqual(ids, ["lore_primary", "lore_secondary"]);
	});

	it("uses legacy singular ids only when lore book arrays are absent", () => {
		assert.deepEqual(
			resolveSessionLorebookIds(
				{ lorebookId: "lore_instance" },
				{ lorebookId: "lore_session" },
			),
			["lore_instance"],
		);

		assert.deepEqual(
			resolveSessionLorebookIds(
				{},
				{ lorebookIds: ["lore_session_a", "lore_session_b"], lorebookId: "lore_session_legacy" },
			),
			["lore_session_a", "lore_session_b"],
		);
	});

});

describe("runChatStream Autonomous Tool Calling and Request Chaining", () => {

	it("sends requests without restrictive response_format and includes all chat tools with tool_choice auto", async () => {
		const session = createMockSession();
		session.treeManager.appendMessage("user", "Hello world");

		const requests: ChatCompletionRequest[] = [];

		const mockClient = {
			async* streamChatCompletion(_endpoint: string, _apiKey: string, payload: ChatCompletionRequest) {
				requests.push(payload);
				yield {
					id: "chunk_text",
					object: "chat.completion.chunk",
					created: Date.now(),
					model: "any",
					choices: [
						{
							index: 0,
							delta: {
								role: "assistant",
								content: "<character id=\"GUIDE\">Welcome traveler.</character>",
							},
							finish_reason: "stop",
						},
					],
				} as ChatCompletionChunk;
			},
		} as unknown as OpenAIClient;

		await runChatStream({
			session,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 1);
		assert.strictEqual(requests[0].response_format, undefined);
		assert.strictEqual(requests[0].tool_choice, "auto");
		assert.strictEqual(requests[0].tools?.length, ALL_CHAT_TOOLS.length);

		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 2);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.ok(messages[1].data.content?.includes("Welcome traveler"));
	});

	it("executes autonomous tool calls, updates world states, appends tool results, and sends follow-up requests", async () => {
		const session = createMockSession();
		session.treeManager.appendMessage("user", "The goblin attacks me for 20 damage");

		const turn1Chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_tool_1",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							tool_calls: [
								{
									id: "call_damage_1",
									type: "function",
									function: {
										name: "mutate_world_state",
										arguments: JSON.stringify({
											operations: [
												{
													type: "set",
													key: "player.health",
													value: 80,
												},
											],
										}),
									},
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
			} as ChatCompletionChunk,
		];

		const turn2Chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_text_2",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "<character id=\"NARRATOR\">The goblin swings its rusty dagger and cuts your arm.</character>",
						},
						finish_reason: "stop",
					},
				],
			} as ChatCompletionChunk,
		];

		const turns = [turn1Chunks, turn2Chunks];
		let currentTurn = 0;
		const requests: ChatCompletionRequest[] = [];

		const mockClient = {
			async* streamChatCompletion(_endpoint: string, _apiKey: string, payload: ChatCompletionRequest) {
				requests.push(payload);
				const chunks = turns[currentTurn] || [];
				currentTurn++;
				for (const chunk of chunks) {
					yield chunk;
				}
			},
		} as unknown as OpenAIClient;

		await runChatStream({
			session,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 2);

		// Turn 2 must include the tool call result
		const turn2Messages = requests[1].messages;
		const toolMessage = turn2Messages.find((m: ChatCompletionMessageParam) => m.role === "tool");
		assert.ok(toolMessage);
		assert.strictEqual((toolMessage as { tool_call_id: string }).tool_call_id, "call_damage_1");

		// State store must be updated
		assert.strictEqual(session.stateStore.getState("player.health"), 80);

		// Tree must contain user, assistant with tool_call, tool result, and final assistant message
		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 4);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.strictEqual(messages[2].data.role, "tool");
		assert.strictEqual(messages[3].data.role, "assistant");
		assert.ok(messages[3].data.content?.includes("cuts your arm"));
	});

	it("chains multiple tool calls in sequence across multiple requests", async () => {
		const session = createMockSession();
		session.treeManager.appendMessage("user", "I discover an ancient ruin");

		const turn1Chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_turn1",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							tool_calls: [
								{
									id: "call_state_ruin",
									type: "function",
									function: {
										name: "update_world_state",
										arguments: JSON.stringify({
											key: "location",
											value: "Ancient Ruin",
										}),
									},
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
			} as ChatCompletionChunk,
		];

		const turn2Chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_turn2",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							tool_calls: [
								{
									id: "call_event_ruin",
									type: "function",
									function: {
										name: "add_session_event",
										arguments: JSON.stringify({
											type: "narrative",
											summary: "Discovered ancient ruins of the first kingdom",
										}),
									},
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
			} as ChatCompletionChunk,
		];

		const turn3Chunks: ChatCompletionChunk[] = [
			{
				id: "chunk_turn3",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "<character id=\"NARRATOR\">Towering stone columns rise from the mist ahead.</character>",
						},
						finish_reason: "stop",
					},
				],
			} as ChatCompletionChunk,
		];

		const turns = [turn1Chunks, turn2Chunks, turn3Chunks];
		let currentTurn = 0;
		const requests: ChatCompletionRequest[] = [];

		const mockClient = {
			async* streamChatCompletion(_endpoint: string, _apiKey: string, payload: ChatCompletionRequest) {
				requests.push(payload);
				const chunks = turns[currentTurn] || [];
				currentTurn++;
				for (const chunk of chunks) {
					yield chunk;
				}
			},
		} as unknown as OpenAIClient;

		await runChatStream({
			session,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 3);
		assert.strictEqual(session.stateStore.getState("location"), "Ancient Ruin");
		assert.ok(session.instance.events);
		assert.strictEqual(session.instance.events.length, 1);
		assert.strictEqual(session.instance.events[0].type, "narrative");

		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 6);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.strictEqual(messages[2].data.role, "tool");
		assert.strictEqual(messages[3].data.role, "assistant");
		assert.strictEqual(messages[4].data.role, "tool");
		assert.strictEqual(messages[5].data.role, "assistant");
	});

	it("places tool messages at the conversation end during tool continuation turns", () => {
		const sessionMessages: ChatCompletionMessageParam[] = [
			{ role: "user", content: "Attack" },
			{
				role: "assistant",
				tool_calls: [
					{
						id: "call_123",
						type: "function",
						function: { name: "mutate_world_state", arguments: "{}" },
					},
				],
			},
			{
				role: "tool",
				content: JSON.stringify({ status: "success" }),
				tool_call_id: "call_123",
			},
		];

		const assembled = assembleChatPromptMessages(
			sessionMessages,
			undefined,
			{ "player.health": 80 },
		);

		const lastMessage = assembled[assembled.length - 1];
		assert.strictEqual(lastMessage.role, "tool");
		assert.strictEqual((lastMessage as { tool_call_id: string }).tool_call_id, "call_123");
	});

});
