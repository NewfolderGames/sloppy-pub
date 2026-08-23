import { parse } from "smol-toml";
import { stringifyToml } from "../toml/stringify.ts";
import type { ActivationMode, LoreBook, LoreEntry } from "./types.ts";

// Helper: assert value is a non-null object

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Field "${path}" must be a table.`);
	}
}

// Helper: assert value is a string

function assertString(value: unknown, path: string): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`Field "${path}" must be a string.`);
	}
}

// Helper: assert value is a string array

function assertStringArray(value: unknown, path: string): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`Field "${path}" must be an array of strings.`);
	}

	for (let i = 0; i < value.length; i++) {
		if (typeof value[i] !== "string") {
			throw new Error(`Field "${path}[${i}]" must be a string.`);
		}
	}
}

// Parse a single lore entry from a raw table

function parseLoreEntry(raw: unknown, index: number): LoreEntry {
	assertObject(raw, `entries[${index}]`);

	const fallbackId = `entry_${index + 1}`;
	const rawId = typeof raw.id === "string" ? raw.id.trim() : "";
	const rawTitle = typeof raw.title === "string" ? raw.title.trim() : "";
	const rawContent = typeof raw.content === "string" ? raw.content : String(raw.content ?? "");

	const id = rawId || (rawTitle ? rawTitle.toLowerCase().replace(/\s+/g, "_") : fallbackId);
	const title = rawTitle || rawId || `Entry ${index + 1}`;

	const entry: LoreEntry = {
		id,
		title,
		content: rawContent,
		keywords: [],
		activationMode: "static",
		enabled: true,
	};

	if (raw.keywords !== undefined) {
		if (typeof raw.keywords === "string") {
			entry.keywords = [raw.keywords.trim()];
		}
		else {
			assertStringArray(raw.keywords, `entries[${index}].keywords`);
			entry.keywords = raw.keywords;
		}
	}

	if (raw.activation_mode !== undefined) {
		assertString(raw.activation_mode, `entries[${index}].activation_mode`);

		if (raw.activation_mode !== "static" && raw.activation_mode !== "dynamic") {
			throw new Error(
				`Field "entries[${index}].activation_mode" must be "static" or "dynamic".`,
			);
		}

		entry.activationMode = raw.activation_mode as ActivationMode;
	}

	if (raw.enabled !== undefined) {
		if (typeof raw.enabled !== "boolean") {
			throw new Error(`Field "entries[${index}].enabled" must be a boolean.`);
		}

		entry.enabled = raw.enabled;
	}

	if (raw.priority !== undefined) {
		if (typeof raw.priority !== "number" || !Number.isInteger(raw.priority)) {
			throw new Error(`Field "entries[${index}].priority" must be an integer.`);
		}

		entry.priority = raw.priority;
	}

	if (raw.feeling_lucky !== undefined || raw.feelingLucky !== undefined) {
		const rawLucky = (raw.feeling_lucky ?? raw.feelingLucky) as Record<string, unknown>;
		if (typeof rawLucky === "object" && rawLucky !== null) {
			entry.feelingLucky = {
				title: rawLucky.title !== undefined ? Boolean(rawLucky.title) : undefined,
				content: rawLucky.content !== undefined ? Boolean(rawLucky.content) : undefined,
				keywords: rawLucky.keywords !== undefined ? Boolean(rawLucky.keywords) : undefined,
			};
		}
	}

	return entry;
}

// Serialize a single lore entry to a plain object

function serializeLoreEntry(entry: LoreEntry): Record<string, unknown> {
	const doc: Record<string, unknown> = {
		id: entry.id,
		title: entry.title,
		content: entry.content,
	};

	if (entry.keywords.length > 0) {
		doc.keywords = entry.keywords;
	}

	if (entry.activationMode !== "static") {
		doc.activation_mode = entry.activationMode;
	}

	if (!entry.enabled) {
		doc.enabled = false;
	}

	if (entry.priority !== undefined) {
		doc.priority = entry.priority;
	}

	if (
		entry.feelingLucky &&
		(entry.feelingLucky.title || entry.feelingLucky.content || entry.feelingLucky.keywords)
	) {
		doc.feeling_lucky = {
			...(entry.feelingLucky.title ? { title: true } : {}),
			...(entry.feelingLucky.content ? { content: true } : {}),
			...(entry.feelingLucky.keywords ? { keywords: true } : {}),
		};
	}

	return doc;
}

// Public Parsers and Serializers

export function parseLorebook(tomlContent: string): LoreBook {
	if (typeof tomlContent !== "string" || tomlContent.trim() === "") {
		throw new Error("Lorebook TOML content cannot be empty.");
	}

	const raw = parse(tomlContent);
	assertObject(raw, "root");

	const rawRoot = raw as Record<string, unknown>;
	const rawMetadata = rawRoot.metadata && typeof rawRoot.metadata === "object"
		? (rawRoot.metadata as Record<string, unknown>)
		: {};

	const rawName = typeof rawRoot.name === "string"
		? rawRoot.name
		: typeof rawMetadata.name === "string"
			? rawMetadata.name
			: typeof rawRoot.title === "string"
				? rawRoot.title
				: typeof rawMetadata.title === "string"
					? rawMetadata.title
					: typeof rawRoot.id === "string"
						? rawRoot.id
						: undefined;

	if (typeof rawName !== "string" || rawName.trim() === "") {
		throw new Error("Field \"name\" must be a string.");
	}

	const lorebook: LoreBook = {
		id: typeof rawRoot.id === "string" ? rawRoot.id : rawName.trim(),
		name: rawName.trim(),
		entries: [],
	};

	if (rawRoot.entries !== undefined) {
		if (typeof rawRoot.entries === "object" && !Array.isArray(rawRoot.entries) && rawRoot.entries !== null) {
			lorebook.entries = [parseLoreEntry(rawRoot.entries, 0)];
		}
		else if (Array.isArray(rawRoot.entries)) {
			lorebook.entries = rawRoot.entries.map((entry, idx) => parseLoreEntry(entry, idx));
		}
		else {
			throw new Error("Field \"entries\" must be an array of tables.");
		}
	}

	return lorebook;
}

export function serializeLorebook(lorebook: LoreBook): string {
	const doc: Record<string, unknown> = {
		name: lorebook.name,
	};

	if (lorebook.id && lorebook.id !== lorebook.name) {
		doc.id = lorebook.id;
	}

	if (lorebook.entries.length > 0) {
		doc.entries = lorebook.entries.map(serializeLoreEntry);
	}

	return stringifyToml(doc);
}
