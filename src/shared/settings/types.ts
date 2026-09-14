export type SystemPromptId
	= "system:app_prompt"
		| "system:world_prompt"
		| "system:character_prompt"
		| "system:chapters_summary"
		| "system:director_prompt"
		| "system:chat_history"
		| "system:world_states"
		| "system:semantic_directives"
		| "system:character_instances"
		| "system:lore_prompt"
		| "system:session_events"
		| "system:wizard_prompt";

export interface UserPromptItem {
	id: string;
	name: string;
	description: string;
	content: string;
	enabled: boolean;
	role?: "system" | "user";
}

export interface SystemPromptItem {
	id: SystemPromptId;
	name: string;
	description: string;
	enabled: boolean;
	role?: "system" | "user";
}

export interface PromptSettings {
	order: string[];
	userPrompts: Record<string, UserPromptItem>;
	systemPrompts: Record<Exclude<SystemPromptId, "system:wizard_prompt">, { enabled: boolean; role?: "system" | "user" }>
		& Partial<Record<"system:wizard_prompt", { enabled: boolean; role?: "system" | "user" }>>;
}
