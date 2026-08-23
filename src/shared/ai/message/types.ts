import type { WorldStates } from "../../world/types.ts";
import type { Message } from "./node.ts";

export interface CharacterBlock {
	type: "character";
	hidden: boolean;
	id: string;
	name: string;
	content: string;
}

export interface SystemBlock {
	type: "system";
	hidden: boolean;
	content: string;
}

export interface AppBlock {
	type: "app";
	hidden: boolean;
	content: string;
}

export interface ChoiceOption {
	id: string;
	text: string;
}

export interface ChoiceBlock {
	type: "choice";
	hidden: boolean;
	multiple: boolean;
	options: ChoiceOption[];
	allowCustomInput: boolean;
	content: string;
}

export type MessageBlock = CharacterBlock | SystemBlock | AppBlock | ChoiceBlock;

export interface CharacterTurnAction {
	type: "character";
	id: string;
	name?: string;
}

export interface SystemTurnAction {
	type: "system";
}

export interface UserTurnAction {
	type: "user";
}

export type TurnAction = CharacterTurnAction | SystemTurnAction | UserTurnAction;

export interface ParsedMessage {
	blocks: MessageBlock[];
	nextTurn?: TurnAction;
}

export interface MessageNode {
	id: string;
	parentId: string | null;
	childrenIds: string[];
	message: Message;
	stateSnapshot?: WorldStates;
	createdAt: number;
}

export type TreeNodeMap = Record<string, MessageNode>;

export interface TreeState {
	rootIds: string[];
	headId: string | null;
	nodes: TreeNodeMap;
}

export interface SerializedMessageTree {
	rootIds: string[];
	headId: string | null;
	nodes: TreeNodeMap;
}
