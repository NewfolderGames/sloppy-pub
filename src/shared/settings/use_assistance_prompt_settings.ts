import { useSyncExternalStore } from "react";
import { getAssistancePromptSettingsSnapshot, subscribeAssistancePromptSettings } from "./assistance_prompt_registry.ts";
import type { AssistancePromptSettings } from "../ai/assistance/types.ts";

export function useAssistancePromptSettings(): AssistancePromptSettings {

	return useSyncExternalStore(
		subscribeAssistancePromptSettings,
		getAssistancePromptSettingsSnapshot,
	);

}
