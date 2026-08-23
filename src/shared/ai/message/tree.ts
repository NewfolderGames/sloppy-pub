import type { WorldStates } from "../../world/types.ts";
import type { Message, MessageMetadata } from "./node.ts";
import { createMessageNode } from "./node.ts";
import type { MessageNode, SerializedMessageTree, TreeNodeMap } from "./types.ts";

export class MessageTree {

	private nodes: Map<string, MessageNode>;
	private rootIds: string[];
	private headId: string | null;

	public constructor() {

		this.nodes = new Map<string, MessageNode>();
		this.rootIds = [];
		this.headId = null;

	}

	// State Accessors

	public getHeadId(): string | null {

		return this.headId;

	}

	public getHead(): MessageNode | null {

		if (!this.headId) {
			return null;
		}

		return this.nodes.get(this.headId) ?? null;

	}

	public setHead(nodeId: string | null): void {

		if (nodeId === null) {
			this.headId = null;
			return;
		}

		if (!this.nodes.has(nodeId)) {
			throw new Error(`Node not found: ${nodeId}`);
		}

		this.headId = nodeId;

	}

	public getNode(nodeId: string): MessageNode | null {

		return this.nodes.get(nodeId) ?? null;

	}

	public getRootIds(): string[] {

		return [...this.rootIds];

	}

	public getAllNodes(): MessageNode[] {

		return Array.from(this.nodes.values());

	}

	// Node Mutation

	public addNode(
		message: Message,
		parentId?: string | null,
		stateSnapshot?: WorldStates,
	): MessageNode {

		let resolvedParentId: string | null;

		if (parentId !== undefined) {
			resolvedParentId = parentId;
		}
		else {
			resolvedParentId = this.headId;
		}

		if (resolvedParentId !== null && !this.nodes.has(resolvedParentId)) {
			throw new Error(`Parent node not found: ${resolvedParentId}`);
		}

		const node = createMessageNode(message, resolvedParentId, stateSnapshot);

		this.nodes.set(node.id, node);

		if (resolvedParentId === null) {
			this.rootIds.push(node.id);
		}
		else {
			const parentNode = this.nodes.get(resolvedParentId)!;
			if (!parentNode.childrenIds.includes(node.id)) {
				parentNode.childrenIds.push(node.id);
			}
		}

		this.headId = node.id;

		return node;

	}

	public updateMessageContent(nodeId: string, content: string): MessageNode {

		const node = this.nodes.get(nodeId);
		if (!node) {
			throw new Error(`Node not found: ${nodeId}`);
		}

		const updatedMessage: Message = {
			...node.message,
			data: {
				...node.message.data,
				content,
			},
		};

		const updatedNode: MessageNode = {
			...node,
			message: updatedMessage,
		};

		this.nodes.set(nodeId, updatedNode);

		return updatedNode;

	}

	public updateMessageMetadata(
		nodeId: string,
		metadata: Partial<MessageMetadata>,
	): MessageNode {

		const node = this.nodes.get(nodeId);
		if (!node) {
			throw new Error(`Node not found: ${nodeId}`);
		}

		const updatedMessage: Message = {
			...node.message,
			metadata: {
				...(node.message.metadata ?? {}),
				...metadata,
			},
		};

		const updatedNode: MessageNode = {
			...node,
			message: updatedMessage,
		};

		this.nodes.set(nodeId, updatedNode);

		return updatedNode;

	}

	public deleteNode(nodeId: string): void {

		const node = this.nodes.get(nodeId);
		if (!node) {
			return;
		}

		// Recursively delete children

		const childrenIdsCopy = [...node.childrenIds];
		for (const childId of childrenIdsCopy) {
			this.deleteNode(childId);
		}

		// Disconnect from parent or roots

		if (node.parentId !== null) {
			const parent = this.nodes.get(node.parentId);
			if (parent) {
				parent.childrenIds = parent.childrenIds.filter(id => id !== nodeId);
			}
		}
		else {
			this.rootIds = this.rootIds.filter(id => id !== nodeId);
		}

		// Adjust head if head was deleted

		if (this.headId === nodeId) {
			this.headId = node.parentId;
		}

		this.nodes.delete(nodeId);

	}

	public removeNodeAndPromoteChildren(nodeId: string): boolean {

		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		const childrenIds = [...node.childrenIds];
		for (const childId of childrenIds) {
			const childNode = this.nodes.get(childId);
			if (!childNode) {
				continue;
			}

			childNode.parentId = null;
			if (!this.rootIds.includes(childId)) {
				this.rootIds.push(childId);
			}
		}

		node.childrenIds = [];
		this.deleteNode(nodeId);

		return true;

	}

	public clear(): void {

		this.nodes.clear();
		this.rootIds = [];
		this.headId = null;

	}

	// Traversal and Relationships

	public getPath(targetId?: string | null): MessageNode[] {

		const resolvedTargetId = targetId ?? this.headId;
		if (!resolvedTargetId) {
			return [];
		}

		const path: MessageNode[] = [];
		let currentId: string | null = resolvedTargetId;

		while (currentId !== null) {
			const node = this.nodes.get(currentId);
			if (!node) {
				break;
			}

			path.push(node);
			currentId = node.parentId;
		}

		return path.reverse();

	}

	public getChildren(nodeId: string): MessageNode[] {

		const node = this.nodes.get(nodeId);
		if (!node) {
			return [];
		}

		return node.childrenIds
			.map(id => this.nodes.get(id))
			.filter((child): child is MessageNode => child !== undefined);

	}

	public getParent(nodeId: string): MessageNode | null {

		const node = this.nodes.get(nodeId);
		if (!node || node.parentId === null) {
			return null;
		}

		return this.nodes.get(node.parentId) ?? null;

	}

	public getSiblings(nodeId: string): MessageNode[] {

		const node = this.nodes.get(nodeId);
		if (!node) {
			return [];
		}

		if (node.parentId === null) {
			return this.rootIds
				.map(id => this.nodes.get(id))
				.filter((root): root is MessageNode => root !== undefined);
		}

		return this.getChildren(node.parentId);

	}

	// Serialization

	public toJSON(): SerializedMessageTree {

		const nodes: TreeNodeMap = {};

		for (const [id, node] of this.nodes.entries()) {
			nodes[id] = {
				...node,
				childrenIds: [...node.childrenIds],
				message: {
					...node.message,
					...(node.message.metadata ? { metadata: { ...node.message.metadata } } : {}),
				},
				...(node.stateSnapshot ? { stateSnapshot: { ...node.stateSnapshot } } : {}),
			};
		}

		return {
			rootIds: [...this.rootIds],
			headId: this.headId,
			nodes,
		};

	}

	public static fromJSON(data: SerializedMessageTree): MessageTree {

		const tree = new MessageTree();

		tree.rootIds = [...data.rootIds];
		tree.headId = data.headId;

		for (const [id, node] of Object.entries(data.nodes)) {
			tree.nodes.set(id, {
				...node,
				childrenIds: [...node.childrenIds],
				message: {
					...node.message,
					...(node.message.metadata ? { metadata: { ...node.message.metadata } } : {}),
				},
				...(node.stateSnapshot ? { stateSnapshot: { ...node.stateSnapshot } } : {}),
			});
		}

		return tree;

	}

}
