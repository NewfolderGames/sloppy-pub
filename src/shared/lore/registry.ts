import { parseLorebook, serializeLorebook } from "./toml.ts";
import type { LoreBook, LoreEntry, StoredLoreBook } from "./types.ts";

const STORAGE_KEY_LOREBOOKS = "roleplay:lorebooks";

const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			return window.localStorage.getItem(key);
		}
		catch {
			return memoryStorage.get(key) ?? null;
		}
	}

	return memoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			window.localStorage.setItem(key, value);
			return;
		}
		catch {
			// Fallback to memory
		}
	}

	memoryStorage.set(key, value);
}

// Sample Lore Book

export const SAMPLE_LORE_BOOK: LoreBook = {
	id: "sample_lore",
	name: "Sector 7 Lore",
	entries: [
		{
			id: "entry_omni",
			title: "OmniTech Corporation",
			content: "OmniTech is the dominant megacorporation controlling Sector 7. Known for ruthless corporate espionage and cutting-edge cyberware research. Their headquarters tower looms over the district.",
			keywords: ["omni", "omnitech", "corp", "megacorporation"],
			activationMode: "static",
			enabled: true,
		},
		{
			id: "entry_blackmarket",
			title: "The Underground Black Market",
			content: "Beneath the streets of Sector 7 lies a sprawling black market where illegal cyberware, stolen data, and contraband weapons change hands. The market is controlled by rival syndicates.",
			keywords: ["black market", "underground", "contraband", "illegal", "cyberware"],
			activationMode: "dynamic",
			enabled: true,
			priority: 5,
		},
		{
			id: "entry_netwatch",
			title: "NetWatch Division",
			content: "A special police unit that monitors the city's network traffic. They can trace illegal netruns and deploy ICE countermeasures. Their patrols are most active during corporate hours.",
			keywords: ["netwatch", "police", "netrun", "ice", "trace"],
			activationMode: "dynamic",
			enabled: true,
			priority: 3,
		},
	],
};

// Lore Book Registry Operations

export function getAllLoreBooks(): StoredLoreBook[] {
	const raw = getStorageItem(STORAGE_KEY_LOREBOOKS);

	if (!raw) {
		const seeded: StoredLoreBook = {
			id: SAMPLE_LORE_BOOK.id,
			lorebook: SAMPLE_LORE_BOOK,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		setStorageItem(STORAGE_KEY_LOREBOOKS, JSON.stringify([seeded]));

		return [seeded];
	}

	try {
		const parsed = JSON.parse(raw);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed as StoredLoreBook[];
	}
	catch {
		return [];
	}
}

export function getLoreBook(id: string): StoredLoreBook | undefined {
	const all = getAllLoreBooks();

	return all.find(item => item.id === id);
}

export function saveLoreBook(lorebook: LoreBook, existingId?: string): StoredLoreBook {
	const all = getAllLoreBooks();
	const now = Date.now();
	const targetId = existingId || lorebook.id || `lore_${now}`;

	const existingIndex = all.findIndex(item => item.id === targetId);

	let record: StoredLoreBook;

	if (existingIndex >= 0) {
		record = {
			...all[existingIndex],
			id: targetId,
			lorebook,
			updatedAt: now,
		};
		all[existingIndex] = record;
	}
	else {
		record = {
			id: targetId,
			lorebook,
			createdAt: now,
			updatedAt: now,
		};
		all.unshift(record);
	}

	setStorageItem(STORAGE_KEY_LOREBOOKS, JSON.stringify(all));

	return record;
}

export function deleteLoreBook(id: string): boolean {
	const all = getAllLoreBooks();
	const filtered = all.filter(item => item.id !== id);

	if (filtered.length === all.length) {
		return false;
	}

	setStorageItem(STORAGE_KEY_LOREBOOKS, JSON.stringify(filtered));

	return true;
}

// Entry-level Operations

export function addLoreEntry(lorebookId: string, entry: LoreEntry): boolean {
	const record = getLoreBook(lorebookId);

	if (!record) {
		return false;
	}

	record.lorebook.entries.push(entry);
	saveLoreBook(record.lorebook, lorebookId);

	return true;
}

export function updateLoreEntry(lorebookId: string, entryId: string, updates: Partial<LoreEntry>): boolean {
	const record = getLoreBook(lorebookId);

	if (!record) {
		return false;
	}

	const index = record.lorebook.entries.findIndex(e => e.id === entryId);

	if (index < 0) {
		return false;
	}

	record.lorebook.entries[index] = {
		...record.lorebook.entries[index],
		...updates,
		id: entryId,
	};
	saveLoreBook(record.lorebook, lorebookId);

	return true;
}

export function removeLoreEntry(lorebookId: string, entryId: string): boolean {
	const record = getLoreBook(lorebookId);

	if (!record) {
		return false;
	}

	const before = record.lorebook.entries.length;

	record.lorebook.entries = record.lorebook.entries.filter(e => e.id !== entryId);

	if (record.lorebook.entries.length === before) {
		return false;
	}

	saveLoreBook(record.lorebook, lorebookId);

	return true;
}

export function getActiveLoreEntries(
	lorebookId: string | string[],
	currentMessage?: string,
): LoreEntry[] {
	const ids = Array.isArray(lorebookId) ? lorebookId : [lorebookId];
	const messageLower = currentMessage?.toLowerCase() ?? "";
	const matchedEntries: LoreEntry[] = [];
	const seenIds = new Set<string>();

	for (const id of ids) {
		const record = getLoreBook(id);

		if (!record) {
			continue;
		}

		for (const entry of record.lorebook.entries) {
			if (!entry.enabled || seenIds.has(entry.id)) {
				continue;
			}

			if (entry.activationMode === "static") {
				seenIds.add(entry.id);
				matchedEntries.push(entry);
			}
			else if (entry.activationMode === "dynamic") {
				if (
					entry.keywords.length > 0
					&& entry.keywords.some(kw => messageLower.includes(kw.toLowerCase()))
				) {
					seenIds.add(entry.id);
					matchedEntries.push(entry);
				}
			}
		}
	}

	return matchedEntries;
}

// File Download Helper

export function downloadTextFile(content: string, filename: string, mimeType = "text/plain"): void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return;
	}

	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// TOML Import/Export

export function importLorebookFromToml(tomlContent: string): StoredLoreBook {
	const lorebook = parseLorebook(tomlContent);

	return saveLoreBook(lorebook);
}

export function exportLorebookToToml(id: string): string {
	const record = getLoreBook(id);

	if (!record) {
		throw new Error(`Lore book with id "${id}" not found.`);
	}

	return serializeLorebook(record.lorebook);
}

export function exportLorebookAsFile(id: string, filename?: string): void {
	const tomlContent = exportLorebookToToml(id);
	const record = getLoreBook(id);
	const targetFilename = filename || `${record?.lorebook.name || id}.lorefile.toml`;

	downloadTextFile(tomlContent, targetFilename, "application/toml");
}
