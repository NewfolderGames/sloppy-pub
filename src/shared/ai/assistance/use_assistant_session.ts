import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpenAIClient } from "../llm/client.ts";
import type { ChatCompletionRequest } from "../llm/request.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import { chunksToMessage, type Message, type MessageDataAssistant } from "../message/node.ts";
import { MessageTree } from "../message/tree.ts";
import { MessageTreeManager } from "../message/tree_manager.ts";
import { useMessageTree } from "../message/use_message_tree.ts";
import { assembleAssistantPromptMessages } from "./prompts.ts";
import { executeAssistantTool, getAssistantToolsForTab, getGlobalStagedModificationStore, type StagedModificationStore } from "./tools.ts";
import type { AssistantContextData, AssistantDiffPayload, AssistantTab } from "./types.ts";

const tabManagers = new Map<AssistantTab, MessageTreeManager>();

export function getAssistantTreeManager(tab: AssistantTab): MessageTreeManager {

	let manager = tabManagers.get(tab);
	if (!manager) {
		manager = new MessageTreeManager(new MessageTree());
		tabManagers.set(tab, manager);
	}

	return manager;

}

export function resetAssistantSessions(): void {

	tabManagers.clear();

}

export interface UseAssistantSessionOptions {
	tab: AssistantTab;
	activeId: string | null;
	rawToml?: string;
	summary?: Record<string, unknown>;
	onApplyDiff?: (payload: AssistantDiffPayload) => void;
	stagedStore?: StagedModificationStore;
	client?: OpenAIClient;
}

export interface RunAssistantStreamOptions {
	tab: AssistantTab;
	manager: MessageTreeManager;
	contextData: AssistantContextData;
	store: StagedModificationStore;
	client?: OpenAIClient;
	endpoint?: string;
	apiKey?: string;
	onChunk?: (chunks: ChatCompletionChunk[]) => void;
}

export async function runAssistantStream(options: RunAssistantStreamOptions): Promise<void> {

	const {
		tab,
		manager,
		contextData,
		store,
		onChunk,
	} = options;

	const client = options.client ?? OpenAIClient.getInstance();
	const endpoint = options.endpoint
		|| ((import.meta?.env?.VITE_API_BASE_URL) || "http://localhost:8080");
	const apiKey = options.apiKey
		|| ((import.meta?.env?.VITE_API_KEY) || "");

	let continueLoop = true;
	let loopCount = 0;
	const MAX_LOOPS = 5;

	let currentRawToml = contextData.rawToml ?? "";
	let currentContextData: AssistantContextData = { ...contextData };

	try {
		while (continueLoop && loopCount < MAX_LOOPS) {
			loopCount++;

			const branchHistory = manager.getLLMContext();
			const fullPromptMessages = assembleAssistantPromptMessages(currentContextData, branchHistory);

			const tabTools = getAssistantToolsForTab(tab);
			const requestPayload: ChatCompletionRequest = {
				model: "any",
				messages: fullPromptMessages,
				stream: true,
				stream_options: { include_usage: true },
				...(tabTools.length > 0 ? { tools: tabTools, tool_choice: "auto" } : {}),
			};

			const stream = client.streamChatCompletion(endpoint, apiKey, requestPayload);
			const chunks: ChatCompletionChunk[] = [];

			for await (const chunk of stream) {
				chunks.push(chunk);
				onChunk?.([...chunks]);
			}

			if (chunks.length === 0) {
				continueLoop = false;
				break;
			}

			const assistantMessage = chunksToMessage(chunks);
			onChunk?.([]);

			const assistantToolCalls = (assistantMessage.data as MessageDataAssistant).tool_calls;
			const hasToolCalls = Array.isArray(assistantToolCalls) && assistantToolCalls.length > 0;

			manager.addMessage(assistantMessage);

			if (!hasToolCalls || !assistantToolCalls) {
				continueLoop = false;
				break;
			}

			let hasStagedProposal = false;

			// Execute tool calls
			for (const toolCall of assistantToolCalls) {
				let parsedArgs: Record<string, unknown> = {};

				try {
					parsedArgs = JSON.parse(toolCall.function.arguments);
				}
				catch {
					parsedArgs = {};
				}

				const toolResult = executeAssistantTool(
					toolCall.id,
					toolCall.function.name,
					parsedArgs,
					{
						tab,
						originalText: currentRawToml,
						activeId: currentContextData.activeId,
						store,
					},
				);

				if (toolResult.status === "staged") {
					hasStagedProposal = true;
				}

				if (toolResult.payload?.proposedText) {
					currentRawToml = toolResult.payload.proposedText;
					currentContextData = {
						...currentContextData,
						rawToml: currentRawToml,
					};
				}

				manager.appendMessage("tool", JSON.stringify(toolResult), {
					tool_call_id: toolCall.id,
				});
			}

			// When a change proposal is staged, stop the loop to await user interaction.
			if (hasStagedProposal) {
				continueLoop = false;
				break;
			}
		}
	}
	catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		manager.appendMessage("assistant", `Error: ${errorMessage}`, {
			finishReason: "error",
			metadata: {
				error: errorMessage,
				durationMs: 0,
				tokens: 0,
			},
		});
	}

}

export function useAssistantSession(options: UseAssistantSessionOptions) {

	const { tab, activeId, rawToml, summary } = options;

	const store = useMemo(() => options.stagedStore ?? getGlobalStagedModificationStore(), [options.stagedStore]);
	const [stagedList, setStagedList] = useState<AssistantDiffPayload[]>(() => store.getAllStaged());
	const [prevStore, setPrevStore] = useState(store);

	if (prevStore !== store) {
		setPrevStore(store);
		setStagedList(store.getAllStaged());
	}

	useEffect(() => {

		const updateStaged = () => {
			setStagedList(store.getAllStaged());
		};

		updateStaged();

		const unsubscribe = store.subscribe(updateStaged);

		return () => {
			unsubscribe();
		};

	}, [store]);

	const treeManager = useMemo(() => getAssistantTreeManager(tab), [tab]);
	const { messages, headId, path } = useMessageTree(treeManager);

	const stagedMap = useMemo(() => {
		const map = new Map<string, AssistantDiffPayload>();
		for (const item of stagedList) {
			map.set(item.toolCallId, item);
		}
		return map;
	}, [stagedList]);

	const [generating, setGenerating] = useState<boolean>(false);
	const [activeStreamTab, setActiveStreamTab] = useState<AssistantTab | null>(null);
	const [messageGenerating, setMessageGenerating] = useState<ChatCompletionChunk[] | null>(null);

	// Keep options in ref for async callbacks
	const optionsRef = useRef(options);
	useEffect(() => {
		optionsRef.current = options;
	}, [options]);

	const runLLMStream = useCallback(async (
		currentTab: AssistantTab,
		manager: MessageTreeManager,
		contextData: AssistantContextData,
	) => {

		setGenerating(true);
		setActiveStreamTab(currentTab);
		setMessageGenerating(null);

		const client = optionsRef.current.client ?? OpenAIClient.getInstance();
		const endpoint = (import.meta?.env?.VITE_API_BASE_URL) || "http://localhost:8080";
		const apiKey = (import.meta?.env?.VITE_API_KEY) || "";

		try {
			await runAssistantStream({
				tab: currentTab,
				manager,
				contextData,
				store,
				client,
				endpoint,
				apiKey,
				onChunk: chunks => setMessageGenerating(chunks),
			});
		}
		finally {
			setMessageGenerating(null);
			setGenerating(false);
			setActiveStreamTab(null);
		}

	}, [store]);

	const onSubmit = useCallback(async (content: string) => {

		const trimmed = content.trim();
		if (!trimmed || generating) {
			return;
		}

		treeManager.appendMessage("user", trimmed);

		const currentContext: AssistantContextData = {
			tab,
			activeId,
			rawToml,
			summary,
		};

		await runLLMStream(tab, treeManager, currentContext);

	}, [generating, treeManager, tab, activeId, rawToml, summary, runLLMStream]);

	const onChoiceSelect = useCallback(async (value: string) => {

		await onSubmit(value);

	}, [onSubmit]);

	const onApplyStagedDiff = useCallback(async (toolCallId: string) => {

		if (generating) {
			return;
		}

		const updated = store.apply(toolCallId);

		if (updated) {
			optionsRef.current.onApplyDiff?.(updated);
		}

		const branch = treeManager.getPath();
		const toolNode = branch.find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === toolCallId,
		);

		if (toolNode) {
			let prevResult: Record<string, unknown>;

			try {
				prevResult = JSON.parse(toolNode.message.data.content || "{}");
			}
			catch {
				prevResult = {};
			}

			treeManager.updateMessageContent(
				toolNode.id,
				JSON.stringify({
					...prevResult,
					status: "applied",
					message: `Proposed changes for "${updated?.title ?? toolCallId}" were approved and applied to the editor by the user.`,
				}),
			);
		}

		const currentContext: AssistantContextData = {
			tab: optionsRef.current.tab,
			activeId: optionsRef.current.activeId,
			rawToml: updated?.proposedText ?? optionsRef.current.rawToml,
			summary: optionsRef.current.summary,
		};

		await runLLMStream(optionsRef.current.tab, treeManager, currentContext);

	}, [generating, store, treeManager, runLLMStream]);

	const onRejectStagedDiff = useCallback(async (toolCallId: string) => {

		if (generating) {
			return;
		}

		const updated = store.reject(toolCallId);

		const branch = treeManager.getPath();
		const toolNode = branch.find(
			node => node.message.data.role === "tool" && node.message.data.tool_call_id === toolCallId,
		);

		if (toolNode) {
			let prevResult: Record<string, unknown>;

			try {
				prevResult = JSON.parse(toolNode.message.data.content || "{}");
			}
			catch {
				prevResult = {};
			}

			treeManager.updateMessageContent(
				toolNode.id,
				JSON.stringify({
					...prevResult,
					status: "rejected",
					message: `Proposed changes for "${updated?.title ?? toolCallId}" were rejected by the user.`,
				}),
			);
		}

		const currentContext: AssistantContextData = {
			tab: optionsRef.current.tab,
			activeId: optionsRef.current.activeId,
			rawToml: optionsRef.current.rawToml,
			summary: optionsRef.current.summary,
		};

		await runLLMStream(optionsRef.current.tab, treeManager, currentContext);

	}, [generating, store, treeManager, runLLMStream]);

	const onRegenerateMessage = useCallback(async (nodeId: string) => {

		if (generating) {
			return;
		}

		const parent = treeManager.getParent(nodeId);
		if (!parent) {
			return;
		}

		treeManager.setHead(parent.id);

		const currentContext: AssistantContextData = {
			tab,
			activeId,
			rawToml,
			summary,
		};

		await runLLMStream(tab, treeManager, currentContext);

	}, [generating, treeManager, tab, activeId, rawToml, summary, runLLMStream]);

	const onClearHistory = useCallback(() => {

		if (generating) {
			return;
		}

		treeManager.clear();

	}, [generating, treeManager]);

	const messageGeneratingMessage = useMemo<Message | null>(() => {

		if (!messageGenerating || activeStreamTab !== tab) {
			return null;
		}

		try {
			return chunksToMessage(messageGenerating);
		}
		catch {
			return null;
		}

	}, [messageGenerating, activeStreamTab, tab]);

	return {
		tab,
		nodes: path,
		messages,
		headId,
		treeManager,
		generating: generating && activeStreamTab === tab,
		messageGenerating: activeStreamTab === tab ? messageGenerating : null,
		messageGeneratingMessage,
		stagedMap,
		onSubmit,
		onChoiceSelect,
		onApplyDiff: onApplyStagedDiff,
		onRejectDiff: onRejectStagedDiff,
		onRegenerateMessage,
		onClearHistory,
	};

}
