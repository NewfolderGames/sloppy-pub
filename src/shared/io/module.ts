import { getCharacterfile, saveCharacterfile } from "../character/registry.ts";
import { parseCharacterfile, serializeCharacterfile } from "../character/toml.ts";
import { getLoreBook, saveLoreBook } from "../lore/registry.ts";
import { parseLorebook, serializeLorebook } from "../lore/toml.ts";
import { getUniverse, saveUniverse } from "../universe/registry.ts";
import { getWorldfile, saveWorldfile } from "../world/registry.ts";
import { parseUniversefile, parseWorldfile, serializeUniversefile, serializeWorldfile } from "../world/toml.ts";
import { createZip, readZip, type ZipEntry } from "./zip.ts";

export interface ModuleAssetIds {
	worldIds?: string[];
	universeIds?: string[];
	characterIds?: string[];
	lorebookIds?: string[];
}

export interface ModuleMetadata {
	id?: string;
	title?: string;
	description?: string;
	version?: string;
	author?: string;
}

export interface ModuleConflictItem {
	type: "world" | "universe" | "character" | "lore";
	id: string;
	name: string;
}

export interface ModuleImportResult {
	success: boolean;
	imported: {
		worldIds: string[];
		universeIds: string[];
		characterIds: string[];
		lorebookIds: string[];
	};
	conflicts: ModuleConflictItem[];
	errors: string[];
}

export interface ImportModuleOptions {
	overwrite?: boolean;
}

export function downloadBlob(blob: Blob, filename: string): void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return;
	}

	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export async function exportModule(
	assetIds: ModuleAssetIds,
	metadata?: ModuleMetadata,
): Promise<Blob> {
	const entries: ZipEntry[] = [];
	const encoder = new TextEncoder();

	const worldIds = assetIds.worldIds ?? [];
	const universeIds = assetIds.universeIds ?? [];
	const characterIds = assetIds.characterIds ?? [];
	const lorebookIds = assetIds.lorebookIds ?? [];

	// Export Worldfiles
	const exportedWorldIds: string[] = [];
	for (const id of worldIds) {
		const record = getWorldfile(id);
		if (record) {
			const tomlStr = serializeWorldfile(record.worldfile);
			const filename = `${record.worldfile.metadata.name || id}.worldfile.toml`;
			entries.push({
				path: `module/world/${filename}`,
				data: encoder.encode(tomlStr),
			});
			exportedWorldIds.push(id);
		}
	}

	// Export Universefiles
	const exportedUniverseIds: string[] = [];
	for (const id of universeIds) {
		const record = getUniverse(id);
		if (record) {
			const tomlStr = serializeUniversefile(record.universe);
			const filename = `${record.universe.metadata.name || id}.universefile.toml`;
			entries.push({
				path: `module/universe/${filename}`,
				data: encoder.encode(tomlStr),
			});
			exportedUniverseIds.push(id);
		}
	}

	// Export Characterfiles
	const exportedCharacterIds: string[] = [];
	for (const id of characterIds) {
		const record = getCharacterfile(id);
		if (record) {
			const tomlStr = serializeCharacterfile(record.characterfile);
			const filename = `${record.characterfile.metadata.name || id}.characterfile.toml`;
			entries.push({
				path: `module/character/${filename}`,
				data: encoder.encode(tomlStr),
			});
			exportedCharacterIds.push(id);
		}
	}

	// Export Lorebooks
	const exportedLorebookIds: string[] = [];
	for (const id of lorebookIds) {
		const record = getLoreBook(id);
		if (record) {
			const tomlStr = serializeLorebook(record.lorebook);
			const filename = `${record.lorebook.name || id}.lorefile.toml`;
			entries.push({
				path: `module/lore/${filename}`,
				data: encoder.encode(tomlStr),
			});
			exportedLorebookIds.push(id);
		}
	}

	// Create module.toml manifest
	const moduleId = metadata?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mod_${Date.now()}`);
	const moduleTitle = metadata?.title || "Module Package";
	const moduleDesc = metadata?.description || "Packaged AI Roleplay assets";
	const moduleVer = metadata?.version || "1.0.0";
	const moduleAuthor = metadata?.author || "";

	const manifestToml = [
		`[module]`,
		`id = ${JSON.stringify(moduleId)}`,
		`title = ${JSON.stringify(moduleTitle)}`,
		`description = ${JSON.stringify(moduleDesc)}`,
		`version = ${JSON.stringify(moduleVer)}`,
		moduleAuthor ? `author = ${JSON.stringify(moduleAuthor)}` : "",
		"",
		`[assets]`,
		`worlds = ${JSON.stringify(exportedWorldIds)}`,
		`universes = ${JSON.stringify(exportedUniverseIds)}`,
		`characters = ${JSON.stringify(exportedCharacterIds)}`,
		`lorebooks = ${JSON.stringify(exportedLorebookIds)}`,
		"",
	].filter(line => line !== null && line !== undefined).join("\n");

	entries.unshift({
		path: "module/module.toml",
		data: encoder.encode(manifestToml),
	});

	const zipBytes = await createZip(entries);

	return new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
}

export async function importModule(
	source: Blob | Uint8Array,
	options?: ImportModuleOptions,
): Promise<ModuleImportResult> {
	let bytes: Uint8Array;
	if (source instanceof Uint8Array) {
		bytes = source;
	}
	else if (typeof (source as any).bytes === "function") {
		bytes = await (source as any).bytes();
	}
	else {
		const buffer = await source.arrayBuffer();
		bytes = new Uint8Array(buffer);
	}

	const overwrite = Boolean(options?.overwrite);
	const decoder = new TextDecoder("utf-8");

	const result: ModuleImportResult = {
		success: true,
		imported: {
			worldIds: [],
			universeIds: [],
			characterIds: [],
			lorebookIds: [],
		},
		conflicts: [],
		errors: [],
	};

	let entries: ZipEntry[];
	try {
		entries = await readZip(bytes);
	}
	catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		result.success = false;
		result.errors.push(`Failed to read ZIP archive: ${msg}`);
		return result;
	}

	for (const entry of entries) {
		// Normalize path
		const normPath = entry.path.replace(/^\/+/, "").replace(/^module\//, "");

		try {
			const text = decoder.decode(entry.data);

			// Check worldfile
			if (normPath.startsWith("world/") || normPath.endsWith(".worldfile.toml")) {
				const worldfile = parseWorldfile(text);
				const targetId = worldfile.metadata.name;
				const existing = getWorldfile(targetId);

				if (existing && !overwrite) {
					result.conflicts.push({
						type: "world",
						id: targetId,
						name: worldfile.metadata.title || worldfile.metadata.name,
					});
				}
				else {
					saveWorldfile(worldfile, targetId);
					result.imported.worldIds.push(targetId);
				}
			}
			// Check universefile
			else if (normPath.startsWith("universe/") || normPath.endsWith(".universefile.toml")) {
				const universefile = parseUniversefile(text);
				const targetId = universefile.metadata.name;
				const existing = getUniverse(targetId);

				if (existing && !overwrite) {
					result.conflicts.push({
						type: "universe",
						id: targetId,
						name: universefile.metadata.title || universefile.metadata.name,
					});
				}
				else {
					saveUniverse(universefile, targetId);
					result.imported.universeIds.push(targetId);
				}
			}
			// Check characterfile
			else if (normPath.startsWith("character/") || normPath.endsWith(".characterfile.toml")) {
				const characterfile = parseCharacterfile(text);
				const targetId = characterfile.metadata.name;
				const existing = getCharacterfile(targetId);

				if (existing && !overwrite) {
					result.conflicts.push({
						type: "character",
						id: targetId,
						name: characterfile.metadata.name,
					});
				}
				else {
					saveCharacterfile(characterfile, targetId);
					result.imported.characterIds.push(targetId);
				}
			}
			// Check lorefile
			else if (normPath.startsWith("lore/") || normPath.endsWith(".lorefile.toml")) {
				const lorebook = parseLorebook(text);
				const targetId = lorebook.id;
				const existing = getLoreBook(targetId);

				if (existing && !overwrite) {
					result.conflicts.push({
						type: "lore",
						id: targetId,
						name: lorebook.name,
					});
				}
				else {
					saveLoreBook(lorebook);
					result.imported.lorebookIds.push(targetId);
				}
			}
		}
		catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			result.errors.push(`Error parsing ${entry.path}: ${msg}`);
		}
	}

	if (result.conflicts.length > 0) {
		result.success = false;
	}

	return result;
}
