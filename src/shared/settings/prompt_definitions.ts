import APP_PROMPT from "../../assets/prompts/app_prompt.ts";
import type { PromptSettings, SystemPromptId } from "./types.ts";

export const SYSTEM_PROMPT_IDS: readonly SystemPromptId[] = [
	"system:app_prompt",
	"system:world_prompt",
	"system:character_prompt",
	"system:chapters_summary",
	"system:director_prompt",
	"system:chat_history",
	"system:world_states",
	"system:character_instances",
	"system:lore_prompt",
	"system:session_events",
	"system:wizard_prompt",
] as const;

export function isSystemPromptId(id: string): id is SystemPromptId {
	return (
		id === "system:app_prompt"
		|| id === "system:world_prompt"
		|| id === "system:character_prompt"
		|| id === "system:chapters_summary"
		|| id === "system:director_prompt"
		|| id === "system:chat_history"
		|| id === "system:world_states"
		|| id === "system:character_instances"
		|| id === "system:lore_prompt"
		|| id === "system:session_events"
		|| id === "system:wizard_prompt"
	);
}

export const SYSTEM_PROMPT_DEFINITIONS: Record<
	SystemPromptId,
	{ name: string; description: string }
> = {
	"system:app_prompt": {
		name: "Roleplay Instructions",
		description: "Instructions for LLM to follow.",
	},
	"system:world_prompt": {
		name: "World Prompt",
		description: "Initial roleplay instructions.",
	},
	"system:character_prompt": {
		name: "Character Prompt",
		description: "Static character profiles and traits.",
	},
	"system:chapters_summary": {
		name: "Chapters Summary",
		description: "Summary of story chapters when session compaction occurs.",
	},
	"system:director_prompt": {
		name: "Director Prompt",
		description: "Hidden steering instructions, thoughts, and plans for the Director agent.",
	},
	"system:chat_history": {
		name: "Chat History",
		description: "Conversation history and messages from the current chat session.",
	},
	"system:world_states": {
		name: "World States",
		description: "Active world state and session state variables.",
	},
	"system:character_instances": {
		name: "Character Instances",
		description: "Dynamic character thoughts, emotions, goals, and states.",
	},
	"system:lore_prompt": {
		name: "Lore Entries",
		description: "Active lore entries from the lore book.",
	},
	"system:session_events": {
		name: "Session Events",
		description: "Log of key narrative, character, and system events from the session.",
	},
	"system:wizard_prompt": {
		name: "Wizard Assistant Prompt",
		description: "Instructions and context for the creation wizard agent.",
	},
};

export { APP_PROMPT };

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
	order: [
		"system:app_prompt",
		"system:world_prompt",
		"system:character_prompt",
		"system:chapters_summary",
		"system:director_prompt",
		"system:chat_history",
		"system:world_states",
		"system:character_instances",
		"system:lore_prompt",
		"system:session_events",
		"system:wizard_prompt",
	],
	userPrompts: {},
	systemPrompts: {
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
	},
};
