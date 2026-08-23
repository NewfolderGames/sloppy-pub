import type { ActivationMode, LoreEntry } from "./types.ts";
import { addLoreEntry, getLoreBook, removeLoreEntry, updateLoreEntry } from "./registry.ts";

export interface AddLoreEntryArgs {
	lorebookId: string;
	title: string;
	content: string;
	keywords?: string[];
	activationMode?: ActivationMode;
	priority?: number;
}

export interface UpdateLoreEntryArgs {
	lorebookId: string;
	entryId: string;
	title?: string;
	content?: string;
	keywords?: string[];
	activationMode?: ActivationMode;
	enabled?: boolean;
	priority?: number;
}

export interface RemoveLoreEntryArgs {
	lorebookId: string;
	entryId: string;
}

export interface ListLoreEntriesArgs {
	lorebookId: string;
}

export interface LoreToolResult {
	status: "success" | "error";
	message?: string;
	entry?: LoreEntry;
	entries?: LoreEntry[];
}

export const ADD_LORE_ENTRY_TOOL = {
	type: "function",
	function: {
		name: "add_lore_entry",
		description: "Adds a new lore entry to a lore book.",
		parameters: {
			type: "object",
			properties: {
				lorebookId: {
					type: "string",
					description: "The ID of the lore book to add the entry to.",
				},
				title: {
					type: "string",
					description: "The title of the lore entry.",
				},
				content: {
					type: "string",
					description: "The body content of the lore entry.",
				},
				keywords: {
					type: "array",
					items: { type: "string" },
					description: "Optional keywords for dynamic activation.",
				},
				activationMode: {
					type: "string",
					enum: ["static", "dynamic"],
					description:
						"Activation mode: 'static' always injects, 'dynamic' injects when keywords match. Defaults to 'static'.",
				},
				priority: {
					type: "number",
					description: "Optional sort priority (higher = appears first).",
				},
			},
			required: ["lorebookId", "title", "content"],
		},
	},
} as const;

export const UPDATE_LORE_ENTRY_TOOL = {
	type: "function",
	function: {
		name: "update_lore_entry",
		description: "Updates an existing lore entry.",
		parameters: {
			type: "object",
			properties: {
				lorebookId: {
					type: "string",
					description: "The ID of the lore book containing the entry.",
				},
				entryId: {
					type: "string",
					description: "The ID of the lore entry to update.",
				},
				title: {
					type: "string",
					description: "New title for the entry.",
				},
				content: {
					type: "string",
					description: "New body content for the entry.",
				},
				keywords: {
					type: "array",
					items: { type: "string" },
					description: "New keywords for dynamic activation.",
				},
				activationMode: {
					type: "string",
					enum: ["static", "dynamic"],
					description: "New activation mode.",
				},
				enabled: {
					type: "boolean",
					description: "Whether the entry is enabled.",
				},
				priority: {
					type: "number",
					description: "New sort priority.",
				},
			},
			required: ["lorebookId", "entryId"],
		},
	},
} as const;

export const REMOVE_LORE_ENTRY_TOOL = {
	type: "function",
	function: {
		name: "remove_lore_entry",
		description: "Removes a lore entry from a lore book.",
		parameters: {
			type: "object",
			properties: {
				lorebookId: {
					type: "string",
					description: "The ID of the lore book containing the entry.",
				},
				entryId: {
					type: "string",
					description: "The ID of the lore entry to remove.",
				},
			},
			required: ["lorebookId", "entryId"],
		},
	},
} as const;

export const LIST_LORE_ENTRIES_TOOL = {
	type: "function",
	function: {
		name: "list_lore_entries",
		description: "Lists all entries in a lore book.",
		parameters: {
			type: "object",
			properties: {
				lorebookId: {
					type: "string",
					description: "The ID of the lore book to list entries from.",
				},
			},
			required: ["lorebookId"],
		},
	},
} as const;

export const LORE_TOOL_DEFINITIONS = [
	ADD_LORE_ENTRY_TOOL,
	UPDATE_LORE_ENTRY_TOOL,
	REMOVE_LORE_ENTRY_TOOL,
	LIST_LORE_ENTRIES_TOOL,
] as const;

export const LORE_TOOL_NAMES = new Set([
	"add_lore_entry",
	"update_lore_entry",
	"remove_lore_entry",
	"list_lore_entries",
]);

// Tool Execution Dispatcher

export function executeLoreTool(
	toolName: string,
	args: unknown,
): LoreToolResult {

	try {
		if (toolName === "add_lore_entry") {
			const addArgs = args as AddLoreEntryArgs;

			if (!addArgs || typeof addArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for add_lore_entry.",
				};
			}

			if (!addArgs.lorebookId || typeof addArgs.lorebookId !== "string") {
				return {
					status: "error",
					message: "Field 'lorebookId' must be a non-empty string.",
				};
			}

			if (!addArgs.title || typeof addArgs.title !== "string") {
				return {
					status: "error",
					message: "Field 'title' must be a non-empty string.",
				};
			}

			if (!addArgs.content || typeof addArgs.content !== "string") {
				return {
					status: "error",
					message: "Field 'content' must be a non-empty string.",
				};
			}

			const entryId = `lore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

			const entry: LoreEntry = {
				id: entryId,
				title: addArgs.title,
				content: addArgs.content,
				keywords: addArgs.keywords ?? [],
				activationMode: addArgs.activationMode ?? "static",
				enabled: true,
				priority: addArgs.priority,
			};

			const success = addLoreEntry(addArgs.lorebookId, entry);

			if (!success) {
				return {
					status: "error",
					message: `Lore book "${addArgs.lorebookId}" not found.`,
				};
			}

			return {
				status: "success",
				message: `Lore entry "${addArgs.title}" added successfully.`,
				entry,
			};
		}

		if (toolName === "update_lore_entry") {
			const updateArgs = args as UpdateLoreEntryArgs;

			if (!updateArgs || typeof updateArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for update_lore_entry.",
				};
			}

			if (!updateArgs.lorebookId || typeof updateArgs.lorebookId !== "string") {
				return {
					status: "error",
					message: "Field 'lorebookId' must be a non-empty string.",
				};
			}

			if (!updateArgs.entryId || typeof updateArgs.entryId !== "string") {
				return {
					status: "error",
					message: "Field 'entryId' must be a non-empty string.",
				};
			}

			const success = updateLoreEntry(
				updateArgs.lorebookId,
				updateArgs.entryId,
				{
					title: updateArgs.title,
					content: updateArgs.content,
					keywords: updateArgs.keywords,
					activationMode: updateArgs.activationMode,
					enabled: updateArgs.enabled,
					priority: updateArgs.priority,
				},
			);

			if (!success) {
				return {
					status: "error",
					message: `Lore entry "${updateArgs.entryId}" not found in book "${updateArgs.lorebookId}".`,
				};
			}

			return {
				status: "success",
				message: `Lore entry "${updateArgs.entryId}" updated.`,
			};
		}

		if (toolName === "remove_lore_entry") {
			const removeArgs = args as RemoveLoreEntryArgs;

			if (!removeArgs || typeof removeArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for remove_lore_entry.",
				};
			}

			if (!removeArgs.lorebookId || typeof removeArgs.lorebookId !== "string") {
				return {
					status: "error",
					message: "Field 'lorebookId' must be a non-empty string.",
				};
			}

			if (!removeArgs.entryId || typeof removeArgs.entryId !== "string") {
				return {
					status: "error",
					message: "Field 'entryId' must be a non-empty string.",
				};
			}

			const success = removeLoreEntry(removeArgs.lorebookId, removeArgs.entryId);

			if (!success) {
				return {
					status: "error",
					message: `Lore entry "${removeArgs.entryId}" not found in book "${removeArgs.lorebookId}".`,
				};
			}

			return {
				status: "success",
				message: `Lore entry "${removeArgs.entryId}" removed.`,
			};
		}

		if (toolName === "list_lore_entries") {
			const listArgs = (args ?? {}) as ListLoreEntriesArgs;

			if (!listArgs.lorebookId || typeof listArgs.lorebookId !== "string") {
				return {
					status: "error",
					message: "Field 'lorebookId' must be a non-empty string.",
				};
			}

			const record = getLoreBook(listArgs.lorebookId);

			if (!record) {
				return {
					status: "error",
					message: `Lore book "${listArgs.lorebookId}" not found.`,
				};
			}

			return {
				status: "success",
				entries: record.lorebook.entries,
			};
		}

		return {
			status: "error",
			message: `Unknown lore tool: ${toolName}`,
		};
	}
	catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			status: "error",
			message,
		};
	}

}
