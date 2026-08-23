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

export type MessageBlock = CharacterBlock | SystemBlock | AppBlock;

export interface CharacterTurnAction {
	type: "character";
	id: string;
	name: string;
}

export interface SystemTurnAction {
	type: "system";
}

export type TurnAction = CharacterTurnAction | SystemTurnAction;

export interface ParsedMessage {
	blocks: MessageBlock[];
	nextTurn?: TurnAction;
}
