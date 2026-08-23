import { useSyncExternalStore } from "react";
import { getPromptSettingsSnapshot, subscribePromptSettings } from "./prompt_registry.ts";
import type { PromptSettings } from "./types.ts";

export function usePromptSettings(): PromptSettings {

	return useSyncExternalStore(
		subscribePromptSettings,
		getPromptSettingsSnapshot,
	);
}
