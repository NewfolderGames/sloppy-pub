import { type SubmitEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { OpenAIClient } from "../llm/client.ts";
import type { ChatCompletionMessageParam } from "../llm/common.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import type { ChatCompletionRequest } from "../llm/request.ts";
import { calculateMessageTokens, chunksToMessage, type Message } from "./node.ts";
import { formatTurnInstruction, parseRoleplayResponse, stripCommandTags } from "./parser.ts";
import { useMessageTree } from "./use_message_tree.ts";
import { getCharacterfile } from "../../character/registry.ts";
import { CharacterStateStore } from "../../character/state_store.ts";
import { CHARACTER_TOOL_DEFINITIONS } from "../../character/tools.ts";
import type { Characterfile } from "../../character/types.ts";
import { LORE_TOOL_DEFINITIONS } from "../../lore/tools.ts";
import { assembleChatPromptMessages } from "../../settings/prompt_registry.ts";
import { resolveSessionLorebookIds } from "./session_lorebooks.ts";
import { createInstanceSession, type InstanceSession, saveInstance } from "../../world/instance_manager.ts";
import { STATE_TOOL_DEFINITIONS } from "../../world/state_store.ts";
import { addSessionEvent, EVENT_TOOL_DEFINITIONS } from "../../world/tools/event_tools.ts";
import { CHAPTER_TOOL_DEFINITIONS } from "../../world/tools/chapter_tools.ts";
import { DIRECTOR_TOOL_DEFINITIONS } from "../../world/tools/director_tools.ts";
import { updateDirectorPlan, updateDirectorThought } from "../../session/director.ts";
import type { WorldInstance, WorldStates } from "../../world/types.ts";

export const ALL_CHAT_TOOLS = [
	...STATE_TOOL_DEFINITIONS,
	...CHARACTER_TOOL_DEFINITIONS,
	...LORE_TOOL_DEFINITIONS,
	...EVENT_TOOL_DEFINITIONS,
	...CHAPTER_TOOL_DEFINITIONS,
	...DIRECTOR_TOOL_DEFINITIONS,
];

export interface RunChatStreamOptions {
	session: InstanceSession;
	additionalMessages?: ChatCompletionMessageParam[];
	client?: OpenAIClient;
	endpoint?: string;
	apiKey?: string;
	onChunk?: (chunks: ChatCompletionChunk[]) => void;
}

export async function runChatStream(options: RunChatStreamOptions): Promise<void> {

	const {
		session,
		additionalMessages = [],
		onChunk,
	} = options;

	const client = options.client ?? OpenAIClient.getInstance();
	const endpoint = options.endpoint
		|| ((typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:8080");
	const apiKey = options.apiKey
		|| ((typeof import.meta !== "undefined" && import.meta.env?.VITE_API_KEY) || "");

	let currentAdditionalMessages = additionalMessages;
	let loopCount = 0;
	const MAX_LOOPS = 10;

	while (loopCount < MAX_LOOPS) {

		loopCount++;
		const startTime = performance.now();

		onChunk?.([]);

		const sessionMessages = session.treeManager.getLLMContext(null, currentAdditionalMessages);
		const currentActiveStates = session.stateStore.getAllStates();
		const characterInstances = session.characterStore.getAllInstances();
		const characterFiles = (session.instance.characterIds || [])
			.map(id => getCharacterfile(id)?.characterfile)
			.filter((c): c is Characterfile => c !== undefined);

		const latestUserMessage = [...sessionMessages]
			.reverse()
			.find(m => m.role === "user" && typeof m.content === "string")
			?.content as string | undefined;

		const params = assembleChatPromptMessages(
			sessionMessages,
			undefined,
			currentActiveStates,
			session.worldPrompt,
			characterFiles,
			characterInstances,
			resolveSessionLorebookIds(session.instance, session),
			latestUserMessage,
			session.instance.events,
			session.instance.chapters,
			session.instance.compacted ?? (session.instance as any).isCompacted,
			session.director,
		);

		const requestPayload: ChatCompletionRequest = {
			model: "any",
			messages: params,
			stream: true,
			stream_options: { include_usage: true },
		};

		const api = client.streamChatCompletion(endpoint, apiKey, requestPayload);
		const chunks: ChatCompletionChunk[] = [];

		try {
			for await (const chunk of api) {
				chunks.push(chunk);
				onChunk?.([...chunks]);
			}
		}
		catch (error) {

			const durationMs = Math.round(performance.now() - startTime);
			const errorMessage = error instanceof Error ? error.message : String(error);

			onChunk?.([]);

			if (chunks.length > 0) {
				try {
					const chunkMessage = chunksToMessage(chunks);
					const tokens = calculateMessageTokens(chunkMessage);

					chunkMessage.finishReason = "error";
					chunkMessage.metadata = {
						...chunkMessage.metadata,
						durationMs,
						error: errorMessage,
						tokens,
					};

					session.treeManager.addMessage(chunkMessage, undefined, currentActiveStates);
				}
				catch {
					session.treeManager.appendMessage("assistant", "", {
						finishReason: "error",
						stateSnapshot: currentActiveStates,
						metadata: {
							durationMs,
							error: errorMessage,
							tokens: 0,
						},
					});
				}
			}
			else {
				session.treeManager.appendMessage("assistant", "", {
					finishReason: "error",
					stateSnapshot: currentActiveStates,
					metadata: {
						durationMs,
						error: errorMessage,
						tokens: 0,
					},
				});
			}

			break;

		}

		if (chunks.length === 0) {
			onChunk?.([]);
			break;
		}

		const durationMs = Math.round(performance.now() - startTime);
		const chunkMessage = chunksToMessage(chunks);
		const tokens = calculateMessageTokens(chunkMessage);

		chunkMessage.metadata = {
			...chunkMessage.metadata,
			durationMs,
			tokens,
		};

		onChunk?.([]);

		const rawContent = chunkMessage.data.content;
		const parsed = parseRoleplayResponse(rawContent);

		// Apply Extracted XML Commands
		if (parsed.commands) {

			if (parsed.commands.states && parsed.commands.states.length > 0) {

				for (const stateCmd of parsed.commands.states) {

					if (stateCmd.character) {

						if (session.characterStore) {

							const category = stateCmd.category ?? "state";

							if (category === "thought") {

								if (stateCmd.op === "delete") {
									session.characterStore.deleteThought(
										stateCmd.character,
										stateCmd.name || stateCmd.key,
									);
								}
								else {
									session.characterStore.setThought(stateCmd.character, {
										title: stateCmd.name || stateCmd.key || "Recent Thought",
										internal_monologue:
											typeof stateCmd.value === "string"
												? stateCmd.value
												: String(stateCmd.value),
									});
								}

							}
							else if (category === "emotion") {

								if (stateCmd.op === "delete") {
									session.characterStore.deleteEmotion(
										stateCmd.character,
										stateCmd.name || stateCmd.key,
									);
								}
								else {
									session.characterStore.setEmotion(stateCmd.character, {
										name: stateCmd.name || stateCmd.key || "Recent Emotion",
										internal_monologue:
											typeof stateCmd.value === "string"
												? stateCmd.value
												: String(stateCmd.value),
									});
								}

							}
							else if (category === "goal") {

								if (stateCmd.op === "delete") {
									session.characterStore.deleteGoal(
										stateCmd.character,
										stateCmd.name || stateCmd.key,
									);
								}
								else {
									session.characterStore.setGoal(stateCmd.character, {
										name: stateCmd.name || stateCmd.key || "Goal",
										internal_monologue:
											typeof stateCmd.value === "string"
												? stateCmd.value
												: String(stateCmd.value),
									});
								}

							}
							else {

								if (stateCmd.op === "delete") {
									session.characterStore.deleteState(
										stateCmd.character,
										stateCmd.key || stateCmd.name || "",
									);
								}
								else {
									session.characterStore.setState(
										stateCmd.character,
										stateCmd.key || stateCmd.name || "",
										stateCmd.value,
									);
								}

							}

						}

					}
					else if (stateCmd.key && session.stateStore) {

						if (stateCmd.op === "delete") {
							session.stateStore.deleteState(stateCmd.key);
						}
						else {
							session.stateStore.setState(stateCmd.key, stateCmd.value);
						}

					}

				}

			}

			if (parsed.commands.events && parsed.commands.events.length > 0) {

				for (const eventCmd of parsed.commands.events) {
					addSessionEvent(session.instance, {
						type: eventCmd.type,
						summary: eventCmd.summary,
						details: eventCmd.details,
					});
				}

			}

			if (parsed.commands.director && session.director) {

				if (parsed.commands.director.thought) {
					updateDirectorThought(session.director, parsed.commands.director.thought);
				}

				if (parsed.commands.director.plan) {
					updateDirectorPlan(session.director, parsed.commands.director.plan);
				}

				if (parsed.commands.director.instructions) {
					session.director.instructions = parsed.commands.director.instructions.trim();
				}

				saveInstance(session.instance);

			}

		}

		// Save Sanitized Narrative Text Without Command Tags
		chunkMessage.data.content = stripCommandTags(rawContent);

		const updatedSnapshot = session.stateStore.getAllStates();
		session.treeManager.addMessage(chunkMessage, undefined, updatedSnapshot);

		// Turn Passing Check
		if (parsed.nextTurn && parsed.nextTurn.type !== "user") {

			const turnInstruction = formatTurnInstruction(parsed.nextTurn);

			session.treeManager.appendMessage("user", `<character id="APP">${turnInstruction}</character>`, {
				isRequest: true,
				finishReason: "app",
				stateSnapshot: session.stateStore.getAllStates(),
			});

			currentAdditionalMessages = [];

		}
		else {
			break;
		}

	}

}

export interface UseChatSessionResult {
	session: InstanceSession;
	characterStore: CharacterStateStore;
	messages: Message[];
	headId: string | null;
	activeStates: WorldStates;
	generating: boolean;
	isGenerating: boolean;
	messageGenerating: ChatCompletionChunk[] | null;
	messageGeneratingMessage: Message | null;
	runStream: (additionalMessages?: ChatCompletionMessageParam[]) => Promise<void>;
	onChoiceSelect: (selectionText: string) => Promise<void>;
	onSubmit: (e: SubmitEvent<HTMLFormElement>) => Promise<void>;
	onRegenerateMessage: (messageId: string) => Promise<void>;
	onEditMessage: (messageId: string, newContent: string) => Promise<void>;
	onDeleteMessage: (messageId: string) => void;
	onRetryMessage: (messageId: string) => Promise<void>;
	onRegenerate: (messageId: string) => Promise<void>;
	onEdit: (messageId: string, newContent: string) => Promise<void>;
	onDelete: (messageId: string) => void;
	onRetry: (messageId: string) => Promise<void>;
}

export interface UseChatSessionOptions {
	client?: OpenAIClient;
}

export function useChatSession(
	activeInstance: WorldInstance,
	options?: UseChatSessionOptions,
): UseChatSessionResult {

	// Active Session instance
	const session = useMemo(() => {
		return createInstanceSession(activeInstance);
	}, [activeInstance]);

	useEffect(() => {
		return () => {
			session.detach();
		};
	}, [session]);

	const subscribeStates = useCallback(
		(onStoreChange: () => void) => session.stateStore.subscribe(onStoreChange),
		[session],
	);

	const getSnapshot = useCallback(() => session.stateStore.getSnapshot(), [session]);

	const activeStates = useSyncExternalStore(
		subscribeStates,
		getSnapshot,
	);

	const { messages, headId } = useMessageTree(session.treeManager);
	const [messageGenerating, setMessageGenerating] = useState<ChatCompletionChunk[] | null>(null);
	const generatingRef = useRef(false);

	// Snapshot Rollback on Tree Head Navigation
	useEffect(() => {
		if (!headId) {
			return;
		}

		const node = session.treeManager.getNode(headId);
		if (node?.stateSnapshot) {
			session.stateStore.restoreSnapshot(node.stateSnapshot);
		}
	}, [headId, session]);

	// Streaming loop with tool execution
	const runStream = useCallback(async (additionalMessages: ChatCompletionMessageParam[] = []) => {

		if (generatingRef.current) {
			return;
		}

		generatingRef.current = true;
		setMessageGenerating([]);

		try {
			await runChatStream({
				session,
				additionalMessages,
				client: options?.client,
				onChunk: chunks => setMessageGenerating(chunks),
			});
		}
		finally {
			generatingRef.current = false;
			setMessageGenerating(null);
		}

	}, [session, options?.client]);

	const onChoiceSelect = useCallback(async (selectionText: string) => {

		if (generatingRef.current) {
			return;
		}

		session.treeManager.appendMessage("user", `<character id="APP">${selectionText}</character>`, {
			isRequest: true,
			finishReason: "app",
			stateSnapshot: session.stateStore.getAllStates(),
		});

		await runStream();

	}, [runStream, session]);

	const onSubmit = useCallback(async (e: SubmitEvent<HTMLFormElement>) => {

		e.preventDefault();

		if (generatingRef.current) {
			return;
		}

		const formData = new FormData(e.target);
		const sendMessage = formData.get("content")?.toString() ?? "";
		const sendType = (e.nativeEvent.submitter as any).value!;

		if (sendType !== "continue" && !sendMessage) {
			return;
		}

		const snapshot = session.stateStore.getAllStates();

		if (sendType === "attach") {
			session.treeManager.appendMessage("user", `<character id="USER">${sendMessage}</character>`, {
				isRequest: true,
				finishReason: "app",
				stateSnapshot: snapshot,
			});

			return;
		}

		if (sendType === "continue") {
			session.treeManager.appendMessage("user", `<character id="APP">continue the next turn</character>`, {
				isRequest: true,
				finishReason: "app",
				stateSnapshot: snapshot,
			});
		}
		else {
			session.treeManager.appendMessage("user", `<character id="USER">${sendMessage}</character>`, {
				isRequest: true,
				finishReason: "app",
				stateSnapshot: snapshot,
			});
		}

		await runStream();

	}, [runStream, session]);

	const onRegenerateMessage = useCallback(async (messageId: string) => {

		if (generatingRef.current) {
			return;
		}

		const node = session.treeManager.getNode(messageId);
		if (!node) {
			return;
		}

		const targetHeadId = node.message.data.role === "assistant" ? node.parentId : node.id;
		session.treeManager.setHead(targetHeadId);

		if (targetHeadId) {
			const targetNode = session.treeManager.getNode(targetHeadId);
			if (targetNode?.stateSnapshot) {
				session.stateStore.restoreSnapshot(targetNode.stateSnapshot);
			}
		}

		await runStream();

	}, [runStream, session]);

	const onEditMessage = useCallback(async (messageId: string, newContent: string) => {

		if (generatingRef.current) {
			return;
		}

		const node = session.treeManager.getNode(messageId);
		if (!node) {
			return;
		}

		session.treeManager.setHead(node.parentId);

		if (node.parentId) {
			const parentNode = session.treeManager.getNode(node.parentId);
			if (parentNode?.stateSnapshot) {
				session.stateStore.restoreSnapshot(parentNode.stateSnapshot);
			}
		}

		const snapshot = session.stateStore.getAllStates();
		const role = node.message.data.role;

		session.treeManager.appendMessage(role as any, newContent, {
			isRequest: role === "user" || role === "system",
			finishReason: "app",
			stateSnapshot: snapshot,
		});

		if (role === "user") {
			await runStream();
		}

	}, [runStream, session]);

	const onDeleteMessage = useCallback((messageId: string) => {

		const node = session.treeManager.getNode(messageId);
		if (!node) {
			return;
		}

		const isHead = session.treeManager.getHeadId() === messageId;
		const parentId = node.parentId;

		session.treeManager.deleteNode(messageId);

		if (isHead && parentId) {
			const parentNode = session.treeManager.getNode(parentId);
			if (parentNode?.stateSnapshot) {
				session.stateStore.restoreSnapshot(parentNode.stateSnapshot);
			}
		}

	}, [session]);

	const messageGeneratingMessage: Message | null = useMemo(() => {

		if (!messageGenerating || messageGenerating.length === 0) {
			return null;
		}

		return chunksToMessage(messageGenerating);

	}, [messageGenerating]);

	const generating = !!messageGenerating;

	return {
		session,
		characterStore: session.characterStore,
		messages,
		headId,
		activeStates,
		generating,
		isGenerating: generating,
		messageGenerating,
		messageGeneratingMessage,
		runStream,
		onChoiceSelect,
		onSubmit,
		onRegenerateMessage,
		onEditMessage,
		onDeleteMessage,
		onRetryMessage: onRegenerateMessage,
		onRegenerate: onRegenerateMessage,
		onEdit: onEditMessage,
		onDelete: onDeleteMessage,
		onRetry: onRegenerateMessage,
	};

}
