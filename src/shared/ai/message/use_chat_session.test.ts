import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSessionLorebookIds } from "./session_lorebooks.ts";
import { runChatStream } from "./use_chat_session.ts";
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

function createMockSession(initialCharacters?: any[]): InstanceSession {

	const tree = new MessageTree();
	const treeManager = new MessageTreeManager(tree);
	const stateStore = new StateStore({ "player.health": 100 });
	const characterStore = new CharacterStateStore(initialCharacters);
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

describe("runChatStream XML Command Execution and Turn Handling", () => {

	it("sends requests without tools or tool_choice in completion payload", async () => {
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
		assert.strictEqual(requests[0].tools, undefined);
		assert.strictEqual(requests[0].tool_choice, undefined);

		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 2);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.ok(messages[1].data.content?.includes("Welcome traveler"));
	});

	it("applies inline XML state commands and sanitizes stored message text", async () => {
		const session = createMockSession();
		session.treeManager.appendMessage("user", "The goblin attacks me for 20 damage");

		const mockClient = {
			async* streamChatCompletion(_endpoint: string, _apiKey: string) {
				yield {
					id: "chunk_turn",
					object: "chat.completion.chunk",
					created: Date.now(),
					model: "any",
					choices: [
						{
							index: 0,
							delta: {
								role: "assistant",
								content: `<state key="player.health" value="80" />
<character id="NARRATOR">The goblin swings its rusty dagger and cuts your arm.</character>`,
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

		// State store must be updated to 80
		assert.strictEqual(session.stateStore.getState("player.health"), 80);

		// Single turn completion: user and assistant message (no tool messages)
		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 2);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.strictEqual(
			messages[1].data.content,
			"<character id=\"NARRATOR\">The goblin swings its rusty dagger and cuts your arm.</character>",
		);
		// Verify raw command tags are stripped from stored message content
		assert.ok(!messages[1].data.content?.includes("<state"));
	});

	it("applies state, character, event, and director commands in a single turn", async () => {
		const hero = {
			id: "hero",
			name: "Hero",
			isNpc: false,
			thoughts: [],
			emotions: [],
			goals: [],
			states: {},
		};
		const session = createMockSession([hero]);
		session.treeManager.appendMessage("user", "I discover an ancient ruin");

		const mockClient = {
			async* streamChatCompletion() {
				yield {
					id: "chunk_combined",
					object: "chat.completion.chunk",
					created: Date.now(),
					model: "any",
					choices: [
						{
							index: 0,
							delta: {
								role: "assistant",
								content: `<state key="location" value="Ancient Ruin" />
<state character="Hero" category="emotion" name="awe" value="high" />
<event type="narrative" summary="Discovered ancient ruins of the first kingdom" />
<director thought="Player discovered lore milestone" plan="Reveal guardian next turn" instructions="Focus on mystery" />
<character id="NARRATOR">Towering stone columns rise from the mist ahead.</character>`,
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

		// World state updated
		assert.strictEqual(session.stateStore.getState("location"), "Ancient Ruin");

		// Character state updated
		const heroInstance = session.characterStore.getInstance("Hero");
		assert.ok(heroInstance);
		const aweEmotion = heroInstance?.emotions.find(e => e.name === "awe");
		assert.ok(aweEmotion);
		assert.strictEqual(aweEmotion?.internal_monologue, "high");

		// Event log updated
		assert.ok(session.instance.events);
		assert.strictEqual(session.instance.events.length, 1);
		assert.strictEqual(session.instance.events[0].type, "narrative");
		assert.strictEqual(session.instance.events[0].summary, "Discovered ancient ruins of the first kingdom");

		// Director updated
		assert.ok(session.director.thoughts.includes("Player discovered lore milestone"));
		assert.ok(session.director.plans.includes("Reveal guardian next turn"));
		assert.strictEqual(session.director.instructions, "Focus on mystery");

		// Stored message tree contains cleaned content
		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 2);
		assert.ok(!messages[1].data.content?.includes("<state"));
		assert.ok(!messages[1].data.content?.includes("<event"));
		assert.ok(!messages[1].data.content?.includes("<director"));
		assert.ok(messages[1].data.content?.includes("Towering stone columns"));
	});

	it("continues multi-character turns when <turn> tag is present", async () => {
		const session = createMockSession();
		session.treeManager.appendMessage("user", "Start dialogue");

		let turnCount = 0;
		const mockClient = {
			async* streamChatCompletion() {
				turnCount++;
				if (turnCount === 1) {
					yield {
						id: "chunk_turn_1",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: "any",
						choices: [
							{
								index: 0,
								delta: {
									role: "assistant",
									content: `<character id="ALICE" name="Alice">Hello Bob!</character>
<turn target="BOB" name="Bob" />`,
								},
								finish_reason: "stop",
							},
						],
					} as ChatCompletionChunk;
				}
				else {
					yield {
						id: "chunk_turn_2",
						object: "chat.completion.chunk",
						created: Date.now(),
						model: "any",
						choices: [
							{
								index: 0,
								delta: {
									role: "assistant",
									content: `<character id="BOB" name="Bob">Hey Alice, good to see you.</character>`,
								},
								finish_reason: "stop",
							},
						],
					} as ChatCompletionChunk;
				}
			},
		} as unknown as OpenAIClient;

		await runChatStream({
			session,
			client: mockClient,
		});

		assert.strictEqual(turnCount, 2);

		const messages = session.treeManager.getMessages();
		assert.strictEqual(messages.length, 4);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.strictEqual(messages[2].data.role, "user");
		assert.strictEqual(messages[3].data.role, "assistant");
		assert.ok(messages[2].data.content?.includes("Speak as character Bob (ID: BOB)"));
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
