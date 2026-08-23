import { downloadTextFile } from "../world/registry.ts";
import { parseCharacterfile, serializeCharacterfile } from "./toml.ts";
import type { Characterfile, StoredCharacterfile } from "./types.ts";

export type { StoredCharacterfile };

const STORAGE_KEY_CHARACTERFILES = "roleplay:characterfiles";

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

// Default Seed Characterfile

export const SAMPLE_CHARACTERFILE: Characterfile = {
	metadata: {
		name: "elena_vance",
		version: "1.0.0",
		title: "Dr. Elena Vance",
		description: "A brilliant astrophysicist researching deep-space signals.",
		authors: ["Roleplay Author"],
		tags: ["sci-fi", "scientist", "investigator"],
	},
	summary:
		"Dr. Elena Vance is a dedicated astrophysicist at the high-altitude Kepler Observatory. She is meticulous, intellectually curious, and driven by an intense desire to decode anomalous cosmic transmissions.",
	physical_characteristics: [
		{
			name: "Species",
			description: "Human",
		},
		{
			name: "Age",
			description: "34",
		},
		{
			name: "Height",
			description: "172 cm",
		},
	],
	linguistic_patterns: [
		{
			name: "Voice",
			description: "Soft-spoken, calm, and deliberate",
		},
		{
			name: "Accent",
			description: "Slight Mid-Atlantic academic cadence",
		},
		{
			name: "Tone",
			description: "Analytical, inquisitive, and polite",
		},
		{
			name: "Dialect",
			description: "Standard English enriched with scientific terminology",
		},
	],
	psychology_and_worldviews: [
		{
			name: "Scientific Rationalism",
			description: "Believes every anomaly possesses a discoverable physical explanation.",
		},
		{
			name: "Guarded Optimism",
			description: "Maintains hope that contact with extraterrestrial intelligence will be benign.",
		},
	],
	lifestyle_and_preferences: [
		{
			name: "Work Ethic",
			description: "Spends nocturnal hours analyzing stellar telemetry while sipping black tea.",
		},
		{
			name: "Minimalist",
			description: "Prefers orderly workbenches with neatly cataloged sensor logs.",
		},
	],
	desires: [
		{
			name: "Signal Decryption",
			description: "Aims to decrypt the repeating pulsar sequence from Sector 12.",
		},
	],
	skills: [
		{
			name: "Signal Analysis",
			description: "Expert in analyzing stellar telemetry data.",
		},
		{
			name: "System Engineering",
			description: "Maintains and calibrates sensor arrays.",
		},
	],
	backgrounds: [
		{
			name: "Education",
			content: "PhD in Astrophysics from Tycho University.",
		},
		{
			name: "Career",
			content: "Former research lead at the Lunar Array Project.",
		},
	],
	example_dialogs: [
		{
			name: "Greeting a Colleague",
			dialog:
				"The sensor array picked up another harmonic pulse. Take a look at these frequencies with me.",
		},
		{
			name: "Under Stress",
			dialog:
				"Keep the cooling lines stable. If the receiver overheats, we lose forty hours of continuous telemetry.",
		},
	],
	initial_states: {
		focus_level: 90,
		current_location: "Kepler Observatory Lab",
		fatigue: "mild",
		active_telemetry: true,
	},
};

// Characterfile Registry Operations

export function getAllCharacterfiles(): StoredCharacterfile[] {
	const raw = getStorageItem(STORAGE_KEY_CHARACTERFILES);

	if (!raw) {
		const seeded: StoredCharacterfile = {
			id: SAMPLE_CHARACTERFILE.metadata.name,
			characterfile: SAMPLE_CHARACTERFILE,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		setStorageItem(STORAGE_KEY_CHARACTERFILES, JSON.stringify([seeded]));

		return [seeded];
	}

	try {
		const parsed = JSON.parse(raw);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed as StoredCharacterfile[];
	}
	catch {
		return [];
	}
}

export function getCharacterfile(id: string): StoredCharacterfile | undefined {
	const all = getAllCharacterfiles();

	return all.find(item => item.id === id);
}

export function saveCharacterfile(
	characterfile: Characterfile,
	existingId?: string,
): StoredCharacterfile {
	const all = getAllCharacterfiles();
	const now = Date.now();
	const targetId = existingId || characterfile.metadata.name || `character_${now}`;

	const existingIndex = all.findIndex(item => item.id === targetId);

	let record: StoredCharacterfile;

	if (existingIndex >= 0) {
		record = {
			...all[existingIndex],
			id: targetId,
			characterfile,
			updatedAt: now,
		};
		all[existingIndex] = record;
	}
	else {
		record = {
			id: targetId,
			characterfile,
			createdAt: now,
			updatedAt: now,
		};
		all.unshift(record);
	}

	setStorageItem(STORAGE_KEY_CHARACTERFILES, JSON.stringify(all));

	return record;
}

export function deleteCharacterfile(id: string): boolean {
	const all = getAllCharacterfiles();
	const filtered = all.filter(item => item.id !== id);

	if (filtered.length === all.length) {
		return false;
	}

	setStorageItem(STORAGE_KEY_CHARACTERFILES, JSON.stringify(filtered));

	return true;
}

export function importCharacterfileFromToml(tomlContent: string): StoredCharacterfile {
	const characterfile = parseCharacterfile(tomlContent);

	return saveCharacterfile(characterfile);
}

export function exportCharacterfileToToml(id: string): string {
	const record = getCharacterfile(id);

	if (!record) {
		throw new Error(`Characterfile with id "${id}" not found.`);
	}

	return serializeCharacterfile(record.characterfile);
}

export function exportCharacterfileAsFile(id: string, filename?: string): void {
	const tomlContent = exportCharacterfileToToml(id);
	const record = getCharacterfile(id);
	const targetFilename
		= filename || `${record?.characterfile.metadata.name || id}.characterfile.toml`;

	downloadTextFile(tomlContent, targetFilename, "text/plain");
}
