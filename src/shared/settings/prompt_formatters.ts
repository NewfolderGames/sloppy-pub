import type { Chapter, SessionEvent, WorldStates } from "../world/types.ts";

// Session States Prompt Formatting

export function formatSessionStatesPrompt(states?: WorldStates | null): string | null {

	if (!states) {
		return null;
	}

	const entries = Object.entries(states);

	if (entries.length === 0) {
		return null;
	}

	const lines: string[] = ["Current Session State:"];

	for (const [key, value] of entries) {
		const formattedValue = Array.isArray(value)
			? `[${value.join(", ")}]`
			: String(value);

		lines.push(`- ${key}: ${formattedValue}`);
	}

	return lines.join("\n");

}

// Semantic Directives Prompt Formatting

export function formatSemanticDirectivesPrompt(directives?: string[] | null): string | null {

	if (!directives || directives.length === 0) {
		return null;
	}

	const lines: string[] = ["Active Behavioral Directives and Constraints:"];

	for (const directive of directives) {
		if (directive.trim() !== "") {
			lines.push(`- ${directive.trim()}`);
		}
	}

	if (lines.length <= 1) {
		return null;
	}

	return lines.join("\n");

}

// Session Events Prompt Formatting

export function formatSessionEventsPrompt(events?: SessionEvent[] | null): string | null {

	if (!events || events.length === 0) {
		return null;
	}

	const lines: string[] = ["Session Events:"];

	for (const event of events) {
		const typePrefix = event.type ? `[${event.type}] ` : "";
		const detail = event.details ? ` - ${event.details}` : "";
		lines.push(`- ${typePrefix}${event.summary}${detail}`);
	}

	return lines.join("\n");

}

// Chapters Summary Prompt Formatting

export function formatChaptersSummaryPrompt(chapters?: Chapter[] | null): string | null {

	if (!chapters || chapters.length === 0) {
		return null;
	}

	const lines: string[] = ["Previous Chapters Summary:"];

	for (const chapter of chapters) {
		lines.push(`### ${chapter.title}`);
		lines.push(chapter.summary);
	}

	return lines.join("\n\n");

}
