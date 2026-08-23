import { parse } from "smol-toml";
import { stringifyToml } from "../toml/stringify.ts";
import { flattenStates } from "../world/toml.ts";
import type { CharacterBackground, Characterfile, CharacterfileMetadata, CharacterStates, ExampleDialog, NamedTrait } from "./types.ts";

export const DEFAULT_PHYSICAL_TRAITS: readonly string[] = ["Species", "Age", "Height"] as const;

export const DEFAULT_LINGUISTIC_TRAITS: readonly string[] = [
	"Voice",
	"Accent",
	"Tone",
	"Dialect",
] as const;

// Validation and Error Helpers

function assertObject(value: unknown, fieldName: string): asserts value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Field "${fieldName}" must be an object.`);
	}
}

function assertString(value: unknown, fieldName: string, allowEmpty = false): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`Field "${fieldName}" must be a string.`);
	}

	if (!allowEmpty && value.trim() === "") {
		throw new Error(`Field "${fieldName}" cannot be empty.`);
	}
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`Field "${fieldName}" must be an array of strings.`);
	}

	for (let index = 0; index < value.length; index++) {
		if (typeof value[index] !== "string") {
			throw new Error(`Item at index ${index} in "${fieldName}" must be a string.`);
		}
	}
}

function parseNamedTraitList(rawList: unknown, fieldName: string): NamedTrait[] {
	if (rawList === undefined || rawList === null) {
		return [];
	}

	if (typeof rawList === "object" && !Array.isArray(rawList)) {
		const traits: NamedTrait[] = [];
		for (const [key, val] of Object.entries(rawList as Record<string, unknown>)) {
			traits.push({
				name: key.trim(),
				description: typeof val === "string" ? val.trim() : String(val ?? "").trim(),
			});
		}
		return traits;
	}

	if (!Array.isArray(rawList)) {
		throw new Error(`Field "${fieldName}" must be an array.`);
	}

	const traits: NamedTrait[] = [];

	for (let index = 0; index < rawList.length; index++) {
		const item = rawList[index];

		if (typeof item === "string") {
			const trimmed = item.trim();
			const colonIndex = trimmed.indexOf(":");
			const dashIndex = trimmed.indexOf(" - ");
			const equalsIndex = trimmed.indexOf("=");

			if (colonIndex > 0) {
				traits.push({
					name: trimmed.slice(0, colonIndex).trim(),
					description: trimmed.slice(colonIndex + 1).trim(),
				});
			}
			else if (dashIndex > 0) {
				traits.push({
					name: trimmed.slice(0, dashIndex).trim(),
					description: trimmed.slice(dashIndex + 3).trim(),
				});
			}
			else if (equalsIndex > 0) {
				traits.push({
					name: trimmed.slice(0, equalsIndex).trim(),
					description: trimmed.slice(equalsIndex + 1).trim(),
				});
			}
			else {
				traits.push({
					name: trimmed,
					description: "",
				});
			}
			continue;
		}

		if (item === null || typeof item !== "object" || Array.isArray(item)) {
			throw new Error(`Item at index ${index} in "${fieldName}" must be an object.`);
		}

		const itemRecord = item as Record<string, unknown>;

		assertString(itemRecord.name, `${fieldName}[${index}].name`);
		assertString(itemRecord.description, `${fieldName}[${index}].description`, true);

		const feelingLucky = itemRecord.feeling_lucky !== undefined
			? Boolean(itemRecord.feeling_lucky)
			: itemRecord.feelingLucky !== undefined
				? Boolean(itemRecord.feelingLucky)
				: undefined;

		traits.push({
			name: itemRecord.name.trim(),
			description: itemRecord.description.trim(),
			...(feelingLucky !== undefined ? { feelingLucky } : {}),
		});
	}

	return traits;
}

function parseCharacterBackgrounds(rawList: unknown): CharacterBackground[] {
	if (rawList === undefined || rawList === null) {
		return [];
	}

	if (typeof rawList === "string") {
		return [{
			name: "",
			content: rawList.trim(),
		}];
	}

	if (typeof rawList === "object" && !Array.isArray(rawList)) {
		const itemRecord = rawList as Record<string, unknown>;
		const name = typeof itemRecord.name === "string" ? itemRecord.name.trim() : "";
		const content = typeof itemRecord.content === "string" ? itemRecord.content.trim() : "";
		const feelingLucky = itemRecord.feeling_lucky !== undefined
			? Boolean(itemRecord.feeling_lucky)
			: itemRecord.feelingLucky !== undefined
				? Boolean(itemRecord.feelingLucky)
				: undefined;

		return [{
			name,
			content,
			...(feelingLucky !== undefined ? { feelingLucky } : {}),
		}];
	}

	if (!Array.isArray(rawList)) {
		throw new Error("Field \"backgrounds\" must be an array.");
	}

	const backgrounds: CharacterBackground[] = [];

	for (let index = 0; index < rawList.length; index++) {
		const item = rawList[index];

		if (typeof item === "string") {
			backgrounds.push({
				name: "",
				content: item.trim(),
			});
		}
		else if (item !== null && typeof item === "object" && !Array.isArray(item)) {
			const itemRecord = item as Record<string, unknown>;
			const name = typeof itemRecord.name === "string" ? itemRecord.name.trim() : "";
			const content = typeof itemRecord.content === "string" ? itemRecord.content.trim() : "";
			const feelingLucky = itemRecord.feeling_lucky !== undefined
				? Boolean(itemRecord.feeling_lucky)
				: itemRecord.feelingLucky !== undefined
					? Boolean(itemRecord.feelingLucky)
					: undefined;

			backgrounds.push({
				name,
				content,
				...(feelingLucky !== undefined ? { feelingLucky } : {}),
			});
		}
		else {
			throw new Error(`Item at index ${index} in "backgrounds" must be a string or object.`);
		}
	}

	return backgrounds;
}

function parseExampleDialogs(rawList: unknown): ExampleDialog[] {
	if (rawList === undefined || rawList === null) {
		return [];
	}

	if (typeof rawList === "object" && !Array.isArray(rawList)) {
		const itemRecord = rawList as Record<string, unknown>;
		const name = typeof itemRecord.name === "string" ? itemRecord.name.trim() : "";
		const dialog = typeof itemRecord.dialog === "string" ? itemRecord.dialog.trim() : "";
		const feelingLucky = itemRecord.feeling_lucky !== undefined
			? Boolean(itemRecord.feeling_lucky)
			: itemRecord.feelingLucky !== undefined
				? Boolean(itemRecord.feelingLucky)
				: undefined;

		return [{
			name,
			dialog,
			...(feelingLucky !== undefined ? { feelingLucky } : {}),
		}];
	}

	if (!Array.isArray(rawList)) {
		throw new Error("Field \"example_dialogs\" must be an array.");
	}

	const dialogs: ExampleDialog[] = [];

	for (let index = 0; index < rawList.length; index++) {
		const item = rawList[index];

		if (item === null || typeof item !== "object" || Array.isArray(item)) {
			throw new Error(`Item at index ${index} in "example_dialogs" must be an object.`);
		}

		const itemRecord = item as Record<string, unknown>;

		assertString(itemRecord.name, `example_dialogs[${index}].name`);
		assertString(itemRecord.dialog, `example_dialogs[${index}].dialog`, true);

		const feelingLucky = itemRecord.feeling_lucky !== undefined
			? Boolean(itemRecord.feeling_lucky)
			: itemRecord.feelingLucky !== undefined
				? Boolean(itemRecord.feelingLucky)
				: undefined;

		dialogs.push({
			name: itemRecord.name.trim(),
			dialog: itemRecord.dialog.trim(),
			...(feelingLucky !== undefined ? { feelingLucky } : {}),
		});
	}

	return dialogs;
}

function ensureDefaultTraits(
	existingTraits: NamedTrait[],
	requiredNames: readonly string[],
): NamedTrait[] {
	const result = [...existingTraits];

	for (const requiredName of requiredNames) {
		const exists = result.some(
			trait => trait.name.toLowerCase() === requiredName.toLowerCase(),
		);

		if (!exists) {
			result.push({
				name: requiredName,
				description: "",
			});
		}
	}

	return result;
}

// Metadata Parsing

function parseCharacterfileMetadata(rawMetadata: unknown, rawRoot?: Record<string, unknown>): CharacterfileMetadata {
	const hasRootMeta = rawRoot
		&& typeof rawRoot.name === "string"
		&& typeof rawRoot.version === "string"
		&& typeof rawRoot.title === "string";

	if (rawMetadata === undefined && !hasRootMeta) {
		assertObject(rawMetadata, "metadata");
	}

	const source = rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
		? (rawMetadata as Record<string, unknown>)
		: (rawRoot ?? {});

	const rawName = source.name !== undefined ? source.name : rawRoot?.name;
	const rawVersion = source.version !== undefined ? source.version : rawRoot?.version;
	const rawTitle = source.title !== undefined ? source.title : rawRoot?.title;
	const rawDescription = source.description !== undefined ? source.description : rawRoot?.description;

	assertString(rawName, "metadata.name");
	assertString(rawVersion, "metadata.version");
	assertString(rawTitle, "metadata.title");
	assertString(rawDescription, "metadata.description", true);

	const metadata: CharacterfileMetadata = {
		name: (rawName as string).trim(),
		version: (rawVersion as string).trim(),
		title: (rawTitle as string).trim(),
		description: (rawDescription as string).trim(),
	};

	const rawAuthors = source.authors !== undefined ? source.authors : rawRoot?.authors;

	if (rawAuthors !== undefined) {
		if (typeof rawAuthors === "string") {
			metadata.authors = [rawAuthors.trim()];
		}
		else {
			assertStringArray(rawAuthors, "metadata.authors");
			metadata.authors = rawAuthors;
		}
	}

	const rawTags = source.tags !== undefined ? source.tags : rawRoot?.tags;

	if (rawTags !== undefined) {
		if (typeof rawTags === "string") {
			metadata.tags = [rawTags.trim()];
		}
		else {
			assertStringArray(rawTags, "metadata.tags");
			metadata.tags = rawTags;
		}
	}

	const rawFrom = source.from !== undefined ? source.from : rawRoot?.from;

	if (rawFrom !== undefined) {
		assertString(rawFrom, "metadata.from", true);
		metadata.from = (rawFrom as string).trim();
	}

	return metadata;
}

// Main TOML Parser

export function parseCharacterfile(tomlContent: string): Characterfile {
	if (typeof tomlContent !== "string" || tomlContent.trim() === "") {
		throw new Error("Characterfile TOML content cannot be empty.");
	}

	let raw: unknown;

	try {
		raw = parse(tomlContent);
	}
	catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse TOML: ${message}`, { cause: error });
	}

	assertObject(raw, "root");

	const rawRoot = raw as Record<string, unknown>;
	const metadata = parseCharacterfileMetadata(rawRoot.metadata, rawRoot);

	const rawSummary
		= rawRoot.summary !== undefined
			? rawRoot.summary
			: (rawRoot.metadata as Record<string, unknown>)?.summary !== undefined
					? (rawRoot.metadata as Record<string, unknown>).summary
					: "";

	assertString(rawSummary, "summary", true);
	const summary = rawSummary.trim();
	const rawSummaryLucky
		= rawRoot.summary_lucky !== undefined
			? rawRoot.summary_lucky
			: rawRoot.summaryLucky !== undefined
				? rawRoot.summaryLucky
				: (rawRoot.feeling_lucky as Record<string, unknown>)?.summary !== undefined
					? (rawRoot.feeling_lucky as Record<string, unknown>).summary
					: (rawRoot.metadata as Record<string, unknown>)?.summary_lucky;
	const summary_lucky = rawSummaryLucky !== undefined ? Boolean(rawSummaryLucky) : undefined;

	const parsedPhysical = parseNamedTraitList(rawRoot.physical_characteristics, "physical_characteristics");
	const physical_characteristics = ensureDefaultTraits(parsedPhysical, DEFAULT_PHYSICAL_TRAITS);

	const parsedLinguistic = parseNamedTraitList(rawRoot.linguistic_patterns, "linguistic_patterns");
	const linguistic_patterns = ensureDefaultTraits(parsedLinguistic, DEFAULT_LINGUISTIC_TRAITS);

	const psychology_and_worldviews = parseNamedTraitList(
		rawRoot.psychology_and_worldviews,
		"psychology_and_worldviews",
	);

	const lifestyle_and_preferences = parseNamedTraitList(
		rawRoot.lifestyle_and_preferences,
		"lifestyle_and_preferences",
	);

	const desires = parseNamedTraitList(rawRoot.desires, "desires");
	const skills = parseNamedTraitList(rawRoot.skills, "skills");

	const rawBackgrounds
		= rawRoot.backgrounds !== undefined
			? rawRoot.backgrounds
			: (rawRoot.metadata as Record<string, unknown>)?.backgrounds;

	const backgrounds = parseCharacterBackgrounds(rawBackgrounds);

	const example_dialogs = parseExampleDialogs(rawRoot.example_dialogs);

	let initial_states: CharacterStates = {};

	if (rawRoot.initial_states !== undefined && rawRoot.initial_states !== null) {
		initial_states = flattenStates(rawRoot.initial_states);
	}

	return {
		metadata,
		summary,
		...(summary_lucky !== undefined ? { summary_lucky } : {}),
		physical_characteristics,
		linguistic_patterns,
		psychology_and_worldviews,
		lifestyle_and_preferences,
		desires,
		skills,
		backgrounds,
		example_dialogs,
		initial_states,
	};
}

// Main TOML Serializer

export function serializeCharacterfile(characterfile: Characterfile): string {
	const doc: Record<string, unknown> = {};

	const metadataDoc: Record<string, unknown> = {
		name: characterfile.metadata.name,
		version: characterfile.metadata.version,
		title: characterfile.metadata.title,
		description: characterfile.metadata.description,
	};

	if (characterfile.metadata.authors && characterfile.metadata.authors.length > 0) {
		metadataDoc.authors = characterfile.metadata.authors;
	}

	if (characterfile.metadata.tags && characterfile.metadata.tags.length > 0) {
		metadataDoc.tags = characterfile.metadata.tags;
	}

	if (characterfile.metadata.from) {
		metadataDoc.from = characterfile.metadata.from;
	}

	doc.metadata = metadataDoc;
	if (characterfile.summary) {
		doc.summary = characterfile.summary;
	}
	if (characterfile.summary_lucky) {
		doc.summary_lucky = true;
	}

	if (characterfile.physical_characteristics && characterfile.physical_characteristics.length > 0) {
		doc.physical_characteristics = characterfile.physical_characteristics.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.linguistic_patterns && characterfile.linguistic_patterns.length > 0) {
		doc.linguistic_patterns = characterfile.linguistic_patterns.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.psychology_and_worldviews && characterfile.psychology_and_worldviews.length > 0) {
		doc.psychology_and_worldviews = characterfile.psychology_and_worldviews.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.lifestyle_and_preferences && characterfile.lifestyle_and_preferences.length > 0) {
		doc.lifestyle_and_preferences = characterfile.lifestyle_and_preferences.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.desires && characterfile.desires.length > 0) {
		doc.desires = characterfile.desires.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.skills && characterfile.skills.length > 0) {
		doc.skills = characterfile.skills.map(item => ({
			name: item.name,
			description: item.description,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.backgrounds && characterfile.backgrounds.length > 0) {
		doc.backgrounds = characterfile.backgrounds.map(item => ({
			name: item.name,
			content: item.content,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.example_dialogs && characterfile.example_dialogs.length > 0) {
		doc.example_dialogs = characterfile.example_dialogs.map(item => ({
			name: item.name,
			dialog: item.dialog,
			...(item.feelingLucky ? { feeling_lucky: true } : {}),
		}));
	}

	if (characterfile.initial_states && Object.keys(characterfile.initial_states).length > 0) {
		doc.initial_states = characterfile.initial_states;
	}

	return stringifyToml(doc);
}
