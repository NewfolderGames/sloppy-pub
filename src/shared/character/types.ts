import type { WorldStates } from "../world/types.ts";

export interface CharacterfileMetadata {
	name: string;
	version: string;
	title: string;
	description: string;
	authors?: string[];
	tags?: string[];
	from?: string;
}

export interface NamedTrait {
	name: string;
	description: string;
	feelingLucky?: boolean;
}

export interface ExampleDialog {
	name: string;
	dialog: string;
	feelingLucky?: boolean;
}

export interface CharacterBackground {
	name: string;
	content: string;
	feelingLucky?: boolean;
}

export type CharacterStates = WorldStates;

export interface Characterfile {
	metadata: CharacterfileMetadata;
	summary: string;
	summary_lucky?: boolean;
	physical_characteristics: NamedTrait[];
	linguistic_patterns: NamedTrait[];
	psychology_and_worldviews: NamedTrait[];
	lifestyle_and_preferences: NamedTrait[];
	desires: NamedTrait[];
	skills: NamedTrait[];
	backgrounds: CharacterBackground[];
	example_dialogs: ExampleDialog[];
	initial_states: CharacterStates;
}

export interface CharacterThought {
	id: string;
	title: string;
	internal_monologue: string;
}

export interface CharacterEmotion {
	id: string;
	name: string;
	internal_monologue: string;
}

export interface CharacterGoal {
	id: string;
	name: string;
	internal_monologue: string;
}

export interface CharacterInstance {
	id: string;
	characterId?: string;
	name: string;
	isNpc?: boolean;
	thoughts: CharacterThought[];
	emotions: CharacterEmotion[];
	goals: CharacterGoal[];
	states: CharacterStates;
}

export interface StoredCharacterfile {
	id: string;
	characterfile: Characterfile;
	createdAt: number;
	updatedAt: number;
}
