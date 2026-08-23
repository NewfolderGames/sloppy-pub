export type AssistantTab
	= | "world-manager"
		| "universe-manager"
		| "character-manager"
		| "lore"
		| "settings";

export type DiffStatus = "pending" | "applied" | "rejected";

export interface AssistantDiffPayload {
	toolCallId: string;
	tab: AssistantTab;
	title: string;
	originalText: string;
	proposedText: string;
	status: DiffStatus;
	targetPath?: string;
}

export interface AssistantContextData {
	tab: AssistantTab;
	activeId: string | null;
	rawToml?: string;
	summary?: Record<string, unknown>;
}

export interface AssistancePromptItem {
	id: string;
	name: string;
	content: string;
	enabled: boolean;
}

export interface AssistancePromptSettings {
	order: string[];
	prompts: Record<string, AssistancePromptItem>;
}

export interface DiffHunkLine {
	type: "add" | "delete" | "normal";
	content: string;
	oldLineNumber?: number;
	newLineNumber?: number;
}

export interface DiffHunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: DiffHunkLine[];
}

export interface StructuredDiff {
	hunks: DiffHunk[];
	additionsCount: number;
	deletionsCount: number;
	hasChanges: boolean;
}

export type LineEditOperationType = "replace" | "insert" | "delete";

export type LineEditPosition = "before" | "after";

export interface LineEditOperation {
	operation: LineEditOperationType;
	startLine: number;
	endLine?: number;
	content?: string;
	position?: LineEditPosition;
}
