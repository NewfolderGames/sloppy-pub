import type { Chapter, SessionEvent, WorldInstance } from "../world/types.ts";
import { saveInstance } from "../world/instance_manager.ts";
import type { MessageTreeManager } from "../ai/message/tree_manager.ts";

export interface CreateChapterOptions {
	title?: string;
	summary?: string;
	eventIds?: string[];
}

export async function createChapterCheckpoint(
	instance: WorldInstance,
	events?: SessionEvent[],
	treeManager?: MessageTreeManager,
	llmCall?: (prompt: string) => Promise<string>,
): Promise<Chapter> {

	const targetEvents = events ?? (instance.events || []);
	const eventIds = targetEvents.map(e => e.id);

	let contextMessages: { role: string; content: string }[] = [];
	if (treeManager) {
		try {
			const llmContext = treeManager.getLLMContext();
			contextMessages = llmContext.map(m => ({
				role: m.role,
				content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
			}));
		}
		catch {
			// Tree context extraction fallback
		}
	}

	let title = "";
	let summary = "";

	if (llmCall) {
		const promptLines = [
			"Summarize the following story events and recent conversation into a chapter checkpoint.",
			"Provide a chapter title and a detailed narrative summary.",
		];

		if (targetEvents.length > 0) {
			promptLines.push("\nEvents:");
			for (const evt of targetEvents) {
				const detail = evt.details ? `: ${evt.details}` : "";
				promptLines.push(`- [${evt.type}] ${evt.summary}${detail}`);
			}
		}

		if (contextMessages.length > 0) {
			promptLines.push("\nRecent Conversation:");
			for (const msg of contextMessages.slice(-10)) {
				promptLines.push(`${msg.role}: ${msg.content}`);
			}
		}

		promptLines.push("\nRespond with the following format:\nTitle: <chapter title>\nSummary: <chapter summary>");

		const response = await llmCall(promptLines.join("\n"));

		const titleMatch = response.match(/^Title:\s*(.+)$/im);
		const summaryMatch = response.match(/^Summary:\s*([\s\S]+)$/im);

		if (titleMatch) {
			title = titleMatch[1].trim();
		}
		if (summaryMatch) {
			summary = summaryMatch[1].trim();
		}
		else if (!titleMatch) {
			summary = response.trim();
		}
		else {
			summary = response.replace(/^Title:\s*.+$/im, "").trim();
		}
	}

	if (!title) {
		const chapterNumber = (instance.chapters?.length ?? 0) + 1;
		title = `Chapter ${chapterNumber}`;
	}

	if (!summary) {
		const summaryParts: string[] = [];

		if (targetEvents.length > 0) {
			const eventLines = targetEvents.map((e) => {
				const detail = e.details ? `: ${e.details}` : "";
				return `- [${e.type}] ${e.summary}${detail}`;
			});
			summaryParts.push("Events:\n" + eventLines.join("\n"));
		}

		if (contextMessages.length > 0) {
			const msgLines = contextMessages.slice(-5).map(m => `${m.role}: ${m.content}`);
			summaryParts.push("Recent Conversation:\n" + msgLines.join("\n"));
		}

		summary = summaryParts.join("\n\n") || "No events or conversation recorded.";
	}

	const chapter: Chapter = {
		id: `chap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		title,
		summary,
		eventIds,
		createdAt: Date.now(),
	};

	if (!instance.chapters) {
		instance.chapters = [];
	}

	instance.chapters.push(chapter);
	saveInstance(instance);

	return chapter;

}

export function compactSession(
	instance: WorldInstance,
	chapter: Chapter,
	treeManager?: MessageTreeManager,
): WorldInstance {

	if (!instance.chapters) {
		instance.chapters = [];
	}

	const existingIndex = instance.chapters.findIndex(c => c.id === chapter.id);
	if (existingIndex >= 0) {
		instance.chapters[existingIndex] = chapter;
	}
	else {
		instance.chapters.push(chapter);
	}

	if (treeManager) {
		treeManager.clear();
		instance.messageTreeData = treeManager.toJSON();
	}
	else {
		instance.messageTreeData = null;
	}

	instance.compacted = true;
	instance.isCompacted = true;

	saveInstance(instance);

	return instance;

}

export {
	CREATE_CHAPTER_TOOL,
	COMPACT_SESSION_TOOL,
	CHAPTER_TOOL_DEFINITIONS,
	CHAPTER_TOOL_NAMES,
	executeChapterTool,
} from "../world/tools/chapter_tools.ts";
export type {
	CreateChapterArgs,
	CompactSessionArgs,
	ChapterToolResult,
} from "../world/tools/chapter_tools.ts";
