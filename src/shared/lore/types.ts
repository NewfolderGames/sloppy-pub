export type ActivationMode = "static" | "dynamic";

export interface LoreEntryFeelingLucky {
	title?: boolean;
	content?: boolean;
	keywords?: boolean;
}

export interface LoreEntry {
	id: string;
	title: string;
	content: string;
	keywords: string[];
	activationMode: ActivationMode;
	enabled: boolean;
	priority?: number;
	feelingLucky?: LoreEntryFeelingLucky;
}

export interface LoreBook {
	id: string;
	name: string;
	entries: LoreEntry[];
}

export interface StoredLoreBook {
	id: string;
	lorebook: LoreBook;
	createdAt: number;
	updatedAt: number;
}
