import type { WorldStates } from "../../world/types.ts";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionToolMessageParam, ChatRole } from "../llm/common.ts";
import type { Message, MessageMetadata } from "./node.ts";
import { MessageTree } from "./tree.ts";
import type { MessageNode, SerializedMessageTree } from "./types.ts";

export type MessageTreeListener = (tree: MessageTree) => void;

export interface AppendMessageOptions {
	isRequest?: boolean;
	finishReason?: string;
	parentId?: string | null;
	stateSnapshot?: WorldStates;
	tool_call_id?: string;
	tool_calls?: ChatCompletionMessageToolCall[];
	metadata?: MessageMetadata;
}

export class MessageTreeManager {

	private static instance: MessageTreeManager | null = null;
	private tree: MessageTree;
	private listeners: Set<MessageTreeListener>;

	public constructor(tree?: MessageTree) {

		this.tree = tree ?? new MessageTree();
		this.listeners = new Set<MessageTreeListener>();

	}

	public static getInstance(): MessageTreeManager {

		if (!MessageTreeManager.instance) {
			MessageTreeManager.instance = new MessageTreeManager();
		}

		return MessageTreeManager.instance;

	}

	// Subscriptions

	public subscribe(listener: MessageTreeListener): () => void {

		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};

	}

	private notify(): void {

		for (const listener of this.listeners) {
			listener(this.tree);
		}

	}

	// Tree Operations

	public getTree(): MessageTree {

		return this.tree;

	}

	public getHead(): MessageNode | null {

		return this.tree.getHead();

	}

	public getHeadId(): string | null {

		return this.tree.getHeadId();

	}

	public setHead(nodeId: string | null): void {

		this.tree.setHead(nodeId);
		this.notify();

	}

	public getNode(nodeId: string): MessageNode | null {

		return this.tree.getNode(nodeId);

	}

	public getStateSnapshot(targetId?: string | null): WorldStates | undefined {

		const resolvedTargetId = targetId ?? this.tree.getHeadId();
		if (!resolvedTargetId) {
			return undefined;
		}

		const node = this.tree.getNode(resolvedTargetId);

		return node?.stateSnapshot;

	}

	public getPath(targetId?: string | null): MessageNode[] {

		return this.tree.getPath(targetId);

	}

	public getMessages(targetId?: string | null): Message[] {

		return this.tree.getPath(targetId).map(node => node.message);

	}

	public getChildren(nodeId: string): MessageNode[] {

		return this.tree.getChildren(nodeId);

	}

	public getParent(nodeId: string): MessageNode | null {

		return this.tree.getParent(nodeId);

	}

	public getSiblings(nodeId: string): MessageNode[] {

		return this.tree.getSiblings(nodeId);

	}

	public addMessage(
		message: Message,
		parentId?: string | null,
		stateSnapshot?: WorldStates,
	): MessageNode {

		const node = this.tree.addNode(message, parentId, stateSnapshot);
		this.notify();

		return node;

	}

	public appendMessage(
		role: ChatRole,
		content: string,
		options?: AppendMessageOptions,
	): MessageNode {

		let data: Message["data"];

		if (role === "tool") {
			data = {
				role: "tool",
				content,
				tool_call_id: options?.tool_call_id ?? "",
			};
		}
		else if (role === "assistant") {
			data = {
				role: "assistant",
				content,
				...(options?.tool_calls ? { tool_calls: options.tool_calls } : {}),
			};
		}
		else {
			data = {
				role: role as any,
				content,
			};
		}

		const message: Message = {
			id: crypto.randomUUID(),
			isRequest: options?.isRequest ?? false,
			finishReason: options?.finishReason ?? "app",
			...(options?.metadata ? { metadata: options.metadata } : {}),
			data,
		};

		return this.addMessage(message, options?.parentId, options?.stateSnapshot);

	}

	public updateMessageContent(nodeId: string, content: string): MessageNode {

		const node = this.tree.updateMessageContent(nodeId, content);
		this.notify();

		return node;

	}

	public updateMessageMetadata(
		nodeId: string,
		metadata: Partial<MessageMetadata>,
	): MessageNode {

		const node = this.tree.updateMessageMetadata(nodeId, metadata);
		this.notify();

		return node;

	}

	public deleteNode(nodeId: string): void {

		this.tree.deleteNode(nodeId);
		this.notify();

	}

	public clear(): void {

		this.tree.clear();
		this.notify();

	}

	// LLM Context Transformation

	public getLLMContext(
		targetId?: string | null,
		additionalMessages: ChatCompletionMessageParam[] = [],
	): ChatCompletionMessageParam[] {

		const path = this.tree.getPath(targetId);

		const params: ChatCompletionMessageParam[] = path.map((node) => {
			const data = node.message.data;

			if (data.role === "assistant") {
				const assistantParam: ChatCompletionAssistantMessageParam = {
					role: "assistant",
					content: data.content,
				};

				if (data.tool_calls && data.tool_calls.length > 0) {
					assistantParam.tool_calls = data.tool_calls;
				}

				if (data.refusal) {
					assistantParam.refusal = data.refusal;
				}

				return assistantParam;
			}

			if (data.role === "tool") {
				const toolParam: ChatCompletionToolMessageParam = {
					role: "tool",
					content: data.content,
					tool_call_id: data.tool_call_id,
				};

				return toolParam;
			}

			return {
				role: data.role as any,
				content: data.content,
			};
		});

		if (additionalMessages.length > 0) {
			params.push(...additionalMessages);
		}

		return params;

	}

	// Serialization

	public toJSON(): SerializedMessageTree {

		return this.tree.toJSON();

	}

	public static fromJSON(data: SerializedMessageTree): MessageTreeManager {

		const tree = MessageTree.fromJSON(data);

		return new MessageTreeManager(tree);

	}

}
