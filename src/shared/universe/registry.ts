import { downloadTextFile } from "../world/registry.ts";
import { parseUniversefile, serializeUniversefile } from "../world/toml.ts";
import type { Universefile } from "../world/types.ts";

export interface StoredUniversefile {
	id: string;
	universe: Universefile;
	createdAt: number;
	updatedAt: number;
}

const STORAGE_KEY_UNIVERSES = "roleplay:universes";

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

// Default Seed Universefile

export const SAMPLE_UNIVERSEFILE: Universefile = {
	metadata: {
		name: "prime_reality",
		version: "1.0.0",
		title: "Prime Reality Continuum",
		description: "Fundamental reality layer governing physical invariants and universal constants.",
		authors: ["Universe Architect"],
		tags: ["core", "physics", "multiverse"],
	},
	settings: {
		rules: [
			"Conservation of energy holds across all physical interactions.",
			"Faster-than-light transit requires stable warp gates.",
			"Temporal paradoxes trigger local timeline collapse.",
		],
		backgrounds: [
			"The Prime Reality Continuum is the anchor timeline for all branch sectors.",
			"Ancient warp gate relays maintain cohesion across isolated worlds.",
		],
	},
	states: {
		"universe.entropy_level": 0.05,
		"universe.warp_gate_network_active": true,
		"universe.timeline_stability": 98.5,
		"universe.known_sectors": ["sector_1", "sector_7", "core_prime"],
	},
};

// Universe Registry Operations

export function getAllUniverses(): StoredUniversefile[] {
	const raw = getStorageItem(STORAGE_KEY_UNIVERSES);

	if (!raw) {
		const seeded: StoredUniversefile = {
			id: SAMPLE_UNIVERSEFILE.metadata.name,
			universe: SAMPLE_UNIVERSEFILE,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		setStorageItem(STORAGE_KEY_UNIVERSES, JSON.stringify([seeded]));

		return [seeded];
	}

	try {
		const parsed = JSON.parse(raw);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed as StoredUniversefile[];
	}
	catch {
		return [];
	}
}

export function getUniverse(id: string): StoredUniversefile | undefined {
	const all = getAllUniverses();

	return all.find(item => item.id === id);
}

export function saveUniverse(universe: Universefile, existingId?: string): StoredUniversefile {
	const all = getAllUniverses();
	const now = Date.now();
	const targetId = existingId || universe.metadata.name || `universe_${now}`;

	const existingIndex = all.findIndex(item => item.id === targetId);

	let record: StoredUniversefile;

	if (existingIndex >= 0) {
		record = {
			...all[existingIndex],
			id: targetId,
			universe,
			updatedAt: now,
		};
		all[existingIndex] = record;
	}
	else {
		record = {
			id: targetId,
			universe,
			createdAt: now,
			updatedAt: now,
		};
		all.unshift(record);
	}

	setStorageItem(STORAGE_KEY_UNIVERSES, JSON.stringify(all));

	return record;
}

export function deleteUniverse(id: string): boolean {
	const all = getAllUniverses();
	const filtered = all.filter(item => item.id !== id);

	if (filtered.length === all.length) {
		return false;
	}

	setStorageItem(STORAGE_KEY_UNIVERSES, JSON.stringify(filtered));

	return true;
}

export function importUniverseFromToml(tomlContent: string): StoredUniversefile {
	const universe = parseUniversefile(tomlContent);

	return saveUniverse(universe);
}

export function exportUniverseToToml(id: string): string {
	const record = getUniverse(id);

	if (!record) {
		throw new Error(`Universefile with id "${id}" not found.`);
	}

	return serializeUniversefile(record.universe);
}

export function exportUniverseAsFile(id: string, filename?: string): void {
	const tomlContent = exportUniverseToToml(id);
	const record = getUniverse(id);
	const targetFilename = filename || `${record?.universe.metadata.name || id}.universefile.toml`;

	downloadTextFile(tomlContent, targetFilename, "application/toml");
}
