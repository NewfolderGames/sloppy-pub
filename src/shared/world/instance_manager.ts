import { UniverseCoordinator } from "../universe/coordinator.ts";
import { getAllUniverses, getUniverse, SAMPLE_UNIVERSEFILE, saveUniverse } from "../universe/registry.ts";
import { MessageTree } from "../ai/message/tree.ts";
import { MessageTreeManager } from "../ai/message/tree_manager.ts";
import type { SerializedMessageTree } from "../ai/message/types.ts";
import { preprocessFeelingLucky } from "../ai/feeling_lucky.ts";
import { getCharacterfile } from "../character/registry.ts";
import { CharacterStateStore } from "../character/state_store.ts";
import type { Characterfile, CharacterInstance } from "../character/types.ts";
import { assembleSystemPrompt, interpolateText } from "./builder.ts";
import { synthesizeLorePrompt } from "../lore/builder.ts";
import { getLoreBook } from "../lore/registry.ts";
import type { LoreBook } from "../lore/types.ts";
import { type DirectorState, initializeDirector } from "../session/director.ts";
import { getAllWorldfiles, getWorldfile, resolveVariantWorldfile, SAMPLE_WORLDFILE, saveWorldfile } from "./registry.ts";
import { StateStore } from "./state_store.ts";
import type { Universefile, VariableDefinition, Worldfile, WorldInstance } from "./types.ts";

export interface CreateInstanceInput {
	title?: string;
	worldId: string;
	universeId?: string;
	universeMode?: "isolated" | "synchronized";
	lorebookId?: string;
	lorebookIds?: string[];
	injectedVars?: Record<string, string | number | boolean>;
	characterIds?: string[];
	directorEnabled?: boolean;
	directorInstructions?: string;
	llmCall?: (prompt: string) => Promise<string>;
}

export interface InstanceSession {
	instance: WorldInstance;
	stateStore: StateStore;
	characterStore: CharacterStateStore;
	treeManager: MessageTreeManager;
	worldPrompt?: string;
	lorebookId?: string;
	lorebookIds?: string[];
	director: DirectorState;
	detach: () => void;
}

const STORAGE_KEY_INSTANCES = "roleplay:instances";
const STORAGE_KEY_ACTIVE_INSTANCE_ID = "roleplay:active_instance_id";

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

// Storage Operations

export function getAllInstances(): WorldInstance[] {

	const raw = getStorageItem(STORAGE_KEY_INSTANCES);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return (parsed as Record<string, unknown>[]).map((inst) => {
			if (!inst.worldId && typeof inst.worldImageId === "string") {
				inst.worldId = inst.worldImageId;
			}
			if (!Array.isArray(inst.events)) {
				inst.events = [];
			}
			if (!Array.isArray(inst.chapters)) {
				inst.chapters = [];
			}
			if (!inst.director) {
				inst.director = initializeDirector();
			}

			return inst as unknown as WorldInstance;
		});
	}
	catch {
		return [];
	}

}

export function getInstance(id: string): WorldInstance | undefined {

	const all = getAllInstances();
	const instance = all.find(item => item.id === id);

	if (instance) {
		if (!instance.worldId && (instance as unknown as Record<string, unknown>).worldImageId) {
			instance.worldId = (instance as unknown as Record<string, unknown>).worldImageId as string;
		}
		if (!Array.isArray(instance.events)) {
			instance.events = [];
		}
		if (!Array.isArray(instance.chapters)) {
			instance.chapters = [];
		}
		if (!instance.director) {
			instance.director = initializeDirector();
		}
	}

	return instance;

}

export function saveInstance(instance: WorldInstance): WorldInstance {

	const all = getAllInstances();
	const existingIndex = all.findIndex(item => item.id === instance.id);

	if (existingIndex >= 0) {
		all[existingIndex] = { ...instance, updatedAt: Date.now() };
	}
	else {
		all.unshift(instance);
	}

	setStorageItem(STORAGE_KEY_INSTANCES, JSON.stringify(all));

	return instance;

}

export function deleteInstance(id: string): boolean {

	const all = getAllInstances();
	const filtered = all.filter(item => item.id !== id);

	if (filtered.length === all.length) {
		return false;
	}

	setStorageItem(STORAGE_KEY_INSTANCES, JSON.stringify(filtered));

	const activeId = getActiveInstanceId();
	if (activeId === id) {
		const nextActive = filtered.length > 0 ? filtered[0].id : null;
		setActiveInstanceId(nextActive);
	}

	return true;

}

export function getActiveInstanceId(): string | null {

	return getStorageItem(STORAGE_KEY_ACTIVE_INSTANCE_ID);

}

export function setActiveInstanceId(id: string | null): void {

	if (id === null) {
		if (typeof window !== "undefined" && window.localStorage) {
			try {
				window.localStorage.removeItem(STORAGE_KEY_ACTIVE_INSTANCE_ID);
			}
			catch {
				// Fallback to memory
			}
		}
		memoryStorage.delete(STORAGE_KEY_ACTIVE_INSTANCE_ID);
		return;
	}

	setStorageItem(STORAGE_KEY_ACTIVE_INSTANCE_ID, id);

}

// Variable Validation & Resolution

export function validateAndResolveInstanceVars(
	varDefs: VariableDefinition[] = [],
	suppliedVars: Record<string, unknown> = {},
): Record<string, string | number | boolean> {

	const resolved: Record<string, string | number | boolean> = {};

	for (const v of varDefs) {
		let val = suppliedVars[v.name];

		if (val === undefined || val === null || val === "") {
			if (v.default !== undefined) {
				val = v.default;
			}
			else if (v.optional === true) {
				continue;
			}
			else {
				throw new Error(`Missing required runtime variable: "${v.name}".`);
			}
		}

		if (v.type === "number") {
			const num = typeof val === "number" ? val : Number(val);
			if (Number.isNaN(num)) {
				throw new Error(`Variable "${v.name}" must be a valid number.`);
			}
			if (v.format === "int" && !Number.isInteger(num)) {
				throw new Error(`Variable "${v.name}" must be an integer.`);
			}
			if (v.range) {
				const [minStr, maxStr] = v.range.split(",").map(s => s.trim());
				const min = minStr !== undefined && minStr !== "" ? Number(minStr) : -Infinity;
				const max = maxStr !== undefined && maxStr !== "" ? Number(maxStr) : Infinity;
				if (num < min || num > max) {
					throw new Error(`Variable "${v.name}" value ${num} is outside range ${v.range}.`);
				}
			}
			resolved[v.name] = num;
			continue;
		}

		if (v.type === "boolean") {
			if (typeof val === "boolean") {
				resolved[v.name] = val;
				continue;
			}
			if (val === "true" || val === "false") {
				resolved[v.name] = val === "true";
				continue;
			}
			throw new Error(`Variable "${v.name}" must be a boolean.`);
		}

		if (v.type === "select" || v.type === "radio" || v.type === "checkbox") {
			const str = String(val);
			if (v.values && v.values.length > 0 && !v.values.includes(str)) {
				throw new Error(
					`Variable "${v.name}" value "${str}" is not in allowed values: ${v.values.join(", ")}.`,
				);
			}
			resolved[v.name] = str;
			continue;
		}

		resolved[v.name] = String(val);
	}

	return resolved;

}

// System Prompt Synthesis

export function synthesizeInstancePrompt(
	worldfile: Worldfile,
	injectedVars: Record<string, string | number | boolean>,
	universe?: Universefile,
	lorebookId?: string | string[] | LoreBook[],
): string {

	const sections: string[] = [];
	const varsMap = new Map<string, string>();
	for (const [key, value] of Object.entries(injectedVars)) {
		varsMap.set(key, String(value));
	}

	const backgrounds: string[] = [];
	const rules: string[] = [];
	const guidelines: string[] = [];
	let universeTitle = "";

	// 1. Universe

	if (universe) {

		universeTitle = universe.metadata?.title || universe.metadata?.name || "Universe";
		(universe.settings?.backgrounds || []).forEach((bg) => {
			try {
				backgrounds.push(interpolateText(bg, varsMap));
			}
			catch {
				backgrounds.push(bg);
			}
		});
		universe.settings?.rules?.forEach((rule) => {
			try {
				rules.push(interpolateText(rule, varsMap));
			}
			catch {
				rules.push(rule);
			}
		});

	}

	// 2. World

	const rawBackgrounds: string[] = Array.isArray(worldfile.content.backgrounds)
		? worldfile.content.backgrounds
		: (worldfile.content.description ? [worldfile.content.description] : []);

	rawBackgrounds.forEach((bg) => {
		try {
			backgrounds.push(interpolateText(bg, varsMap));
		}
		catch {
			backgrounds.push(bg);
		}
	});

	if (worldfile.content.settings) {
		worldfile.content.settings.rules?.forEach((rule) => {
			try {
				rules.push(interpolateText(rule, varsMap));
			}
			catch {
				rules.push(rule);
			}
		});
		worldfile.content.settings.guidelines?.forEach((g) => {
			try {
				guidelines.push(interpolateText(g, varsMap));
			}
			catch {
				guidelines.push(g);
			}
		});
	}

	// Top-level content guidelines merge with settings.guidelines for backward compatibility
	const contentGuidelines: string[] = [];
	if (worldfile.content.guidelines) {
		worldfile.content.guidelines.forEach((g) => {
			try {
				contentGuidelines.push(interpolateText(g, varsMap));
			}
			catch {
				contentGuidelines.push(g);
			}
		});
	}

	const basePrompt = assembleSystemPrompt(
		[universeTitle, worldfile.metadata.title].join(" : "),
		backgrounds,
		rules,
		guidelines,
		contentGuidelines,
	);

	sections.push(basePrompt);

	// 3. Injected Runtime Variables Section

	if (Object.keys(injectedVars).length > 0) {
		const varLines = Object.entries(injectedVars)
			.map(([k, v]) => `- ${k}: ${String(v)}`)
			.join("\n");
		sections.push(`Active Session Variables:\n${varLines}`);
	}

	// 4. Static Lore Section
	if (lorebookId) {
		const staticLore = synthesizeLorePrompt(lorebookId);

		if (staticLore.trim().length > 0) {
			sections.push(staticLore);
		}
	}

	return sections.join("\n\n");

}

// Instance Creation

function buildInstanceFromAssets(
	input: CreateInstanceInput,
	worldfile: Worldfile,
	universe?: Universefile,
	characters?: Characterfile[],
	lorebooks?: LoreBook[],
): WorldInstance {

	const injectedVars = validateAndResolveInstanceVars(worldfile.vars, input.injectedVars);
	const universeMode = input.universeMode ?? (input.universeId ? "isolated" : "isolated");

	const instanceId = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	const title = input.title?.trim() || `${worldfile.metadata.title} Session`;

	// Initialize state store & attach universe to obtain full initial states
	const initialStatesRecord: Record<string, any> = worldfile.states ? { ...worldfile.states } : {};
	const stateStore = new StateStore(initialStatesRecord, worldfile.blueprints);

	if (input.universeId && universe) {
		const coordinator = UniverseCoordinator.getInstance();
		coordinator.registerUniverse(input.universeId, {
			initialStates: universe.states,
			rules: universe.settings?.rules,
			backgrounds: universe.settings?.backgrounds,
		});

		stateStore.attachUniverse({
			coordinator,
			universeId: input.universeId,
			mode: universeMode,
			instanceId,
		});
	}

	const initialStates = stateStore.getAllStates();

	const effectiveLorebookIds = input.lorebookIds ?? (input.lorebookId ? [input.lorebookId] : []);
	const effectiveLorebookId = input.lorebookId ?? (effectiveLorebookIds.length > 0 ? effectiveLorebookIds[0] : undefined);

	// Synthesize initial prompt for instance prompt assembly
	const initialPrompt = synthesizeInstancePrompt(
		worldfile,
		injectedVars,
		universe,
		lorebooks && lorebooks.length > 0 ? lorebooks : effectiveLorebookIds.length > 0 ? effectiveLorebookIds : input.lorebookId,
	);
	const treeManager = new MessageTreeManager();

	stateStore.detachUniverse();

	const uniqueCharacterIds = Array.from(new Set(input.characterIds || []));
	const characterInstances: CharacterInstance[] = [];

	if (characters && characters.length > 0) {
		for (let i = 0; i < characters.length; i++) {
			const charFile = characters[i];
			const charId = uniqueCharacterIds[i] || charFile.metadata.name;
			const initialStatesCopy: Record<string, any> = {};
			if (charFile.initial_states) {
				for (const [k, v] of Object.entries(charFile.initial_states)) {
					initialStatesCopy[k] = Array.isArray(v) ? [...v] : v;
				}
			}

			characterInstances.push({
				id: `char_inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				characterId: charFile.metadata.name || charId,
				name: charFile.metadata.title || charFile.metadata.name,
				thoughts: [],
				emotions: [],
				goals: [],
				states: initialStatesCopy,
			});
		}
	}
	else {
		for (const charId of uniqueCharacterIds) {
			const charRecord = getCharacterfile(charId);
			if (charRecord) {
				const initialStatesCopy: Record<string, any> = {};
				if (charRecord.characterfile.initial_states) {
					for (const [k, v] of Object.entries(charRecord.characterfile.initial_states)) {
						initialStatesCopy[k] = Array.isArray(v) ? [...v] : v;
					}
				}

				characterInstances.push({
					id: `char_inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					characterId: charRecord.characterfile.metadata.name || charId,
					name: charRecord.characterfile.metadata.title || charRecord.characterfile.metadata.name,
					thoughts: [],
					emotions: [],
					goals: [],
					states: initialStatesCopy,
				});
			}
		}
	}

	const now = Date.now();
	const instance: WorldInstance = {
		id: instanceId,
		title,
		worldId: input.worldId,
		universeId: input.universeId,
		universeMode,
		lorebookId: effectiveLorebookId,
		lorebookIds: effectiveLorebookIds,
		injectedVars,
		worldPrompt: initialPrompt,
		messageTreeData: treeManager.toJSON(),
		activeStates: initialStates,
		blueprints: worldfile.blueprints,
		characterIds: uniqueCharacterIds,
		characterInstances,
		events: [],
		chapters: [],
		director: initializeDirector({
			enabled: input.directorEnabled ?? false,
			instructions: input.directorInstructions,
		}),
		compacted: false,
		isCompacted: false,
		createdAt: now,
		updatedAt: now,
	};

	saveInstance(instance);

	return instance;

}

export function createWorldInstanceSync(input: CreateInstanceInput): WorldInstance {

	const worldRecord = getWorldfile(input.worldId);
	if (!worldRecord) {
		throw new Error(`Worldfile "${input.worldId}" not found.`);
	}

	const worldfile = resolveVariantWorldfile(input.worldId) ?? worldRecord.worldfile;

	let universe: Universefile | undefined;
	if (input.universeId) {
		const universeRecord = getUniverse(input.universeId);
		if (!universeRecord) {
			throw new Error(`Universe "${input.universeId}" not found.`);
		}
		universe = universeRecord.universe;
	}

	const uniqueCharacterIds = Array.from(new Set(input.characterIds || []));
	const characters: Characterfile[] = [];
	for (const charId of uniqueCharacterIds) {
		const rec = getCharacterfile(charId);
		if (rec) {
			characters.push(rec.characterfile);
		}
	}

	const effectiveLorebookIds = input.lorebookIds ?? (input.lorebookId ? [input.lorebookId] : []);
	const lorebooks: LoreBook[] = [];
	for (const lbId of effectiveLorebookIds) {
		const rec = getLoreBook(lbId);
		if (rec) {
			lorebooks.push(rec.lorebook);
		}
	}

	return buildInstanceFromAssets(input, worldfile, universe, characters, lorebooks);

}

export async function createWorldInstance(input: CreateInstanceInput): Promise<WorldInstance> {

	const worldRecord = getWorldfile(input.worldId);
	if (!worldRecord) {
		throw new Error(`Worldfile "${input.worldId}" not found.`);
	}

	const worldfile = resolveVariantWorldfile(input.worldId) ?? worldRecord.worldfile;

	let universe: Universefile | undefined;
	if (input.universeId) {
		const universeRecord = getUniverse(input.universeId);
		if (!universeRecord) {
			throw new Error(`Universe "${input.universeId}" not found.`);
		}
		universe = universeRecord.universe;
	}

	const uniqueCharacterIds = Array.from(new Set(input.characterIds || []));
	const characters: Characterfile[] = [];
	for (const charId of uniqueCharacterIds) {
		const rec = getCharacterfile(charId);
		if (rec) {
			characters.push(rec.characterfile);
		}
	}

	const effectiveLorebookIds = input.lorebookIds ?? (input.lorebookId ? [input.lorebookId] : []);
	const lorebooks: LoreBook[] = [];
	for (const lbId of effectiveLorebookIds) {
		const rec = getLoreBook(lbId);
		if (rec) {
			lorebooks.push(rec.lorebook);
		}
	}

	const preprocessed = await preprocessFeelingLucky({
		worldfile,
		universe,
		characters: characters.length > 0 ? characters : undefined,
		lorebooks: lorebooks.length > 0 ? lorebooks : undefined,
		llmCall: input.llmCall,
	});

	return buildInstanceFromAssets(
		input,
		preprocessed.worldfile,
		preprocessed.universe,
		preprocessed.characters,
		preprocessed.lorebooks,
	);

}

// Default Seeding

export function ensureDefaultInstance(): WorldInstance {

	const existing = getAllInstances();
	if (existing.length > 0) {
		const activeId = getActiveInstanceId();
		if (activeId) {
			const active = existing.find(item => item.id === activeId);
			if (active) {
				return active;
			}
		}

		setActiveInstanceId(existing[0].id);

		return existing[0];
	}

	// Ensure Worldfile exists
	const worldfiles = getAllWorldfiles();
	let targetWorldRecord = worldfiles[0];
	if (!targetWorldRecord) {
		targetWorldRecord = saveWorldfile(SAMPLE_WORLDFILE);
	}

	// Ensure Universe exists
	const universes = getAllUniverses();
	let targetUniverseId: string | undefined = universes[0]?.id;
	if (!targetUniverseId) {
		const savedU = saveUniverse(SAMPLE_UNIVERSEFILE);
		targetUniverseId = savedU.id;
	}

	const newInstance = createWorldInstanceSync({
		title: "Neon Syndicate Alpha",
		worldId: targetWorldRecord.id,
		universeId: targetUniverseId,
		universeMode: "synchronized",
		injectedVars: {
			PLAYER_NAME: "V",
			PLAYER_ROLE: "netrunner",
			STARTING_CREDITS: 1500,
		},
	});

	setActiveInstanceId(newInstance.id);

	return newInstance;
}

// Session Activation

export function createInstanceSession(
	instance: WorldInstance,
	coordinator: UniverseCoordinator = UniverseCoordinator.getInstance(),
): InstanceSession {

	const stateStore = new StateStore(instance.activeStates, instance.blueprints);

	if (instance.universeId) {
		const universeRecord = getUniverse(instance.universeId);
		if (universeRecord) {
			coordinator.registerUniverse(instance.universeId, {
				initialStates: universeRecord.universe.states,
				rules: universeRecord.universe.settings?.rules,
				backgrounds: universeRecord.universe.settings?.backgrounds,
			});
		}

		stateStore.attachUniverse({
			coordinator,
			universeId: instance.universeId,
			mode: instance.universeMode,
			instanceId: instance.id,
		});
	}

	let tree: MessageTree;
	if (instance.messageTreeData) {
		try {
			tree = MessageTree.fromJSON(instance.messageTreeData as SerializedMessageTree);
		}
		catch {
			tree = new MessageTree();
		}
	}
	else {
		tree = new MessageTree();
	}

	let worldPrompt = instance.worldPrompt;

	const effectiveLorebookIds = instance.lorebookIds ?? (instance.lorebookId ? [instance.lorebookId] : []);

	if (!worldPrompt) {
		const worldRecord = getWorldfile(instance.worldId);
		if (worldRecord) {
			const universeRecord = instance.universeId ? getUniverse(instance.universeId) : undefined;
			worldPrompt = synthesizeInstancePrompt(
				worldRecord.worldfile,
				instance.injectedVars,
				universeRecord?.universe,
				effectiveLorebookIds.length > 0 ? effectiveLorebookIds : instance.lorebookId,
			);
			instance.worldPrompt = worldPrompt;
			saveInstance(instance);
		}
	}

	// Legacy migration: if the tree root message was the initial world prompt, remove it from the tree
	const rootIds = tree.getRootIds();
	if (rootIds.length === 1 && worldPrompt) {
		const rootNode = tree.getNode(rootIds[0]);
		if (rootNode && rootNode.message.data.role === "system" && rootNode.message.data.content === worldPrompt) {
			tree.removeNodeAndPromoteChildren(rootNode.id);
			instance.messageTreeData = tree.toJSON();
			saveInstance(instance);
		}
	}

	const treeManager = new MessageTreeManager(tree);
	const characterStore = new CharacterStateStore(instance.characterInstances || []);
	const directorState = initializeDirector(instance.director);
	instance.director = directorState;

	// Persist state updates
	const unsubscribeState = stateStore.subscribe(() => {
		instance.activeStates = stateStore.getAllStates();
		saveInstance(instance);
	});

	// Persist character updates
	const unsubscribeCharacter = characterStore.subscribe((updatedInstances) => {
		instance.characterInstances = updatedInstances;
		saveInstance(instance);
	});

	// Persist tree updates
	const unsubscribeTree = treeManager.subscribe(() => {
		instance.messageTreeData = treeManager.toJSON();
		saveInstance(instance);
	});

	const detach = () => {
		unsubscribeState();
		unsubscribeTree();
		unsubscribeCharacter();
		stateStore.detachUniverse();
	};

	return {
		instance,
		stateStore,
		characterStore,
		treeManager,
		worldPrompt,
		lorebookId: instance.lorebookId,
		lorebookIds: effectiveLorebookIds,
		director: directorState,
		detach,
	};

}
