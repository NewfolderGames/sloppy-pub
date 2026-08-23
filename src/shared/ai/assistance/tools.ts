import type { AssistantDiffPayload, AssistantTab, LineEditOperation, StructuredDiff } from "./types.ts";
import { applyLineEdits, computeStructuredDiff, isContentIdentical } from "./diff.ts";

export {
	ALL_ASSISTANT_TOOLS,
	getAssistantToolsForTab,
	PROPOSE_CHARACTER_MODIFICATION_TOOL,
	PROPOSE_LORE_MODIFICATION_TOOL,
	PROPOSE_PROMPT_MODIFICATION_TOOL,
	PROPOSE_UNIVERSE_MODIFICATION_TOOL,
	PROPOSE_WORLD_MODIFICATION_TOOL,
} from "./schemas.ts";

// Staged Modification Store

export interface StagedModificationStore {
	getStaged(toolCallId: string): AssistantDiffPayload | undefined;
	getAllStaged(): AssistantDiffPayload[];
	stage(payload: AssistantDiffPayload): void;
	apply(toolCallId: string): AssistantDiffPayload | undefined;
	reject(toolCallId: string): AssistantDiffPayload | undefined;
	clear(): void;
	subscribe(listener: () => void): () => void;
}

export function createStagedModificationStore(): StagedModificationStore {

	const stagedMap = new Map<string, AssistantDiffPayload>();
	const listeners = new Set<() => void>();

	function notify(): void {
		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getStaged(toolCallId: string): AssistantDiffPayload | undefined {
			return stagedMap.get(toolCallId);
		},

		getAllStaged(): AssistantDiffPayload[] {
			return Array.from(stagedMap.values());
		},

		stage(payload: AssistantDiffPayload): void {
			stagedMap.set(payload.toolCallId, { ...payload });
			notify();
		},

		apply(toolCallId: string): AssistantDiffPayload | undefined {
			const item = stagedMap.get(toolCallId);
			if (!item) {
				return undefined;
			}

			const updated: AssistantDiffPayload = {
				...item,
				status: "applied",
			};

			stagedMap.set(toolCallId, updated);
			notify();
			return updated;
		},

		reject(toolCallId: string): AssistantDiffPayload | undefined {
			const item = stagedMap.get(toolCallId);
			if (!item) {
				return undefined;
			}

			const updated: AssistantDiffPayload = {
				...item,
				status: "rejected",
			};

			stagedMap.set(toolCallId, updated);
			notify();
			return updated;
		},

		clear(): void {
			stagedMap.clear();
			notify();
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};

}

let globalStagedModificationStore: StagedModificationStore | null = null;

export function getGlobalStagedModificationStore(): StagedModificationStore {

	globalStagedModificationStore ??= createStagedModificationStore();
	return globalStagedModificationStore;

}

// Tool Dispatcher

export interface AssistantToolContext {
	tab: AssistantTab;
	originalText: string;
	activeId: string | null;
	store?: StagedModificationStore;
}

export interface AssistantToolResult {
	status: "staged" | "no_change" | "error";
	toolCallId?: string;
	title?: string;
	message: string;
	diff?: StructuredDiff;
	payload?: AssistantDiffPayload;
}

function resolveProposedText(
	originalText: string,
	parsedArgs: Record<string, unknown>,
	fullContentKey: "proposedToml" | "proposedContent",
): { proposedText?: string; error?: string } {

	// 1. Partial edits array
	if (Array.isArray(parsedArgs.edits) && parsedArgs.edits.length > 0) {
		try {
			const edits = parsedArgs.edits as LineEditOperation[];
			const proposed = applyLineEdits(originalText, edits);

			return { proposedText: proposed };
		}
		catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);

			return { error: `Failed to apply line edits: ${message}` };
		}
	}

	// 2. Single edit operation
	if (typeof parsedArgs.operation === "string") {
		const rawStart = Number(parsedArgs.startLine);

		if (Number.isNaN(rawStart) || rawStart < 1) {
			return { error: "Missing or invalid 'startLine' for partial edit: Must be a positive integer >= 1." };
		}

		const singleEdit: LineEditOperation = {
			operation: parsedArgs.operation as LineEditOperation["operation"],
			startLine: rawStart,
			endLine: typeof parsedArgs.endLine === "number" ? parsedArgs.endLine : undefined,
			content: typeof parsedArgs.content === "string" ? parsedArgs.content : undefined,
			position: typeof parsedArgs.position === "string" ? (parsedArgs.position as LineEditOperation["position"]) : undefined,
		};

		try {
			const proposed = applyLineEdits(originalText, [singleEdit]);

			return { proposedText: proposed };
		}
		catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);

			return { error: `Failed to apply line edit: ${message}` };
		}
	}

	// 3. Fallback to full content string if provided
	const fallbackContent = parsedArgs[fullContentKey];

	if (typeof fallbackContent === "string" && fallbackContent.length > 0) {
		return { proposedText: fallbackContent };
	}

	return {
		error: `Missing modifications. Provide partial line edits ('edits' array or 'operation'/'startLine'/'content') or '${fullContentKey}'.`,
	};

}

export function executeAssistantTool(
	toolCallId: string,
	toolName: string,
	args: unknown,
	context: AssistantToolContext,
): AssistantToolResult {

	if (!args || typeof args !== "object") {
		return {
			status: "error",
			toolCallId,
			message: "Invalid tool arguments: Expected an object.",
		};
	}

	const store = context.store ?? getGlobalStagedModificationStore();
	const parsedArgs = args as Record<string, unknown>;

	if (
		toolName === "propose_world_modification"
		|| toolName === "propose_universe_modification"
		|| toolName === "propose_character_modification"
		|| toolName === "propose_lore_modification"
	) {
		const title = typeof parsedArgs.title === "string" ? parsedArgs.title.trim() : "";

		if (!title) {
			return {
				status: "error",
				toolCallId,
				message: "Missing required argument: 'title'.",
			};
		}

		const resolved = resolveProposedText(context.originalText, parsedArgs, "proposedToml");

		if (resolved.error || resolved.proposedText === undefined) {
			return {
				status: "error",
				toolCallId,
				message: resolved.error || "Failed to resolve proposed content.",
			};
		}

		const proposedToml = resolved.proposedText;

		if (isContentIdentical(context.originalText, proposedToml)) {
			return {
				status: "no_change",
				toolCallId,
				title,
				message: "Proposed content is identical to the current editor content. Zero changes detected.",
			};
		}

		const diff = computeStructuredDiff(context.originalText, proposedToml);

		const payload: AssistantDiffPayload = {
			toolCallId,
			tab: context.tab,
			title,
			originalText: context.originalText,
			proposedText: proposedToml,
			status: "pending",
		};

		store.stage(payload);

		return {
			status: "staged",
			toolCallId,
			title,
			message: `Proposed changes for "${title}" staged. ${diff.additionsCount} line(s) added, ${diff.deletionsCount} line(s) deleted. Awaiting user approval.`,
			diff,
			payload,
		};
	}

	if (toolName === "propose_prompt_modification") {
		const title = typeof parsedArgs.title === "string" ? parsedArgs.title.trim() : "";
		const targetPromptId = typeof parsedArgs.targetPromptId === "string" ? parsedArgs.targetPromptId : undefined;

		if (!title) {
			return {
				status: "error",
				toolCallId,
				message: "Missing required argument: 'title'.",
			};
		}

		const resolved = resolveProposedText(context.originalText, parsedArgs, "proposedContent");

		if (resolved.error || resolved.proposedText === undefined) {
			return {
				status: "error",
				toolCallId,
				message: resolved.error || "Failed to resolve proposed prompt content.",
			};
		}

		const proposedContent = resolved.proposedText;

		if (isContentIdentical(context.originalText, proposedContent)) {
			return {
				status: "no_change",
				toolCallId,
				title,
				message: "Proposed prompt content is identical to current content. Zero changes detected.",
			};
		}

		const diff = computeStructuredDiff(context.originalText, proposedContent);

		const payload: AssistantDiffPayload = {
			toolCallId,
			tab: "settings",
			title,
			originalText: context.originalText,
			proposedText: proposedContent,
			status: "pending",
			targetPath: targetPromptId,
		};

		store.stage(payload);

		return {
			status: "staged",
			toolCallId,
			title,
			message: `Proposed prompt modification for "${title}" staged. ${diff.additionsCount} line(s) added, ${diff.deletionsCount} line(s) deleted. Awaiting user approval.`,
			diff,
			payload,
		};
	}

	return {
		status: "error",
		toolCallId,
		message: `Unknown assistant tool: ${toolName}`,
	};

}
