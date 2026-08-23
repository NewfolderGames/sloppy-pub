import type { ChatCompletionFunctionTool } from "../llm/request.ts";
import type { AssistantTab } from "./types.ts";

// Tool Schemas

export const PROPOSE_WORLD_MODIFICATION_TOOL: ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "propose_world_modification",
		description: "Propose partial line edits (replace, insert, or delete) to the active worldfile TOML content. Use line numbers from the active editor context. Generates a staged diff for user approval before applying.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Concise summary of the proposed changes (e.g. 'Add character Morvath', 'Update settlement lore').",
				},
				edits: {
					type: "array",
					description: "List of partial line edits to apply to the active TOML content.",
					items: {
						type: "object",
						properties: {
							operation: {
								type: "string",
								enum: ["replace", "insert", "delete"],
								description: "'replace' lines startLine..endLine with content; 'insert' content at startLine; 'delete' lines startLine..endLine.",
							},
							startLine: {
								type: "integer",
								description: "1-based line number in the current editor content.",
							},
							endLine: {
								type: "integer",
								description: "1-based end line number for replace/delete (inclusive). Defaults to startLine.",
							},
							content: {
								type: "string",
								description: "New text content to insert or replace with. Not required for 'delete'.",
							},
							position: {
								type: "string",
								enum: ["before", "after"],
								description: "For insert: 'before' inserts before startLine (default); 'after' inserts after startLine.",
							},
						},
						required: ["operation", "startLine"],
					},
				},
				operation: {
					type: "string",
					enum: ["replace", "insert", "delete"],
					description: "For a single edit: 'replace', 'insert', or 'delete'.",
				},
				startLine: {
					type: "integer",
					description: "For a single edit: 1-based start line number.",
				},
				endLine: {
					type: "integer",
					description: "For a single edit: 1-based end line number (inclusive). Defaults to startLine.",
				},
				content: {
					type: "string",
					description: "For a single edit: content to insert or replace with.",
				},
				position: {
					type: "string",
					enum: ["before", "after"],
					description: "For a single insert: 'before' (default) or 'after' startLine.",
				},
				proposedToml: {
					type: "string",
					description: "Fallback only: complete TOML text if replacing the whole file.",
				},
				description: {
					type: "string",
					description: "Optional details on why these changes were proposed.",
				},
			},
			required: ["title"],
		},
	},
};

export const PROPOSE_UNIVERSE_MODIFICATION_TOOL: ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "propose_universe_modification",
		description: "Propose partial line edits (replace, insert, or delete) to the active universefile TOML content. Use line numbers from the active editor context. Generates a staged diff for user approval before applying.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Concise summary of proposed changes (e.g. 'Add void magic rule', 'Update cosmology background').",
				},
				edits: {
					type: "array",
					description: "List of partial line edits to apply to the active universefile content.",
					items: {
						type: "object",
						properties: {
							operation: {
								type: "string",
								enum: ["replace", "insert", "delete"],
								description: "'replace' lines startLine..endLine with content; 'insert' content at startLine; 'delete' lines startLine..endLine.",
							},
							startLine: {
								type: "integer",
								description: "1-based line number in the current editor content.",
							},
							endLine: {
								type: "integer",
								description: "1-based end line number for replace/delete (inclusive). Defaults to startLine.",
							},
							content: {
								type: "string",
								description: "New text content to insert or replace with. Not required for 'delete'.",
							},
							position: {
								type: "string",
								enum: ["before", "after"],
								description: "For insert: 'before' inserts before startLine (default); 'after' inserts after startLine.",
							},
						},
						required: ["operation", "startLine"],
					},
				},
				operation: {
					type: "string",
					enum: ["replace", "insert", "delete"],
					description: "For a single edit: 'replace', 'insert', or 'delete'.",
				},
				startLine: {
					type: "integer",
					description: "For a single edit: 1-based start line number.",
				},
				endLine: {
					type: "integer",
					description: "For a single edit: 1-based end line number (inclusive). Defaults to startLine.",
				},
				content: {
					type: "string",
					description: "For a single edit: content to insert or replace with.",
				},
				position: {
					type: "string",
					enum: ["before", "after"],
					description: "For a single insert: 'before' (default) or 'after' startLine.",
				},
				proposedToml: {
					type: "string",
					description: "Fallback only: complete TOML text if replacing the whole file.",
				},
				description: {
					type: "string",
					description: "Optional details on why these changes were proposed.",
				},
			},
			required: ["title"],
		},
	},
};

export const PROPOSE_PROMPT_MODIFICATION_TOOL: ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "propose_prompt_modification",
		description: "Propose creating or updating an assistance or system prompt in Settings with partial line edits or full content. Generates a staged diff for user approval before applying.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Title of the prompt modification (e.g. 'Add Fantasy Narrator prompt', 'Update Response Directives').",
				},
				edits: {
					type: "array",
					description: "List of partial line edits to apply to the active prompt content.",
					items: {
						type: "object",
						properties: {
							operation: {
								type: "string",
								enum: ["replace", "insert", "delete"],
								description: "'replace', 'insert', or 'delete'.",
							},
							startLine: {
								type: "integer",
								description: "1-based line number.",
							},
							endLine: {
								type: "integer",
								description: "1-based end line number (inclusive).",
							},
							content: {
								type: "string",
								description: "Content to insert or replace with.",
							},
							position: {
								type: "string",
								enum: ["before", "after"],
								description: "Insert position relative to startLine.",
							},
						},
						required: ["operation", "startLine"],
					},
				},
				operation: {
					type: "string",
					enum: ["replace", "insert", "delete"],
					description: "For single edit: 'replace', 'insert', or 'delete'.",
				},
				startLine: {
					type: "integer",
					description: "For single edit: 1-based start line number.",
				},
				endLine: {
					type: "integer",
					description: "For single edit: 1-based end line number.",
				},
				content: {
					type: "string",
					description: "For single edit: content to insert or replace with.",
				},
				position: {
					type: "string",
					enum: ["before", "after"],
					description: "For single insert: 'before' or 'after'.",
				},
				proposedContent: {
					type: "string",
					description: "The proposed prompt body content if creating new prompt or full replacement.",
				},
				promptName: {
					type: "string",
					description: "Name for the prompt when creating a new custom prompt.",
				},
				targetPromptId: {
					type: "string",
					description: "Target prompt identifier if updating an existing prompt.",
				},
			},
			required: ["title"],
		},
	},
};

export const PROPOSE_CHARACTER_MODIFICATION_TOOL: ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "propose_character_modification",
		description: "Propose partial line edits (replace, insert, or delete) to the active characterfile TOML content. Use line numbers from the active editor context. Generates a staged diff for user approval before applying.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Concise summary of the proposed changes (e.g. 'Add military background', 'Expand linguistic traits').",
				},
				edits: {
					type: "array",
					description: "List of partial line edits to apply to the active TOML content.",
					items: {
						type: "object",
						properties: {
							operation: {
								type: "string",
								enum: ["replace", "insert", "delete"],
								description: "'replace' lines startLine..endLine with content; 'insert' content at startLine; 'delete' lines startLine..endLine.",
							},
							startLine: {
								type: "integer",
								description: "1-based line number in the current editor content.",
							},
							endLine: {
								type: "integer",
								description: "1-based end line number for replace/delete (inclusive). Defaults to startLine.",
							},
							content: {
								type: "string",
								description: "New text content to insert or replace with. Not required for 'delete'.",
							},
							position: {
								type: "string",
								enum: ["before", "after"],
								description: "For insert: 'before' inserts before startLine (default); 'after' inserts after startLine.",
							},
						},
						required: ["operation", "startLine"],
					},
				},
				operation: {
					type: "string",
					enum: ["replace", "insert", "delete"],
					description: "For a single edit: 'replace', 'insert', or 'delete'.",
				},
				startLine: {
					type: "integer",
					description: "For a single edit: 1-based start line number.",
				},
				endLine: {
					type: "integer",
					description: "For a single edit: 1-based end line number (inclusive). Defaults to startLine.",
				},
				content: {
					type: "string",
					description: "For a single edit: content to insert or replace with.",
				},
				position: {
					type: "string",
					enum: ["before", "after"],
					description: "For a single insert: 'before' (default) or 'after' startLine.",
				},
				proposedToml: {
					type: "string",
					description: "Fallback only: complete TOML text if replacing the whole file.",
				},
				description: {
					type: "string",
					description: "Optional details on why these changes were proposed.",
				},
			},
			required: ["title"],
		},
	},
};

export const PROPOSE_LORE_MODIFICATION_TOOL: ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "propose_lore_modification",
		description: "Propose partial line edits (replace, insert, or delete) to the active lorebook TOML content. Use line numbers from the active editor context. Generates a staged diff for user approval before applying.",
		parameters: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Concise summary of the proposed changes (e.g. 'Add dragon lore entry', 'Update keywords').",
				},
				edits: {
					type: "array",
					description: "List of partial line edits to apply to the active TOML content.",
					items: {
						type: "object",
						properties: {
							operation: {
								type: "string",
								enum: ["replace", "insert", "delete"],
								description: "'replace' lines startLine..endLine with content; 'insert' content at startLine; 'delete' lines startLine..endLine.",
							},
							startLine: {
								type: "integer",
								description: "1-based line number in the current editor content.",
							},
							endLine: {
								type: "integer",
								description: "1-based end line number for replace/delete (inclusive). Defaults to startLine.",
							},
							content: {
								type: "string",
								description: "New text content to insert or replace with. Not required for 'delete'.",
							},
							position: {
								type: "string",
								enum: ["before", "after"],
								description: "For insert: 'before' inserts before startLine (default); 'after' inserts after startLine.",
							},
						},
						required: ["operation", "startLine"],
					},
				},
				operation: {
					type: "string",
					enum: ["replace", "insert", "delete"],
					description: "For a single edit: 'replace', 'insert', or 'delete'.",
				},
				startLine: {
					type: "integer",
					description: "For a single edit: 1-based start line number.",
				},
				endLine: {
					type: "integer",
					description: "For a single edit: 1-based end line number (inclusive). Defaults to startLine.",
				},
				content: {
					type: "string",
					description: "For a single edit: content to insert or replace with.",
				},
				position: {
					type: "string",
					enum: ["before", "after"],
					description: "For a single insert: 'before' (default) or 'after' startLine.",
				},
				proposedToml: {
					type: "string",
					description: "Fallback only: complete TOML text if replacing the whole file.",
				},
				description: {
					type: "string",
					description: "Optional details on why these changes were proposed.",
				},
			},
			required: ["title"],
		},
	},
};

export const ALL_ASSISTANT_TOOLS: ChatCompletionFunctionTool[] = [
	PROPOSE_WORLD_MODIFICATION_TOOL,
	PROPOSE_UNIVERSE_MODIFICATION_TOOL,
	PROPOSE_CHARACTER_MODIFICATION_TOOL,
	PROPOSE_LORE_MODIFICATION_TOOL,
	PROPOSE_PROMPT_MODIFICATION_TOOL,
];

export function getAssistantToolsForTab(tab: AssistantTab): ChatCompletionFunctionTool[] {

	switch (tab) {
		case "world-manager":
			return [PROPOSE_WORLD_MODIFICATION_TOOL];
		case "universe-manager":
			return [PROPOSE_UNIVERSE_MODIFICATION_TOOL];
		case "character-manager":
			return [PROPOSE_CHARACTER_MODIFICATION_TOOL];
		case "lore":
			return [PROPOSE_LORE_MODIFICATION_TOOL];
		case "settings":
			return [PROPOSE_PROMPT_MODIFICATION_TOOL];
		default:
			return ALL_ASSISTANT_TOOLS;
	}

}
