import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAssistantTreeManager, resetAssistantSessions, runAssistantStream } from "./use_assistant_session.ts";
import { createStagedModificationStore } from "./tools.ts";
import type { AssistantDiffPayload } from "./types.ts";
import type { OpenAIClient } from "../llm/client.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import type { ChatCompletionRequest } from "../llm/request.ts";

describe("Assistant Session and Tab Isolation", () => {

	beforeEach(() => {
		resetAssistantSessions();
	});

	it("maintains isolated tree managers for each supported tab", () => {
		const worldManager = getAssistantTreeManager("world-manager");
		const universeManager = getAssistantTreeManager("universe-manager");
		const settingsManager = getAssistantTreeManager("settings");

		assert.notStrictEqual(worldManager, universeManager);
		assert.notStrictEqual(universeManager, settingsManager);
		assert.notStrictEqual(worldManager, settingsManager);

		// Mutate world manager
		worldManager.appendMessage("user", "Hello World Assistant");
		worldManager.appendMessage("assistant", "I am ready to help build characters.");

		// Verify universe and settings remain isolated
		assert.strictEqual(worldManager.getPath().length, 2);
		assert.strictEqual(universeManager.getPath().length, 0);
		assert.strictEqual(settingsManager.getPath().length, 0);

		// Mutate universe manager
		universeManager.appendMessage("user", "Suggest universe rules");
		assert.strictEqual(universeManager.getPath().length, 1);
		assert.strictEqual(worldManager.getPath().length, 2);
		assert.strictEqual(settingsManager.getPath().length, 0);
	});

	it("preserves message branch history across repeated manager lookups", () => {
		const manager1 = getAssistantTreeManager("world-manager");
		manager1.appendMessage("user", "Draft faction lore");

		const manager2 = getAssistantTreeManager("world-manager");
		assert.strictEqual(manager1, manager2);
		assert.strictEqual(manager2.getPath().length, 1);
		assert.strictEqual(manager2.getPath()[0].message.data.content, "Draft faction lore");
	});

	it("resets assistant tab sessions on demand", () => {
		const manager = getAssistantTreeManager("settings");
		manager.appendMessage("user", "Configure narrator prompt");
		assert.strictEqual(manager.getPath().length, 1);

		resetAssistantSessions();
		const newManager = getAssistantTreeManager("settings");
		assert.notStrictEqual(manager, newManager);
		assert.strictEqual(newManager.getPath().length, 0);
	});

	it("handles staged diff apply and reject callbacks with status updates", () => {
		const store = createStagedModificationStore();
		let appliedPayload: AssistantDiffPayload | null = null;

		const payload: AssistantDiffPayload = {
			toolCallId: "call_diff_test",
			tab: "world-manager",
			title: "Add Character",
			originalText: "version = '1.0'",
			proposedText: "version = '1.0'\n[[characters]]\nname = 'Test'",
			status: "pending",
		};

		store.stage(payload);
		assert.strictEqual(store.getStaged("call_diff_test")?.status, "pending");

		// Apply callback simulation
		const applied = store.apply("call_diff_test");
		if (applied) {
			appliedPayload = applied;
		}

		assert.ok(appliedPayload);
		assert.strictEqual(appliedPayload.status, "applied");
		assert.strictEqual(store.getStaged("call_diff_test")?.status, "applied");

		// Reject flow
		const rejectPayload: AssistantDiffPayload = {
			toolCallId: "call_diff_reject",
			tab: "universe-manager",
			title: "Add Rule",
			originalText: "rules = []",
			proposedText: "rules = ['Permadeath']",
			status: "pending",
		};

		store.stage(rejectPayload);
		const rejected = store.reject("call_diff_reject");
		assert.ok(rejected);
		assert.strictEqual(rejected.status, "rejected");
		assert.strictEqual(store.getStaged("call_diff_reject")?.status, "rejected");
	});

	it("formats choice selections into user turn messages", () => {
		const manager = getAssistantTreeManager("world-manager");

		// Simulated assistant message with recommendation choice tags
		manager.appendMessage(
			"assistant",
			"Here are suggestions:\n<choices mode=\"single\">\n<choice>Explore Ruins</choice>\n<choice>Visit Citadel</choice>\n</choices>",
		);

		// Simulating user clicking choice "Explore Ruins"
		const selectedChoice = "Explore Ruins";
		manager.appendMessage("user", selectedChoice);

		const branch = manager.getPath();
		assert.strictEqual(branch.length, 2);
		assert.strictEqual(branch[1].message.data.role, "user");
		assert.strictEqual(branch[1].message.data.content, "Explore Ruins");
	});

	it("records stream error state in tree while preserving prior message history", () => {
		const manager = getAssistantTreeManager("settings");
		manager.appendMessage("user", "Configure prompts");

		// Simulating stream failure recording
		const errorMessage = "Network timeout to LLM gateway";
		manager.appendMessage("assistant", `Error: ${errorMessage}`, {
			finishReason: "error",
			metadata: {
				error: errorMessage,
				durationMs: 450,
				tokens: 0,
			},
		});

		const branch = manager.getPath();
		assert.strictEqual(branch.length, 2);
		assert.strictEqual(branch[0].message.data.content, "Configure prompts");
		assert.ok(branch[1].message.data.content?.includes("Error: Network timeout"));
		assert.strictEqual(branch[1].message.metadata?.error, errorMessage);
	});

	it("notifies subscribers when lore wizard messages are appended", () => {
		const loreManager = getAssistantTreeManager("lore");
		let notificationCount = 0;

		const unsubscribe = loreManager.subscribe(() => {
			notificationCount++;
		});

		loreManager.appendMessage("user", "Draft lore entry about the Ancient Ruins");
		assert.strictEqual(notificationCount, 1);
		assert.strictEqual(loreManager.getMessages().length, 1);
		assert.strictEqual(loreManager.getMessages()[0].data.content, "Draft lore entry about the Ancient Ruins");

		loreManager.appendMessage("assistant", "The Ancient Ruins stand high above the mist...");
		assert.strictEqual(notificationCount, 2);
		assert.strictEqual(loreManager.getMessages().length, 2);

		unsubscribe();
		loreManager.appendMessage("user", "Add details about the gate");
		assert.strictEqual(notificationCount, 2);
		assert.strictEqual(loreManager.getMessages().length, 3);
	});

	it("executes autonomous tool call, stages modification, stops request loop, and sends follow-up after user applies diff", async () => {
		const manager = getAssistantTreeManager("world-manager");
		manager.appendMessage("user", "Create a wizard character");

		const store = createStagedModificationStore();

		const turn1 = [
			{
				id: "chunk_tool",
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
									id: "call_world_wizard",
									type: "function",
									function: {
										name: "propose_world_modification",
										arguments: JSON.stringify({
											title: "Add Wizard Eldrin",
											proposedToml: "name = \"Fantasy World\"\n\n[[characters]]\nname = \"Eldrin\"\n",
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

		const turn2 = [
			{
				id: "chunk_text",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "I have added Eldrin to the world.",
						},
						finish_reason: "stop",
					},
				],
			} as ChatCompletionChunk,
		];

		const requests: ChatCompletionRequest[] = [];
		let currentTurn = 0;
		const turns = [turn1, turn2];

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

		await runAssistantStream({
			tab: "world-manager",
			manager,
			contextData: {
				tab: "world-manager",
				activeId: "world_1",
				rawToml: "name = \"Fantasy World\"\n",
			},
			store,
			client: mockClient,
		});

		// Turn 1 should stage the proposal and stop without automatically sending the follow-up request
		assert.strictEqual(requests.length, 1);
		assert.ok(requests[0].tools && requests[0].tools.length > 0);
		assert.strictEqual(requests[0].tool_choice, "auto");

		const stagedItems = store.getAllStaged();
		assert.strictEqual(stagedItems.length, 1);
		assert.strictEqual(stagedItems[0].toolCallId, "call_world_wizard");
		assert.strictEqual(stagedItems[0].status, "pending");
		assert.strictEqual(stagedItems[0].title, "Add Wizard Eldrin");
		assert.ok(stagedItems[0].proposedText.includes("Eldrin"));

		const initialMessages = manager.getMessages();
		assert.strictEqual(initialMessages.length, 3);
		assert.strictEqual(initialMessages[0].data.role, "user");
		assert.strictEqual(initialMessages[1].data.role, "assistant");
		assert.strictEqual(initialMessages[2].data.role, "tool");

		// Simulate user interaction: user applies the staged diff
		const applied = store.apply("call_world_wizard");
		assert.ok(applied);
		assert.strictEqual(applied.status, "applied");

		const toolNode = manager.getPath().find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === "call_world_wizard",
		);
		assert.ok(toolNode);

		manager.updateMessageContent(
			toolNode.id,
			JSON.stringify({
				status: "applied",
				toolCallId: "call_world_wizard",
				title: applied.title,
				message: `Proposed changes for "${applied.title}" were approved and applied to the editor by the user.`,
			}),
		);

		// Follow-up request is now sent after user interaction
		await runAssistantStream({
			tab: "world-manager",
			manager,
			contextData: {
				tab: "world-manager",
				activeId: "world_1",
				rawToml: applied.proposedText,
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 2);

		const turn2Messages = requests[1].messages;
		const followUpToolMessage = turn2Messages.find(m => m.role === "tool");
		assert.ok(followUpToolMessage);
		assert.strictEqual((followUpToolMessage as { tool_call_id: string }).tool_call_id, "call_world_wizard");

		const finalMessages = manager.getMessages();
		assert.strictEqual(finalMessages.length, 4);
		assert.strictEqual(finalMessages[0].data.role, "user");
		assert.strictEqual(finalMessages[1].data.role, "assistant");
		assert.strictEqual(finalMessages[2].data.role, "tool");
		assert.strictEqual(finalMessages[3].data.role, "assistant");
		assert.ok(finalMessages[3].data.content?.includes("Eldrin"));
	});

	it("executes autonomous tool call, stages modification, stops request loop, and sends follow-up after user rejects diff", async () => {
		const manager = getAssistantTreeManager("world-manager");
		manager.appendMessage("user", "Create a wizard character");

		const store = createStagedModificationStore();

		const turn1 = [
			{
				id: "chunk_tool",
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
									id: "call_world_wizard",
									type: "function",
									function: {
										name: "propose_world_modification",
										arguments: JSON.stringify({
											title: "Add Wizard Eldrin",
											proposedToml: "name = \"Fantasy World\"\n\n[[characters]]\nname = \"Eldrin\"\n",
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

		const turn2 = [
			{
				id: "chunk_text",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "Understood, I discarded the proposal.",
						},
						finish_reason: "stop",
					},
				],
			} as ChatCompletionChunk,
		];

		const requests: ChatCompletionRequest[] = [];
		let currentTurn = 0;
		const turns = [turn1, turn2];

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

		await runAssistantStream({
			tab: "world-manager",
			manager,
			contextData: {
				tab: "world-manager",
				activeId: "world_1",
				rawToml: "name = \"Fantasy World\"\n",
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 1);

		// Simulate user interaction: user rejects the staged diff
		const rejected = store.reject("call_world_wizard");
		assert.ok(rejected);
		assert.strictEqual(rejected.status, "rejected");

		const toolNode = manager.getPath().find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === "call_world_wizard",
		);
		assert.ok(toolNode);

		manager.updateMessageContent(
			toolNode.id,
			JSON.stringify({
				status: "rejected",
				toolCallId: "call_world_wizard",
				title: rejected.title,
				message: `Proposed changes for "${rejected.title}" were rejected by the user.`,
			}),
		);

		// Follow-up request is sent after rejection
		await runAssistantStream({
			tab: "world-manager",
			manager,
			contextData: {
				tab: "world-manager",
				activeId: "world_1",
				rawToml: "name = \"Fantasy World\"\n",
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 2);

		const finalMessages = manager.getMessages();
		assert.strictEqual(finalMessages.length, 4);
		assert.strictEqual(finalMessages[3].data.role, "assistant");
		assert.ok(finalMessages[3].data.content?.includes("discarded"));
	});

	it("chains multiple tool calls with sequential user interactions, updating editor context across requests", async () => {
		const manager = getAssistantTreeManager("lore");
		manager.appendMessage("user", "Create two lore entries");

		const store = createStagedModificationStore();

		const turn1 = [
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
									id: "call_lore_1",
									type: "function",
									function: {
										name: "propose_lore_modification",
										arguments: JSON.stringify({
											title: "Add Citadel Entry",
											proposedToml: "name = \"Lorebook\"\n\n[[entries]]\nid = \"citadel\"\ntitle = \"The Citadel\"\ncontent = \"High fortress\"\n",
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

		const turn2 = [
			{
				id: "chunk_tool_2",
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
									id: "call_lore_2",
									type: "function",
									function: {
										name: "propose_lore_modification",
										arguments: JSON.stringify({
											title: "Add Ruins Entry",
											operation: "insert",
											startLine: 6,
											position: "after",
											content: "\n[[entries]]\nid = \"ruins\"\ntitle = \"Ancient Ruins\"\ncontent = \"Old temple\"",
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

		const turn3 = [
			{
				id: "chunk_text_final",
				object: "chat.completion.chunk",
				created: Date.now(),
				model: "any",
				choices: [
					{
						index: 0,
						delta: {
							role: "assistant",
							content: "Added both Citadel and Ruins entries to the lorebook.",
						},
						finish_reason: "stop",
					},
				],
			} as ChatCompletionChunk,
		];

		const requests: ChatCompletionRequest[] = [];
		let currentTurn = 0;
		const turns = [turn1, turn2, turn3];

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

		let currentEditorToml = "name = \"Lorebook\"\n";

		// Turn 1
		await runAssistantStream({
			tab: "lore",
			manager,
			contextData: {
				tab: "lore",
				activeId: "lore_book_1",
				rawToml: currentEditorToml,
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 1);
		const stagedTurn1 = store.getAllStaged();
		assert.strictEqual(stagedTurn1.length, 1);
		assert.strictEqual(stagedTurn1[0].toolCallId, "call_lore_1");

		// User applies first diff
		const applied1 = store.apply("call_lore_1");
		assert.ok(applied1);
		currentEditorToml = applied1.proposedText;

		const toolNode1 = manager.getPath().find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === "call_lore_1",
		);
		assert.ok(toolNode1);
		manager.updateMessageContent(
			toolNode1.id,
			JSON.stringify({
				status: "applied",
				toolCallId: "call_lore_1",
				message: "Applied first change.",
			}),
		);

		// Turn 2 after user interaction
		await runAssistantStream({
			tab: "lore",
			manager,
			contextData: {
				tab: "lore",
				activeId: "lore_book_1",
				rawToml: currentEditorToml,
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 2);
		const stagedTurn2 = store.getAllStaged();
		assert.strictEqual(stagedTurn2.length, 2);
		assert.strictEqual(stagedTurn2[1].toolCallId, "call_lore_2");

		// User applies second diff
		const applied2 = store.apply("call_lore_2");
		assert.ok(applied2);
		currentEditorToml = applied2.proposedText;

		const toolNode2 = manager.getPath().find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === "call_lore_2",
		);
		assert.ok(toolNode2);
		manager.updateMessageContent(
			toolNode2.id,
			JSON.stringify({
				status: "applied",
				toolCallId: "call_lore_2",
				message: "Applied second change.",
			}),
		);

		// Turn 3 after user interaction
		await runAssistantStream({
			tab: "lore",
			manager,
			contextData: {
				tab: "lore",
				activeId: "lore_book_1",
				rawToml: currentEditorToml,
			},
			store,
			client: mockClient,
		});

		assert.strictEqual(requests.length, 3);

		const staged = store.getAllStaged();
		assert.strictEqual(staged.length, 2);
		assert.strictEqual(staged[0].toolCallId, "call_lore_1");
		assert.strictEqual(staged[1].toolCallId, "call_lore_2");

		assert.ok(staged[1].originalText.includes("The Citadel"));
		assert.ok(staged[1].proposedText.includes("The Citadel"));
		assert.ok(staged[1].proposedText.includes("Ancient Ruins"));

		const messages = manager.getMessages();
		assert.strictEqual(messages.length, 6);
		assert.strictEqual(messages[0].data.role, "user");
		assert.strictEqual(messages[1].data.role, "assistant");
		assert.strictEqual(messages[2].data.role, "tool");
		assert.strictEqual(messages[3].data.role, "assistant");
		assert.strictEqual(messages[4].data.role, "tool");
		assert.strictEqual(messages[5].data.role, "assistant");
	});

});
