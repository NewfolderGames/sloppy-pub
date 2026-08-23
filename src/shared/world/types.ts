import type { CharacterInstance } from "../character/types.ts";
import type { DirectorState } from "../session/director.ts";

export interface WorldfileMetadata {
	name: string;
	version: string;
	title: string;
	description: string;
	authors?: string[];
	tags?: string[];
	from?: string;
}

export type ArgumentType = "text" | "number" | "boolean" | "select" | "radio" | "checkbox";

export interface ArgumentDefinition {
	name: string;
	type: ArgumentType;
	default?: string | number | boolean;
	description?: string;
	optional?: boolean;
	multiline?: boolean;
	format?: "int" | "float" | string;
	range?: string;
	values?: string[];
	multiple?: boolean;
}

export interface VariableDefinition {
	name: string;
	type: ArgumentType;
	default?: string | number | boolean;
	description?: string;
	optional?: boolean;
	multiline?: boolean;
	format?: "int" | "float" | string;
	range?: string;
	values?: string[];
	multiple?: boolean;
}

export interface ContentPlotIntroItem {
	value: string;
	hidden?: boolean;
	feelingLucky?: boolean;
}

export interface ContentPlotIntro {
	mode: "random" | "user_select" | "dynamic";
	list?: ContentPlotIntroItem[];
}

export interface ContentPlotIncidentItem {
	value: string;
	trigger: "dice_roll" | "periodic" | "manual";
	trigger_dice?: string;
	trigger_threshold?: number;
}

export interface ContentPlotIncident {
	list?: ContentPlotIncidentItem[];
}

export interface ContentSettings {
	rules?: string[];
	guidelines?: string[];
}

export interface WorldfileFeelingLucky {
	backgrounds?: number[];
	rules?: number[];
	guidelines?: number[];
	plot_intro?: number[];
	[key: string]: unknown;
}

export interface WorldfileContent {
	backgrounds: string[];
	description?: string;
	setting_description?: string;
	guidelines: string[];
	generation?: Record<string, unknown>;
	settings?: ContentSettings;
	plot?: {
		intro?: ContentPlotIntro;
		incident?: ContentPlotIncident;
	};
	feeling_lucky?: WorldfileFeelingLucky;
}

export type StatePrimitive = string | number | boolean;

export type StateValue = StatePrimitive | StatePrimitive[];

export type WorldStates = Record<string, StateValue>;

export interface Worldfile {
	metadata: WorldfileMetadata;
	args?: ArgumentDefinition[];
	vars?: VariableDefinition[];
	content: WorldfileContent;
	states?: WorldStates;
}

export interface Universefile {
	metadata: WorldfileMetadata;
	settings: {
		rules: string[];
		backgrounds?: string[];
		feeling_lucky?: {
			rules?: number[];
			backgrounds?: number[];
		};
	};
	states: WorldStates;
}

export interface SessionEvent {
	id: string;
	timestamp: number;
	type: "narrative" | "character" | "system";
	summary: string;
	details?: string;
}

export interface Chapter {
	id: string;
	title: string;
	summary: string;
	eventIds: string[];
	createdAt: number;
}

export interface WorldInstance {
	id: string;
	title: string;
	worldId: string;
	universeId?: string;
	universeMode: "isolated" | "synchronized";
	lorebookId?: string;
	lorebookIds?: string[];
	injectedVars: Record<string, string | number | boolean>;
	worldPrompt?: string;
	messageTreeData: unknown;
	activeStates: WorldStates;
	characterIds?: string[];
	characterInstances?: CharacterInstance[];
	events?: SessionEvent[];
	chapters?: Chapter[];
	director?: DirectorState;
	compacted?: boolean;
	isCompacted?: boolean;
	createdAt: number;
	updatedAt: number;
}

// LLM State Tool Contracts

export interface UpdateWorldStateArgs {
	key: string;
	value: StateValue;
	reason?: string;
}

export type StateOperationType = "set" | "delete";

export type StateOperation
	= | { type: "set"; key: string; value: StateValue }
		| { type: "delete"; key: string };

export interface MutateWorldStateArgs {
	operations: StateOperation[];
	reason?: string;
}

export interface PatchWorldStateArgs {
	updates: Record<string, StateValue>;
	reason?: string;
}

export interface ReadWorldStateArgs {
	keys?: string[];
	key?: string;
	pattern?: string;
}

export interface UpdateWorldStateSuccessResult {
	status: "success";
	key: string;
	previous_value: StateValue | null;
	new_value: StateValue;
}

export interface PatchWorldStateSuccessResult {
	status: "success";
	applied_count: number;
	updates: WorldStates;
}

export interface MutateWorldStateSuccessResult {
	status: "success";
	applied_count: number;
	operations: StateOperation[];
}

export interface ReadWorldStateSuccessResult {
	status: "success";
	states: WorldStates;
}

export interface ToolErrorResult {
	status: "error";
	message: string;
}

export type StateToolResult
	= | UpdateWorldStateSuccessResult
		| PatchWorldStateSuccessResult
		| MutateWorldStateSuccessResult
		| ReadWorldStateSuccessResult
		| ToolErrorResult;

export interface ToolExecutionResult {
	status: "success" | "error";
	message?: string;
	[key: string]: unknown;
}

// State Change Events

export interface StateChangeEvent {
	type: "state:updated";
	key: string;
	previousValue: StateValue | null;
	newValue: StateValue;
	reason?: string;
	source: "local" | "remote" | "rollback" | "initial";
	timestamp: number;
	sequence?: number;
}

export type StateChangeListener = (event: StateChangeEvent) => void;

// Universe Synchronization Types

export interface UniverseStateRecord {
	value: StateValue;
	version: number;
	timestamp: number;
	lastModifiedBy?: string;
}

export interface UniverseStateChangeEvent {
	universeId: string;
	key: string;
	value: StateValue;
	previousValue: StateValue | null;
	version: number;
	timestamp: number;
	modifiedBy: string;
	reason?: string;
}

// Legacy compatibility types

export interface World {
	id: string;
	title: string;
	description: string;
	systemPrompt: string;
	createdAt: number;
}

export type CreateWorldInput = Omit<World, "id" | "createdAt">;

export type AppTab
	= | "chat"
		| "world-create"
		| "world-manager"
		| "universe-manager"
		| "character-manager"
		| "lore"
		| "instances"
		| "settings";
