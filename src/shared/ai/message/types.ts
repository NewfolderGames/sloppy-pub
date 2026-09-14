import type { StateValue, WorldStates } from "../../world/types.ts";
import type { Message } from "./node.ts";

export interface StateCommand {
	key: string;
	value: StateValue;
	op?: "set" | "delete";
	character?: string;
	category?: "thought" | "emotion" | "goal" | "state";
	name?: string;
}

export interface EventCommand {
	type: "narrative" | "character" | "system";
	summary: string;
	details?: string;
}

export interface DirectorCommand {
	thought?: string;
	plan?: string;
	instructions?: string;
}

export interface ChapterCommand {
	title: string;
	summary: string;
}

export interface ParsedCommands {
	states: StateCommand[];
	events: EventCommand[];
	director?: DirectorCommand;
	chapters: ChapterCommand[];
}

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
	requiredFlags?: string[];
	requiredItems?: string[];
	locked?: boolean;
	lockReason?: string;
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
	commands?: ParsedCommands;
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
