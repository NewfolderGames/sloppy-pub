import { parseWorldfile, serializeWorldfile } from "./toml.ts";
import type { Worldfile, WorldfileContent } from "./types.ts";

export interface StoredWorldfile {
	id: string;
	worldfile: Worldfile;
	createdAt: number;
	updatedAt: number;
}

const STORAGE_KEY_WORLDFILES = "roleplay:worldfiles";

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

// Default Seed Worldfile

export const SAMPLE_WORLDFILE: Worldfile = {
	metadata: {
		name: "neon_syndicate",
		version: "1.0.0",
		title: "Neon Syndicate: Sector 7",
		description: "A gritty cyberpunk roleplay environment in high-tech Sector 7.",
		authors: ["Roleplay Author"],
		tags: ["cyberpunk", "sci-fi", "investigation"],
	},
	args: [
		{
			name: "CORP_NAME",
			type: "text",
			default: "OmniTech",
			description: "Dominant megacorporation controlling Sector 7.",
		},
		{
			name: "RAIN_INTENSITY",
			type: "select",
			default: "heavy",
			description: "Atmospheric acid rain intensity.",
			values: ["light", "moderate", "heavy", "acidic_storm"],
		},
		{
			name: "CYBERWARE_LIMIT",
			type: "number",
			default: 5,
			description: "Max cyberware implants before cyberpsychosis risk.",
			format: "int",
			range: "1,10",
		},
	],
	vars: [
		{
			name: "PLAYER_NAME",
			type: "text",
			default: "V",
			description: "Name of the operative.",
		},
		{
			name: "PLAYER_ROLE",
			type: "select",
			default: "netrunner",
			description: "Class archetype of the player.",
			values: ["netrunner", "solo", "fixer", "techie"],
		},
		{
			name: "STARTING_CREDITS",
			type: "number",
			default: 1500,
			description: "Starting currency in Eurodollars.",
		},
	],
	content: {
		backgrounds: [
			"Welcome to Sector 7, heavily influenced by {{CORP_NAME}}.",
			"The streets are drenched in {{RAIN_INTENSITY}} neon rain. Cyberware tolerance is capped at {{CYBERWARE_LIMIT}} slots.",
		],
		description: "Welcome to Sector 7, heavily influenced by {{CORP_NAME}}. The streets are drenched in {{RAIN_INTENSITY}} neon rain. Cyberware tolerance is capped at {{CYBERWARE_LIMIT}} slots.",
		guidelines: [],
		settings: {
			rules: [
				"Corporations enforce strict curfews after midnight.",
				"All transactions use verified credsticks.",
			],
			guidelines: [
				"Respond with dark, atmospheric cyberpunk descriptions.",
				"Highlight high-tech low-life themes.",
			],
		},
		plot: {
			intro: {
				mode: "random",
				list: [
					{ value: "You awaken in a damp alleyway behind a noodle stand." },
					{ value: "A high-priority encrypted message flashes on your holo-visor." },
				],
			},
			incident: {
				list: [
					{
						value: "A syndicate drone scans the alleyway.",
						trigger: "periodic",
					},
				],
			},
		},
	},
	states: {
		"sector.alert_level": 1,
		"player.health": 100,
		"player.cyberware_slots": 2,
		"player.inventory": ["credstick", "deck", "monowire"],
	},
};

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

// Worldfile Registry Operations

export function getAllWorldfiles(): StoredWorldfile[] {
	const raw = getStorageItem(STORAGE_KEY_WORLDFILES);

	if (!raw) {
		const seeded: StoredWorldfile = {
			id: SAMPLE_WORLDFILE.metadata.name,
			worldfile: SAMPLE_WORLDFILE,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		setStorageItem(STORAGE_KEY_WORLDFILES, JSON.stringify([seeded]));

		return [seeded];
	}

	try {
		const parsed = JSON.parse(raw);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed as StoredWorldfile[];
	}
	catch {
		return [];
	}
}

export function getWorldfile(id: string): StoredWorldfile | undefined {
	const all = getAllWorldfiles();

	return all.find(item => item.id === id);
}

export function saveWorldfile(worldfile: Worldfile, existingId?: string): StoredWorldfile {
	const all = getAllWorldfiles();
	const now = Date.now();
	const targetId = existingId || worldfile.metadata.name || `world_${now}`;

	const existingIndex = all.findIndex(item => item.id === targetId);

	let record: StoredWorldfile;

	if (existingIndex >= 0) {
		record = {
			...all[existingIndex],
			id: targetId,
			worldfile,
			updatedAt: now,
		};
		all[existingIndex] = record;
	}
	else {
		record = {
			id: targetId,
			worldfile,
			createdAt: now,
			updatedAt: now,
		};
		all.unshift(record);
	}

	setStorageItem(STORAGE_KEY_WORLDFILES, JSON.stringify(all));

	return record;
}

export function deleteWorldfile(id: string): boolean {
	const all = getAllWorldfiles();
	const filtered = all.filter(item => item.id !== id);

	if (filtered.length === all.length) {
		return false;
	}

	setStorageItem(STORAGE_KEY_WORLDFILES, JSON.stringify(filtered));

	return true;
}

// Variant Inheritance Resolution

export function resolveVariantWorldfile(id: string): Worldfile | undefined {

	const record = getWorldfile(id);
	if (!record) {
		return undefined;
	}

	const worldfile = record.worldfile;
	const fromId = worldfile.metadata.from;

	if (!fromId) {
		return worldfile;
	}

	const parent = resolveVariantWorldfile(fromId);
	if (!parent) {
		return worldfile;
	}

	// Deep merge: parent content is base, variant overrides
	const mergedContent: WorldfileContent = {
		...parent.content,
		...worldfile.content,
		guidelines: worldfile.content.guidelines.length > 0
			? worldfile.content.guidelines
			: parent.content.guidelines,
		setting_description: worldfile.content.setting_description ?? parent.content.setting_description,
		settings: {
			...(parent.content.settings || {}),
			...(worldfile.content.settings || {}),
			rules: worldfile.content.settings?.rules ?? parent.content.settings?.rules,
			guidelines: worldfile.content.settings?.guidelines ?? parent.content.settings?.guidelines,
		},
		plot: worldfile.content.plot ?? parent.content.plot,
		generation: worldfile.content.generation ?? parent.content.generation,
	};

	// Merge backgrounds
	if (worldfile.content.backgrounds.length === 0 && parent.content.backgrounds.length > 0) {
		mergedContent.backgrounds = [...parent.content.backgrounds];
	}

	return {
		metadata: worldfile.metadata,
		args: worldfile.args && worldfile.args.length > 0 ? worldfile.args : parent.args,
		vars: worldfile.vars && worldfile.vars.length > 0 ? worldfile.vars : parent.vars,
		content: mergedContent,
		states: worldfile.states && Object.keys(worldfile.states).length > 0
			? { ...parent.states, ...worldfile.states }
			: parent.states,
	};

}

// File Download Helper

export function importWorldfileFromToml(tomlContent: string): StoredWorldfile {
	const worldfile = parseWorldfile(tomlContent);

	return saveWorldfile(worldfile);
}

export function exportWorldfileToToml(id: string): string {
	const record = getWorldfile(id);

	if (!record) {
		throw new Error(`Worldfile with id "${id}" not found.`);
	}

	return serializeWorldfile(record.worldfile);
}

export function exportWorldfileAsFile(id: string, filename?: string): void {
	const tomlContent = exportWorldfileToToml(id);
	const record = getWorldfile(id);
	const targetFilename = filename || `${record?.worldfile.metadata.name || id}.worldfile.toml`;

	downloadTextFile(tomlContent, targetFilename, "application/toml");
}
