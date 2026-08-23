import type { CharacterInstance } from "./types.ts";
import type { CharacterStateStore } from "./state_store.ts";

export interface MutateCharacterArgs {
	character: string;
	operations: Array<{
		type: "set" | "delete";
		category: string;
		id?: string;
		title?: string;
		name?: string;
		internal_monologue?: string;
		key?: string;
		value?: unknown;
	}>;
	reason?: string;
}

export interface ReadCharacterArgs {
	character?: string;
}

export interface CharacterToolResult {
	status: "success" | "error";
	message?: string;
	applied_count?: number;
	character?: unknown;
	characters?: unknown[];
}

export const MUTATE_CHARACTER_TOOL = {
	type: "function",
	function: {
		name: "mutate_character",
		description:
			"Mutates dynamic thoughts, emotions, goals, and states of a character instance atomically.",
		parameters: {
			type: "object",
			properties: {
				character: {
					type: "string",
					description:
						"The name, characterId, or instance ID of the character to update.",
				},
				operations: {
					type: "array",
					items: {
						type: "object",
						properties: {
							type: {
								type: "string",
								enum: ["set", "delete"],
								description: "The operation type: set or delete.",
							},
							category: {
								type: "string",
								enum: ["thought", "emotion", "goal", "state"],
								description: "The category to mutate: thought, emotion, goal, or state.",
							},
							id: {
								type: "string",
								description: "Optional identifier for the item to update or delete.",
							},
							title: {
								type: "string",
								description: "Title for thoughts (optional for set/delete).",
							},
							name: {
								type: "string",
								description: "Name for emotions or goals (optional for set/delete).",
							},
							internal_monologue: {
								type: "string",
								description:
									"The internal monologue text for thoughts, emotions, or goals.",
							},
							key: {
								type: "string",
								description: "The state variable key for state operations.",
							},
							value: {
								description:
									"The state variable value for set operations (primitive or array).",
							},
						},
						required: ["type", "category"],
					},
					description: "List of atomic operations to execute on the character.",
				},
				reason: {
					type: "string",
					description: "Short narrative justification for the modifications.",
				},
			},
			required: ["character", "operations"],
		},
	},
} as const;

export const READ_CHARACTER_TOOL = {
	type: "function",
	function: {
		name: "read_character",
		description:
			"Reads current dynamic thoughts, emotions, goals, and states for a specific character or all characters.",
		parameters: {
			type: "object",
			properties: {
				character: {
					type: "string",
					description:
						"Optional character name, characterId, or instance id. If omitted, returns all characters.",
				},
			},
		},
	},
} as const;

// NPC Character Creation Tool

export interface CreateNpcArgs {
	name: string;
	description?: string;
	traits?: string[];
	initialStates?: Record<string, unknown>;
}

export const CREATE_NPC_CHARACTER_TOOL = {
	type: "function",
	function: {
		name: "create_npc_character",
		description:
			"Creates a temporary NPC character instance in the current session, without a template.",
		parameters: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "The NPC's display name.",
				},
				description: {
					type: "string",
					description: "Optional short description of the NPC.",
				},
				traits: {
					type: "array",
					items: { type: "string" },
					description: "Optional personality or physical traits.",
				},
				initialStates: {
					type: "object",
					description: "Optional initial state values for the NPC.",
					additionalProperties: { type: "string" },
				},
			},
			required: ["name"],
		},
	},
} as const;

export const CHARACTER_TOOL_DEFINITIONS = [
	MUTATE_CHARACTER_TOOL,
	READ_CHARACTER_TOOL,
	CREATE_NPC_CHARACTER_TOOL,
] as const;

export const CHARACTER_TOOL_NAMES = new Set([
	"mutate_character",
	"read_character",
	"create_npc_character",
]);

// Tool Execution Dispatcher

export function executeCharacterTool(
	toolName: string,
	args: unknown,
	characterStore: CharacterStateStore,
): CharacterToolResult {

	try {
		if (toolName === "mutate_character") {
			const mutateArgs = args as MutateCharacterArgs;

			if (!mutateArgs || typeof mutateArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for mutate_character.",
				};
			}

			if (!mutateArgs.character || typeof mutateArgs.character !== "string") {
				return {
					status: "error",
					message: "Field 'character' must be a non-empty string.",
				};
			}

			if (!Array.isArray(mutateArgs.operations)) {
				return {
					status: "error",
					message: "Field 'operations' must be an array of character operations.",
				};
			}

			if (!characterStore.hasInstance(mutateArgs.character)) {
				return {
					status: "error",
					message: `Character "${mutateArgs.character}" not found.`,
				};
			}

			const result = characterStore.applyOperations(
				mutateArgs.character,
				mutateArgs.operations as any,
			);

			return {
				status: result.status,
				message: result.message,
				applied_count: result.applied_count,
				character: result.character,
			};
		}

		if (toolName === "create_npc_character") {
			const npcArgs = args as CreateNpcArgs;

			if (!npcArgs || typeof npcArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for create_npc_character.",
				};
			}

			if (!npcArgs.name || typeof npcArgs.name !== "string") {
				return {
					status: "error",
					message: "Field 'name' must be a non-empty string.",
				};
			}

			// Create a new NPC character instance
			const npcInstance: CharacterInstance = {
				id: `npc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				name: npcArgs.name,
				isNpc: true,
				thoughts: [],
				emotions: [],
				goals: [],
				states: {},
			};

			if (npcArgs.initialStates && typeof npcArgs.initialStates === "object") {
				for (const [k, v] of Object.entries(npcArgs.initialStates)) {
					if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
						npcInstance.states[k] = v;
					}
				}
			}

			characterStore.addInstance(npcInstance);

			return {
				status: "success",
				message: `NPC "${npcArgs.name}" created successfully.`,
				character: npcInstance,
			};
		}

		if (toolName === "read_character") {
			const readArgs = (args || {}) as ReadCharacterArgs;

			if (readArgs.character) {
				const instance = characterStore.getInstance(readArgs.character);

				if (!instance) {
					return {
						status: "error",
						message: `Character "${readArgs.character}" not found.`,
					};
				}

				return {
					status: "success",
					character: instance,
				};
			}

			return {
				status: "success",
				characters: characterStore.getAllInstances(),
			};
		}

		return {
			status: "error",
			message: `Unknown character tool: ${toolName}`,
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
