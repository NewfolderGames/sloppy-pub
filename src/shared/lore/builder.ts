import type { LoreBook, LoreEntry } from "./types.ts";
import { getActiveLoreEntries } from "./registry.ts";

function isLoreBookArray(input: unknown): input is LoreBook[] {
	return Array.isArray(input) && input.length > 0 && typeof input[0] === "object" && input[0] !== null && "entries" in input[0];
}

function getEntriesFromBooks(books: LoreBook[], currentMessage?: string): LoreEntry[] {
	const entries: LoreEntry[] = [];
	const messageLower = currentMessage?.toLowerCase() ?? "";

	for (const book of books) {
		for (const entry of book.entries) {
			if (entry.enabled === false) {
				continue;
			}

			if (entry.activationMode === "static") {
				entries.push(entry);
				continue;
			}

			if (currentMessage && entry.keywords.length > 0) {
				const matches = entry.keywords.some((kw) =>
					messageLower.includes(kw.trim().toLowerCase()),
				);
				if (matches) {
					entries.push(entry);
				}
			}
		}
	}

	return entries;
}

/**
 * Assembles a formatted lore prompt section from active lore entries.
 * Static entries are always included.
 * Dynamic entries are included only when at least one keyword matches currentMessage.
 */
export function synthesizeLorePrompt(
	lorebookId: string | string[] | LoreBook[],
	currentMessage?: string,
): string {
	const activeEntries = isLoreBookArray(lorebookId)
		? getEntriesFromBooks(lorebookId, currentMessage)
		: getActiveLoreEntries(lorebookId, currentMessage);

	if (activeEntries.length === 0) {
		return "";
	}

	const sorted = [...activeEntries].sort((a, b) => {
		const pa = a.priority ?? 0;
		const pb = b.priority ?? 0;

		return pb - pa;
	});

	const lines: string[] = ["# Lore Entries"];

	for (const entry of sorted) {
		lines.push(`## ${entry.title}`);
		lines.push(entry.content);
	}

	return lines.join("\n\n");
}

/**
 * Returns matching lore entries for a given message, sorted by priority.
 * Useful when a caller needs the raw entry list instead of formatted text.
 */
export function getMatchingLoreEntries(
	lorebookId: string | string[] | LoreBook[],
	currentMessage?: string,
): LoreEntry[] {
	const active = isLoreBookArray(lorebookId)
		? getEntriesFromBooks(lorebookId, currentMessage)
		: getActiveLoreEntries(lorebookId, currentMessage);

	return [...active].sort((a, b) => {
		const pa = a.priority ?? 0;
		const pb = b.priority ?? 0;

		return pb - pa;
	});
}
