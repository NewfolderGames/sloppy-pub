import type { StateStore } from "./state_store.ts";
import type {
	MutateWorldStateArgs,
	PatchWorldStateArgs,
	ReadWorldStateArgs,
	StateOperation,
	StateToolResult,
	UpdateWorldStateArgs,
} from "./types.ts";

// Tool Definitions

export const MUTATE_WORLD_STATE_TOOL = {
	type: "function",
	function: {
		name: "mutate_world_state",
		description: "Applies a batch of world state operations (set or delete) atomically.",
		parameters: {
			type: "object",
			properties: {
				operations: {
					type: "array",
					items: {
						type: "object",
						properties: {
							type: {
								type: "string",
								enum: ["set", "delete"],
								description: "Operation type: 'set' to update or create, 'delete' to remove.",
							},
							key: {
								type: "string",
								description: "The dot-notated key of the state variable to mutate.",
							},
							value: {
								description: "The new value to assign for 'set' operations. Can be string, number, boolean, or array.",
							},
						},
						required: ["type", "key"],
					},
					description: "List of state operations to execute atomically.",
				},
				reason: {
					type: "string",
					description: "Short narrative justification for the state modifications.",
				},
			},
			required: ["operations"],
		},
	},
} as const;

export const UPDATE_WORLD_STATE_TOOL = {
	type: "function",
	function: {
		name: "update_world_state",
		description: "Updates or creates a single world state variable.",
		parameters: {
			type: "object",
			properties: {
				key: {
					type: "string",
					description:
						"The dot-notated key of the state variable to update (for example, 'district.alert_level').",
				},
				value: {
					description:
						"The new value to assign to the key. Can be a string, number, boolean, or array.",
				},
				reason: {
					type: "string",
					description: "Short narrative justification for the state modification.",
				},
			},
			required: ["key", "value"],
		},
	},
} as const;

export const PATCH_WORLD_STATE_TOOL = {
	type: "function",
	function: {
		name: "patch_world_state",
		description: "Applies a batch of key-value updates to world state.",
		parameters: {
			type: "object",
			properties: {
				updates: {
					type: "object",
					description:
						"A dictionary of dot-notated key-value pairs to set or update in world state.",
				},
				reason: {
					type: "string",
					description: "Narrative explanation for the batch state changes.",
				},
			},
			required: ["updates"],
		},
	},
} as const;

export const READ_WORLD_STATE_TOOL = {
	type: "function",
	function: {
		name: "read_world_state",
		description: "Reads current world state variables.",
		parameters: {
			type: "object",
			properties: {
				keys: {
					type: "array",
					items: {
						type: "string",
					},
					description:
						"Optional list of dot-notated state keys to read. If omitted, returns all state variables.",
				},
			},
		},
	},
} as const;

export const STATE_TOOL_DEFINITIONS = [
	MUTATE_WORLD_STATE_TOOL,
	UPDATE_WORLD_STATE_TOOL,
	PATCH_WORLD_STATE_TOOL,
	READ_WORLD_STATE_TOOL,
] as const;

export const STATE_TOOL_NAMES = new Set([
	"mutate_world_state",
	"update_world_state",
	"patch_world_state",
	"read_world_state",
]);

// Tool Execution Dispatcher

export function executeStateTool(
	toolName: string,
	args: unknown,
	stateStore: StateStore,
): StateToolResult {

	try {
		if (toolName === "mutate_world_state") {
			const mutateArgs = args as MutateWorldStateArgs;

			if (!mutateArgs || typeof mutateArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for mutate_world_state",
				};
			}

			if (!Array.isArray(mutateArgs.operations)) {
				return {
					status: "error",
					message: "Field 'operations' must be an array of state operations",
				};
			}

			const result = stateStore.applyOperations(mutateArgs.operations, mutateArgs.reason);

			return {
				status: "success",
				applied_count: result.appliedCount,
				operations: result.operations,
			};
		}

		if (toolName === "update_world_state") {
			const updateArgs = args as UpdateWorldStateArgs & { operations?: StateOperation[] };

			if (!updateArgs || typeof updateArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for update_world_state",
				};
			}

			if (Array.isArray(updateArgs.operations)) {
				const result = stateStore.applyOperations(updateArgs.operations, updateArgs.reason);

				return {
					status: "success",
					applied_count: result.appliedCount,
					operations: result.operations,
				};
			}

			if (typeof updateArgs.key !== "string") {
				return {
					status: "error",
					message: "Field 'key' must be a dot-notated string",
				};
			}

			if (updateArgs.value === undefined) {
				return {
					status: "error",
					message: "Field 'value' is required for update_world_state",
				};
			}

			const result = stateStore.setState(updateArgs.key, updateArgs.value, updateArgs.reason);

			return {
				status: "success",
				key: updateArgs.key,
				previous_value: result.previousValue,
				new_value: result.newValue,
			};
		}

		if (toolName === "patch_world_state") {
			const patchArgs = args as PatchWorldStateArgs;

			if (!patchArgs || typeof patchArgs !== "object") {
				return {
					status: "error",
					message: "Arguments object is required for patch_world_state",
				};
			}

			if (!patchArgs.updates || typeof patchArgs.updates !== "object" || Array.isArray(patchArgs.updates)) {
				return {
					status: "error",
					message: "Field 'updates' must be an object of key-value pairs",
				};
			}

			const result = stateStore.patchStates(patchArgs.updates, patchArgs.reason);

			return {
				status: "success",
				applied_count: result.appliedCount,
				updates: result.updates,
			};
		}

		if (toolName === "read_world_state") {
			const readArgs = (args ?? {}) as ReadWorldStateArgs;

			let keysToRead: string[] | undefined;

			if (Array.isArray(readArgs.keys)) {
				keysToRead = readArgs.keys;
			}
			else if (typeof readArgs.key === "string") {
				keysToRead = [readArgs.key];
			}

			const states = stateStore.readStates(keysToRead);

			return {
				status: "success",
				states,
			};
		}

		return {
			status: "error",
			message: `Unknown state tool: ${toolName}`,
		};
	}
	catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return {
			status: "error",
			message: errorMessage,
		};
	}

}
