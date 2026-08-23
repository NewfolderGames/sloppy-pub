import {
	DEFAULT_PROMPT_SETTINGS,
	isSystemPromptId,
	SYSTEM_PROMPT_DEFINITIONS,
	SYSTEM_PROMPT_IDS,
} from "./prompt_definitions.ts";
import type { PromptSettings, SystemPromptId, SystemPromptItem, UserPromptItem } from "./types.ts";

export {
	APP_PROMPT,
	DEFAULT_PROMPT_SETTINGS,
	isSystemPromptId,
	SYSTEM_PROMPT_DEFINITIONS,
	SYSTEM_PROMPT_IDS,
} from "./prompt_definitions.ts";

export {
	formatChaptersSummaryPrompt,
	formatSessionEventsPrompt,
	formatSessionStatesPrompt,
} from "./prompt_formatters.ts";

export { assembleChatPromptMessages } from "./prompt_assembler.ts";

// Storage Access

const STORAGE_KEY_PROMPT_SETTINGS = "roleplay:prompt_settings";

const memoryStorage = new Map<string, string>();

const listeners = new Set<() => void>();

let cachedSnapshot: PromptSettings | null = null;

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
			// Fallback to memory storage
		}
	}

	memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {

	if (typeof window !== "undefined" && window.localStorage) {
		try {
			window.localStorage.removeItem(key);
			return;
		}
		catch {
			// Fallback to memory storage
		}
	}

	memoryStorage.delete(key);
}

// Helpers

function clonePromptSettings(settings: PromptSettings): PromptSettings {

	const userPrompts: Record<string, UserPromptItem> = {};

	for (const [key, item] of Object.entries(settings.userPrompts)) {
		userPrompts[key] = {
			id: item.id,
			name: item.name,
			description: item.description,
			content: item.content,
			enabled: item.enabled,
			role: item.role ?? "user",
		};
	}

	const systemPrompts: Record<SystemPromptId, { enabled: boolean; role?: "system" | "user" }> = {
		"system:app_prompt": {
			enabled: settings.systemPrompts?.["system:app_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:app_prompt"]?.role ?? "system",
		},
		"system:world_prompt": {
			enabled: settings.systemPrompts?.["system:world_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:world_prompt"]?.role ?? "system",
		},
		"system:character_prompt": {
			enabled: settings.systemPrompts?.["system:character_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:character_prompt"]?.role ?? "system",
		},
		"system:chapters_summary": {
			enabled: settings.systemPrompts?.["system:chapters_summary"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:chapters_summary"]?.role ?? "system",
		},
		"system:director_prompt": {
			enabled: settings.systemPrompts?.["system:director_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:director_prompt"]?.role ?? "system",
		},
		"system:chat_history": {
			enabled: settings.systemPrompts?.["system:chat_history"]?.enabled ?? true,
		},
		"system:world_states": {
			enabled: settings.systemPrompts?.["system:world_states"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:world_states"]?.role ?? "user",
		},
		"system:character_instances": {
			enabled: settings.systemPrompts?.["system:character_instances"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:character_instances"]?.role ?? "user",
		},
		"system:lore_prompt": {
			enabled: settings.systemPrompts?.["system:lore_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:lore_prompt"]?.role ?? "user",
		},
		"system:session_events": {
			enabled: settings.systemPrompts?.["system:session_events"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:session_events"]?.role ?? "user",
		},
		"system:wizard_prompt": {
			enabled: settings.systemPrompts?.["system:wizard_prompt"]?.enabled ?? true,
			role: settings.systemPrompts?.["system:wizard_prompt"]?.role ?? "system",
		},
	};

	return {
		order: [...settings.order],
		userPrompts,
		systemPrompts,
	};
}

function sanitizeUserPromptItem(item: unknown): UserPromptItem | null {

	if (typeof item !== "object" || item === null) {
		return null;
	}

	const candidate = item as Record<string, unknown>;

	if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
		return null;
	}

	return {
		id: candidate.id,
		name: typeof candidate.name === "string" ? candidate.name : "",
		description: typeof candidate.description === "string" ? candidate.description : "",
		content: typeof candidate.content === "string" ? candidate.content : "",
		enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
		role: candidate.role === "system" || candidate.role === "user" ? candidate.role : "user",
	};
}

function migrateLegacyPromptSettings(candidate: Record<string, unknown>): PromptSettings {

	const userPrompts: Record<string, UserPromptItem> = {};
	const order: string[] = [];
	const seen = new Set<string>();

	const systemPrompts: Record<SystemPromptId, { enabled: boolean; role?: "system" | "user" }> = {
		"system:app_prompt": { enabled: true, role: "system" },
		"system:world_prompt": { enabled: true, role: "system" },
		"system:character_prompt": { enabled: true, role: "system" },
		"system:chapters_summary": { enabled: true, role: "system" },
		"system:director_prompt": { enabled: true, role: "system" },
		"system:chat_history": { enabled: true },
		"system:world_states": { enabled: true, role: "user" },
		"system:character_instances": { enabled: true, role: "user" },
		"system:lore_prompt": { enabled: true, role: "user" },
		"system:session_events": { enabled: true, role: "user" },
		"system:wizard_prompt": { enabled: true, role: "system" },
	};

	const processLegacyList = (items: unknown) => {
		if (!Array.isArray(items)) {
			return;
		}

		for (const rawItem of items) {
			const item = sanitizeUserPromptItem(rawItem);

			if (!item) {
				continue;
			}

			if (item.id === "default-response-formatting") {
				systemPrompts["system:app_prompt"] = {
					enabled: item.enabled,
					role: item.role === "user" ? "user" : "system",
				};

				if (!seen.has("system:app_prompt")) {
					seen.add("system:app_prompt");
					order.push("system:app_prompt");
				}

				continue;
			}

			if (isSystemPromptId(item.id)) {
				if (!seen.has(item.id)) {
					seen.add(item.id);
					order.push(item.id);
				}

				continue;
			}

			userPrompts[item.id] = item;

			if (!seen.has(item.id)) {
				seen.add(item.id);
				order.push(item.id);
			}
		}
	};

	// 1. World prompt
	if (!seen.has("system:world_prompt")) {
		seen.add("system:world_prompt");
		order.push("system:world_prompt");
	}

	// Character prompt
	if (!seen.has("system:character_prompt")) {
		seen.add("system:character_prompt");
		order.push("system:character_prompt");
	}

	// Chapters summary
	if (!seen.has("system:chapters_summary")) {
		seen.add("system:chapters_summary");
		order.push("system:chapters_summary");
	}

	// 2. Before prompts
	processLegacyList(candidate.before);

	// 3. Chat history
	if (!seen.has("system:chat_history")) {
		seen.add("system:chat_history");
		order.push("system:chat_history");
	}

	// 4. World states
	if (!seen.has("system:world_states")) {
		seen.add("system:world_states");
		order.push("system:world_states");
	}

	// Character instances
	if (!seen.has("system:character_instances")) {
		seen.add("system:character_instances");
		order.push("system:character_instances");
	}

	// Lore prompt
	if (!seen.has("system:lore_prompt")) {
		seen.add("system:lore_prompt");
		order.push("system:lore_prompt");
	}

	// Session events
	if (!seen.has("system:session_events")) {
		seen.add("system:session_events");
		order.push("system:session_events");
	}

	// Wizard prompt
	if (!seen.has("system:wizard_prompt")) {
		seen.add("system:wizard_prompt");
		order.push("system:wizard_prompt");
	}

	// 5. After prompts
	processLegacyList(candidate.after);

	// 6. App prompt
	if (!seen.has("system:app_prompt")) {
		seen.add("system:app_prompt");
		order.push("system:app_prompt");
	}

	// 7. General prompts
	processLegacyList(candidate.general);

	return {
		order,
		userPrompts,
		systemPrompts,
	};
}

function sanitizePromptSettings(data: unknown): PromptSettings {

	if (typeof data !== "object" || data === null) {
		return clonePromptSettings(DEFAULT_PROMPT_SETTINGS);
	}

	const candidate = data as Record<string, unknown>;

	const hasLegacySections
		= Array.isArray(candidate.before)
			|| Array.isArray(candidate.after)
			|| Array.isArray(candidate.general);

	if (hasLegacySections && !Array.isArray(candidate.order)) {
		return migrateLegacyPromptSettings(candidate);
	}

	if (!Array.isArray(candidate.order)) {
		return clonePromptSettings(DEFAULT_PROMPT_SETTINGS);
	}

	const userPrompts: Record<string, UserPromptItem> = {};

	if (typeof candidate.userPrompts === "object" && candidate.userPrompts !== null) {
		const rawUserPrompts = candidate.userPrompts as Record<string, unknown>;

		for (const [key, rawItem] of Object.entries(rawUserPrompts)) {
			if (isSystemPromptId(key)) {
				continue;
			}

			const sanitized = sanitizeUserPromptItem(rawItem);

			if (sanitized && !isSystemPromptId(sanitized.id)) {
				userPrompts[sanitized.id] = sanitized;
			}
		}
	}

	const rawSystemPrompts = typeof candidate.systemPrompts === "object" && candidate.systemPrompts !== null
		? candidate.systemPrompts as Record<string, unknown>
		: {};

	const parseRole = (role: unknown, defaultRole: "system" | "user"): "system" | "user" => {
		return role === "system" || role === "user" ? role : defaultRole;
	};

	const rawWorldPrompt = rawSystemPrompts["system:world_prompt"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawAppPrompt = rawSystemPrompts["system:app_prompt"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawCharacterPrompt = rawSystemPrompts["system:character_prompt"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawChaptersSummary = rawSystemPrompts["system:chapters_summary"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawDirectorPrompt = rawSystemPrompts["system:director_prompt"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawChatHistory = rawSystemPrompts["system:chat_history"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawWorldStates = rawSystemPrompts["system:world_states"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawCharacterInstances = rawSystemPrompts["system:character_instances"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawLorePrompt = rawSystemPrompts["system:lore_prompt"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawSessionEvents = rawSystemPrompts["system:session_events"] as { enabled?: unknown; role?: unknown } | undefined;
	const rawWizardPrompt = rawSystemPrompts["system:wizard_prompt"] as { enabled?: unknown; role?: unknown } | undefined;

	const systemPrompts: Record<SystemPromptId, { enabled: boolean; role?: "system" | "user" }> = {
		"system:app_prompt": {
			enabled: typeof rawAppPrompt?.enabled === "boolean" ? rawAppPrompt.enabled : true,
			role: parseRole(rawAppPrompt?.role, "system"),
		},
		"system:world_prompt": {
			enabled: typeof rawWorldPrompt?.enabled === "boolean" ? rawWorldPrompt.enabled : true,
			role: parseRole(rawWorldPrompt?.role, "system"),
		},
		"system:character_prompt": {
			enabled: typeof rawCharacterPrompt?.enabled === "boolean" ? rawCharacterPrompt.enabled : true,
			role: parseRole(rawCharacterPrompt?.role, "system"),
		},
		"system:chapters_summary": {
			enabled: typeof rawChaptersSummary?.enabled === "boolean" ? rawChaptersSummary.enabled : true,
			role: parseRole(rawChaptersSummary?.role, "system"),
		},
		"system:director_prompt": {
			enabled: typeof rawDirectorPrompt?.enabled === "boolean" ? rawDirectorPrompt.enabled : true,
			role: parseRole(rawDirectorPrompt?.role, "system"),
		},
		"system:chat_history": {
			enabled: typeof rawChatHistory?.enabled === "boolean" ? rawChatHistory.enabled : true,
		},
		"system:world_states": {
			enabled: typeof rawWorldStates?.enabled === "boolean" ? rawWorldStates.enabled : true,
			role: parseRole(rawWorldStates?.role, "user"),
		},
		"system:character_instances": {
			enabled: typeof rawCharacterInstances?.enabled === "boolean" ? rawCharacterInstances.enabled : true,
			role: parseRole(rawCharacterInstances?.role, "user"),
		},
		"system:lore_prompt": {
			enabled: typeof rawLorePrompt?.enabled === "boolean" ? rawLorePrompt.enabled : true,
			role: parseRole(rawLorePrompt?.role, "user"),
		},
		"system:session_events": {
			enabled: typeof rawSessionEvents?.enabled === "boolean" ? rawSessionEvents.enabled : true,
			role: parseRole(rawSessionEvents?.role, "user"),
		},
		"system:wizard_prompt": {
			enabled: typeof rawWizardPrompt?.enabled === "boolean" ? rawWizardPrompt.enabled : true,
			role: parseRole(rawWizardPrompt?.role, "system"),
		},
	};

	const order: string[] = [];
	const seen = new Set<string>();

	for (const rawId of candidate.order) {
		if (typeof rawId !== "string" || seen.has(rawId)) {
			continue;
		}

		if (isSystemPromptId(rawId)) {
			seen.add(rawId);
			order.push(rawId);
			continue;
		}

		if (rawId in userPrompts) {
			seen.add(rawId);
			order.push(rawId);
			continue;
		}
	}

	for (const id of Object.keys(userPrompts)) {
		if (!seen.has(id)) {
			seen.add(id);
			order.push(id);
		}
	}

	for (const systemId of SYSTEM_PROMPT_IDS) {
		if (!seen.has(systemId)) {
			seen.add(systemId);
			order.push(systemId);
		}
	}

	return {
		order,
		userPrompts,
		systemPrompts,
	};
}

function notifyListeners(): void {

	for (const listener of listeners) {
		listener();
	}
}

function generatePromptId(): string {

	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 9);

	return `prompt_${timestamp}_${randomSuffix}`;
}

// Registry Operations

export function subscribePromptSettings(listener: () => void): () => void {

	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

export function getPromptSettings(): PromptSettings {

	const rawData = getStorageItem(STORAGE_KEY_PROMPT_SETTINGS);

	if (rawData === null) {
		return clonePromptSettings(DEFAULT_PROMPT_SETTINGS);
	}

	try {
		const parsed = JSON.parse(rawData);

		return sanitizePromptSettings(parsed);
	}
	catch {
		return clonePromptSettings(DEFAULT_PROMPT_SETTINGS);
	}
}

export function getPromptSettingsSnapshot(): PromptSettings {

	if (cachedSnapshot === null) {
		cachedSnapshot = getPromptSettings();
	}

	return cachedSnapshot;
}

export function savePromptSettings(settings: PromptSettings): void {

	const sanitized = sanitizePromptSettings(settings);
	const serialized = JSON.stringify(sanitized);

	cachedSnapshot = sanitized;

	setStorageItem(STORAGE_KEY_PROMPT_SETTINGS, serialized);

	notifyListeners();
}

export function getSystemPromptItem(
	id: SystemPromptId,
	settings?: PromptSettings,
): SystemPromptItem | null {

	if (!isSystemPromptId(id)) {
		return null;
	}

	const def = SYSTEM_PROMPT_DEFINITIONS[id];
	const currentSettings = settings ?? getPromptSettings();
	const entry = currentSettings.systemPrompts[id];

	return {
		id,
		name: def.name,
		description: def.description,
		enabled: entry?.enabled ?? true,
		...(entry?.role ? { role: entry.role } : {}),
	};
}

export function addPrompt(
	prompt?: Partial<Omit<UserPromptItem, "id">> & { id?: string },
): UserPromptItem {

	const currentSettings = getPromptSettings();

	const candidateId = prompt?.id?.trim();
	const id = candidateId && candidateId !== "" && !isSystemPromptId(candidateId) && !(candidateId in currentSettings.userPrompts)
		? candidateId
		: generatePromptId();

	const newItem: UserPromptItem = {
		id,
		name: prompt?.name ?? "",
		description: prompt?.description ?? "",
		content: prompt?.content ?? "",
		enabled: prompt?.enabled ?? true,
		role: prompt?.role === "system" || prompt?.role === "user" ? prompt.role : "user",
	};

	currentSettings.userPrompts[id] = newItem;
	currentSettings.order.push(id);

	savePromptSettings(currentSettings);

	return newItem;
}

export function updatePrompt(
	id: string,
	updates: Partial<Omit<UserPromptItem, "id">>,
): UserPromptItem | null {

	if (isSystemPromptId(id)) {
		return null;
	}

	const currentSettings = getPromptSettings();

	if (!(id in currentSettings.userPrompts)) {
		return null;
	}

	const existingItem = currentSettings.userPrompts[id];

	const updatedItem: UserPromptItem = {
		id: existingItem.id,
		name: typeof updates.name === "string" ? updates.name : existingItem.name,
		description: typeof updates.description === "string" ? updates.description : existingItem.description,
		content: typeof updates.content === "string" ? updates.content : existingItem.content,
		enabled: typeof updates.enabled === "boolean" ? updates.enabled : existingItem.enabled,
		role: updates.role === "system" || updates.role === "user" ? updates.role : (existingItem.role ?? "user"),
	};

	currentSettings.userPrompts[id] = updatedItem;

	savePromptSettings(currentSettings);

	return updatedItem;
}

export function updateSystemPrompt(
	id: SystemPromptId,
	updates: { enabled?: boolean; role?: "system" | "user" },
): boolean {

	if (!isSystemPromptId(id)) {
		return false;
	}

	const currentSettings = getPromptSettings();

	if (!currentSettings.systemPrompts[id]) {
		currentSettings.systemPrompts[id] = { enabled: true };
	}

	if (typeof updates.enabled === "boolean") {
		currentSettings.systemPrompts[id].enabled = updates.enabled;
	}

	if (updates.role === "system" || updates.role === "user") {
		if (id !== "system:chat_history") {
			currentSettings.systemPrompts[id].role = updates.role;
		}
	}

	savePromptSettings(currentSettings);

	return true;
}

export function updateSystemPromptRole(
	id: SystemPromptId,
	role: "system" | "user",
): boolean {

	if (!isSystemPromptId(id) || id === "system:chat_history") {
		return false;
	}

	if (role !== "system" && role !== "user") {
		return false;
	}

	const currentSettings = getPromptSettings();

	if (!currentSettings.systemPrompts[id]) {
		currentSettings.systemPrompts[id] = { enabled: true, role };
	}
	else {
		currentSettings.systemPrompts[id].role = role;
	}

	savePromptSettings(currentSettings);

	return true;
}

export function deletePrompt(id: string): boolean {

	if (isSystemPromptId(id)) {
		return false;
	}

	const currentSettings = getPromptSettings();

	if (!(id in currentSettings.userPrompts)) {
		return false;
	}

	delete currentSettings.userPrompts[id];

	currentSettings.order = currentSettings.order.filter(itemId => itemId !== id);

	savePromptSettings(currentSettings);

	return true;
}

export function reorderPrompt(
	id: string,
	direction: "up" | "down",
): boolean {

	const currentSettings = getPromptSettings();

	const currentIndex = currentSettings.order.indexOf(id);

	if (currentIndex === -1) {
		return false;
	}

	const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

	if (targetIndex < 0 || targetIndex >= currentSettings.order.length) {
		return false;
	}

	const itemToMove = currentSettings.order[currentIndex];

	currentSettings.order[currentIndex] = currentSettings.order[targetIndex];
	currentSettings.order[targetIndex] = itemToMove;

	savePromptSettings(currentSettings);

	return true;
}

export function resetPromptSettings(): PromptSettings {

	const defaultSettings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS);

	savePromptSettings(defaultSettings);

	return defaultSettings;
}

export function clearPromptSettingsMemory(): void {

	cachedSnapshot = null;
	removeStorageItem(STORAGE_KEY_PROMPT_SETTINGS);
	memoryStorage.clear();
}

export function setPromptSettingsRawForTesting(rawData: string): void {

	cachedSnapshot = null;
	memoryStorage.set(STORAGE_KEY_PROMPT_SETTINGS, rawData);
}
