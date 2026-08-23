import type { Chapter, WorldInstance } from "../types.ts";
import { saveInstance } from "../instance_manager.ts";
import type { MessageTreeManager } from "../../ai/message/tree_manager.ts";
import { compactSession } from "../../session/chapter_manager.ts";

export interface CreateChapterArgs {
	title: string;
	summary: string;
	eventIds?: string[];
}

export interface CompactSessionArgs {
	title: string;
	summary: string;
	eventIds?: string[];
}

export interface ChapterToolResult {
	status: "success" | "error";
	message?: string;
	chapter?: Chapter;
	chapters?: Chapter[];
	compacted?: boolean;
}

export const CREATE_CHAPTER_TOOL = {
	type: "function",
	function: {
		name: "create_chapter",
		description: "Creates a story chapter checkpoint summarizing events and story progress so far.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "The title of the chapter.",
				},
				summary: {
					type: "string",
					description: "Detailed summary of the chapter's storyline and events.",
				},
				eventIds: {
					type: "array",
					items: { type: "string" },
					description: "Optional IDs of events covered in this chapter.",
				},
			},
			required: ["title", "summary"],
		},
	},
} as const;

export const COMPACT_SESSION_TOOL = {
	type: "function",
	function: {
		name: "compact_session",
		description:
			"Compacts the session by creating a chapter checkpoint, saving the summary, and clearing conversation history to save context.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Title of the compaction chapter.",
				},
				summary: {
					type: "string",
					description: "Summary of the storyline to preserve in the chapter checkpoint.",
				},
				eventIds: {
					type: "array",
					items: { type: "string" },
					description: "Optional IDs of events covered in this chapter.",
				},
			},
			required: ["title", "summary"],
		},
	},
} as const;

export const CHAPTER_TOOL_DEFINITIONS = [
	CREATE_CHAPTER_TOOL,
	COMPACT_SESSION_TOOL,
] as const;

export const CHAPTER_TOOL_NAMES = new Set([
	"create_chapter",
	"compact_session",
]);

// Helper Functions

export function addChapter(
	instance: WorldInstance,
	input: CreateChapterArgs,
): Chapter {

	if (!instance.chapters) {
		instance.chapters = [];
	}

	const chapter: Chapter = {
		id: `chap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		title: input.title.trim(),
		summary: input.summary.trim(),
		eventIds: Array.isArray(input.eventIds) ? [...input.eventIds] : [],
		createdAt: Date.now(),
	};

	instance.chapters.push(chapter);
	saveInstance(instance);

	return chapter;

}

// Tool Execution

export function executeChapterTool(
	toolName: string,
	args: unknown,
	instance: WorldInstance,
	treeManager?: MessageTreeManager,
): ChapterToolResult {

	if (typeof args !== "object" || args === null) {
		return {
			status: "error",
			message: "Invalid arguments: expected an object.",
		};
	}

	const parsedArgs = args as Record<string, unknown>;

	if (toolName === "create_chapter") {
		const title = parsedArgs.title;
		if (typeof title !== "string" || title.trim().length === 0) {
			return {
				status: "error",
				message: "Chapter title is required and cannot be empty.",
			};
		}

		const summary = parsedArgs.summary;
		if (typeof summary !== "string" || summary.trim().length === 0) {
			return {
				status: "error",
				message: "Chapter summary is required and cannot be empty.",
			};
		}

		const eventIds = Array.isArray(parsedArgs.eventIds)
			? parsedArgs.eventIds.filter((id): id is string => typeof id === "string")
			: undefined;

		const chapter = addChapter(instance, {
			title,
			summary,
			eventIds,
		});

		return {
			status: "success",
			chapter,
			message: `Chapter checkpoint created: ${chapter.title}`,
		};
	}

	if (toolName === "compact_session") {
		const title = parsedArgs.title;
		if (typeof title !== "string" || title.trim().length === 0) {
			return {
				status: "error",
				message: "Chapter title is required for session compaction.",
			};
		}

		const summary = parsedArgs.summary;
		if (typeof summary !== "string" || summary.trim().length === 0) {
			return {
				status: "error",
				message: "Chapter summary is required for session compaction.",
			};
		}

		const eventIds = Array.isArray(parsedArgs.eventIds)
			? parsedArgs.eventIds.filter((id): id is string => typeof id === "string")
			: [];

		const chapter: Chapter = {
			id: `chap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			title: title.trim(),
			summary: summary.trim(),
			eventIds,
			createdAt: Date.now(),
		};

		compactSession(instance, chapter, treeManager);

		return {
			status: "success",
			chapter,
			compacted: true,
			message: `Session compacted with chapter: ${chapter.title}`,
		};
	}

	return {
		status: "error",
		message: `Unknown chapter tool: "${toolName}".`,
	};

}
