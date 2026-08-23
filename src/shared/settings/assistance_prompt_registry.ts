import type { AssistancePromptItem, AssistancePromptSettings } from "../ai/assistance/types.ts";

export const ASSISTANCE_PROMPT_STORAGE_KEY = "assistance:prompt_settings";

export const DEFAULT_ASSISTANCE_PROMPT_ITEMS: AssistancePromptItem[] = [
	{
		id: "default:creative_options",
		name: "Creative Options",
		content: "When offering suggestions, provide distinct creative options and explain differences clearly.",
		enabled: true,
	},
];

export function createDefaultAssistancePromptSettings(): AssistancePromptSettings {

	const prompts: Record<string, AssistancePromptItem> = {};
	const order: string[] = [];

	for (const item of DEFAULT_ASSISTANCE_PROMPT_ITEMS) {
		prompts[item.id] = { ...item };
		order.push(item.id);
	}

	return {
		order,
		prompts,
	};

}

let inMemorySettings: AssistancePromptSettings | null = null;
let cachedSnapshot: AssistancePromptSettings | null = null;

const listeners = new Set<() => void>();

function notifyListeners(): void {

	for (const listener of listeners) {
		listener();
	}

}

function sanitizeLoadedSettings(parsed: unknown): AssistancePromptSettings {

	if (!parsed || typeof parsed !== "object") {
		return createDefaultAssistancePromptSettings();
	}

	const raw = parsed as Partial<AssistancePromptSettings>;
	const sanitizedPrompts: Record<string, AssistancePromptItem> = {};
	const sanitizedOrder: string[] = [];

	if (raw.prompts && typeof raw.prompts === "object") {
		for (const [id, item] of Object.entries(raw.prompts)) {
			if (item && typeof item === "object") {
				const prompt = item as Partial<AssistancePromptItem>;
				if (typeof prompt.name === "string" && typeof prompt.content === "string") {
					sanitizedPrompts[id] = {
						id,
						name: prompt.name,
						content: prompt.content,
						enabled: typeof prompt.enabled === "boolean" ? prompt.enabled : true,
					};
				}
			}
		}
	}

	if (Array.isArray(raw.order)) {
		for (const id of raw.order) {
			if (typeof id === "string" && sanitizedPrompts[id] && !sanitizedOrder.includes(id)) {
				sanitizedOrder.push(id);
			}
		}
	}

	for (const id of Object.keys(sanitizedPrompts)) {
		if (!sanitizedOrder.includes(id)) {
			sanitizedOrder.push(id);
		}
	}

	return {
		order: sanitizedOrder,
		prompts: sanitizedPrompts,
	};

}

export function getAssistancePromptSettings(): AssistancePromptSettings {

	if (inMemorySettings !== null) {
		return inMemorySettings;
	}

	if (typeof window === "undefined" || !window.localStorage) {
		inMemorySettings = createDefaultAssistancePromptSettings();
		return inMemorySettings;
	}

	try {
		const raw = window.localStorage.getItem(ASSISTANCE_PROMPT_STORAGE_KEY);
		if (!raw) {
			inMemorySettings = createDefaultAssistancePromptSettings();
			return inMemorySettings;
		}

		const parsed = JSON.parse(raw);
		inMemorySettings = sanitizeLoadedSettings(parsed);
		return inMemorySettings;
	}
	catch {
		inMemorySettings = createDefaultAssistancePromptSettings();
		return inMemorySettings;
	}

}

export function saveAssistancePromptSettings(settings: AssistancePromptSettings): void {

	inMemorySettings = {
		order: [...settings.order],
		prompts: { ...settings.prompts },
	};
	cachedSnapshot = inMemorySettings;

	if (typeof window !== "undefined" && window.localStorage) {
		try {
			window.localStorage.setItem(
				ASSISTANCE_PROMPT_STORAGE_KEY,
				JSON.stringify(inMemorySettings),
			);
		}
		catch {
			// Local storage write failure ignored; in-memory fallback active
		}
	}

	notifyListeners();

}

export function subscribeAssistancePromptSettings(listener: () => void): () => void {

	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};

}

export function addAssistancePrompt(name: string, content: string): AssistancePromptItem {

	const current = getAssistancePromptSettings();
	const id = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	const newItem: AssistancePromptItem = {
		id,
		name: name.trim() || "Untitled Prompt",
		content: content.trim(),
		enabled: true,
	};

	saveAssistancePromptSettings({
		order: [...current.order, id],
		prompts: {
			...current.prompts,
			[id]: newItem,
		},
	});

	return newItem;

}

export function updateAssistancePrompt(
	id: string,
	updates: Partial<Pick<AssistancePromptItem, "name" | "content" | "enabled">>,
): void {

	const current = getAssistancePromptSettings();
	const existing = current.prompts[id];

	if (!existing) {
		return;
	}

	const updated: AssistancePromptItem = {
		...existing,
		...updates,
	};

	saveAssistancePromptSettings({
		...current,
		prompts: {
			...current.prompts,
			[id]: updated,
		},
	});

}

export function deleteAssistancePrompt(id: string): void {

	const current = getAssistancePromptSettings();

	if (!current.prompts[id]) {
		return;
	}

	const nextPrompts = { ...current.prompts };
	delete nextPrompts[id];

	const nextOrder = current.order.filter(item => item !== id);

	saveAssistancePromptSettings({
		order: nextOrder,
		prompts: nextPrompts,
	});

}

export function reorderAssistancePrompt(sourceIndex: number, destinationIndex: number): void {

	const current = getAssistancePromptSettings();

	if (
		sourceIndex < 0
		|| sourceIndex >= current.order.length
		|| destinationIndex < 0
		|| destinationIndex >= current.order.length
		|| sourceIndex === destinationIndex
	) {
		return;
	}

	const nextOrder = [...current.order];
	const [moved] = nextOrder.splice(sourceIndex, 1);
	nextOrder.splice(destinationIndex, 0, moved);

	saveAssistancePromptSettings({
		...current,
		order: nextOrder,
	});

}

export function resetAssistancePromptSettings(): void {

	const defaultSettings = createDefaultAssistancePromptSettings();
	saveAssistancePromptSettings(defaultSettings);

}

export function getAssistancePromptSettingsSnapshot(): AssistancePromptSettings {

	if (cachedSnapshot === null) {
		cachedSnapshot = getAssistancePromptSettings();
	}

	return cachedSnapshot;

}

export function clearAssistancePromptSettingsMemory(): void {

	inMemorySettings = null;
	cachedSnapshot = null;

}

export function setAssistancePromptSettingsRawForTesting(raw: string): void {

	try {
		const parsed = JSON.parse(raw);
		inMemorySettings = sanitizeLoadedSettings(parsed);
	}
	catch {
		inMemorySettings = createDefaultAssistancePromptSettings();
	}

}

export function getEnabledAssistancePrompts(): AssistancePromptItem[] {

	const settings = getAssistancePromptSettings();
	const result: AssistancePromptItem[] = [];

	for (const id of settings.order) {
		const prompt = settings.prompts[id];
		if (prompt && prompt.enabled && prompt.content.trim().length > 0) {
			result.push(prompt);
		}
	}

	return result;

}
