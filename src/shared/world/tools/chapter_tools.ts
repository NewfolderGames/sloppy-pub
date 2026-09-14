import type { Chapter, WorldInstance } from "../types.ts";
import { saveInstance } from "../instance_manager.ts";

export interface CreateChapterArgs {
	title: string;
	summary: string;
	eventIds?: string[];
}

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
