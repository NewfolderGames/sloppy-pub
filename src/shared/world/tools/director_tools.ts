import type { DirectorState } from "../../session/director.ts";
import { updateDirectorPlan, updateDirectorThought } from "../../session/director.ts";
import type { WorldInstance } from "../types.ts";
import { saveInstance } from "../instance_manager.ts";

export interface DirectorThinkArgs {
	thought: string;
}

export interface DirectorPlanArgs {
	plan?: string;
	plans?: string[];
}

export interface DirectorSteerArgs {
	instructions: string;
}

export interface DirectorToolResult {
	status: "success" | "error";
	message?: string;
	thoughts?: string[];
	plans?: string[];
	instructions?: string;
}

// Tool Definitions

export const DIRECTOR_THINK_TOOL = {
	type: "function",
	function: {
		name: "director_think",
		description: "Add an internal narrative thought or reflection to the session director state.",
		parameters: {
			type: "object",
			properties: {
				thought: {
					type: "string",
					description: "The internal thought or reflection to record.",
				},
			},
			required: ["thought"],
		},
	},
} as const;

export const DIRECTOR_PLAN_TOOL = {
	type: "function",
	function: {
		name: "director_plan",
		description: "Add, update, or set a narrative plan or story goal for the session director.",
		parameters: {
			type: "object",
			properties: {
				plan: {
					type: "string",
					description: "A single narrative plan or plot goal to add.",
				},
				plans: {
					type: "array",
					items: { type: "string" },
					description: "A list of plans to replace or set in the director state.",
				},
			},
		},
	},
} as const;

export const DIRECTOR_STEER_TOOL = {
	type: "function",
	function: {
		name: "director_steer",
		description: "Set steering instructions to guide future narrative choices in the session.",
		parameters: {
			type: "object",
			properties: {
				instructions: {
					type: "string",
					description: "The steering instructions for narrative progression.",
				},
			},
			required: ["instructions"],
		},
	},
} as const;

export const DIRECTOR_TOOL_DEFINITIONS = [
	DIRECTOR_THINK_TOOL,
	DIRECTOR_PLAN_TOOL,
	DIRECTOR_STEER_TOOL,
] as const;

export const DIRECTOR_TOOL_NAMES = new Set([
	"director_think",
	"director_plan",
	"director_steer",
]);

// Tool Execution Dispatcher

export function executeDirectorTool(
	toolName: string,
	args: unknown,
	director: DirectorState,
	instance?: WorldInstance,
): DirectorToolResult {

	if (!director) {
		return {
			status: "error",
			message: "Director state is not available.",
		};
	}

	const parsedArgs = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;

	if (toolName === "director_think") {
		const rawThought = parsedArgs.thought;
		if (typeof rawThought !== "string" || rawThought.trim().length === 0) {
			return {
				status: "error",
				message: "Invalid or missing 'thought' parameter.",
			};
		}

		updateDirectorThought(director, rawThought);

		if (instance) {
			saveInstance(instance);
		}

		return {
			status: "success",
			message: "Director thought recorded.",
			thoughts: [...director.thoughts],
		};
	}

	if (toolName === "director_plan") {
		const rawPlans = parsedArgs.plans;
		const rawPlan = parsedArgs.plan;

		if (Array.isArray(rawPlans)) {
			const validPlans = rawPlans.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
			director.plans = validPlans.map(p => p.trim()).slice(-10);
		}
		else if (typeof rawPlan === "string" && rawPlan.trim().length > 0) {
			updateDirectorPlan(director, rawPlan);
		}
		else {
			return {
				status: "error",
				message: "Either 'plan' string or 'plans' array must be provided.",
			};
		}

		if (instance) {
			saveInstance(instance);
		}

		return {
			status: "success",
			message: "Director plan recorded.",
			plans: [...director.plans],
		};
	}

	if (toolName === "director_steer") {
		const rawInstructions = parsedArgs.instructions;
		if (typeof rawInstructions !== "string" || rawInstructions.trim().length === 0) {
			return {
				status: "error",
				message: "Invalid or missing 'instructions' parameter.",
			};
		}

		director.instructions = rawInstructions.trim();

		if (instance) {
			saveInstance(instance);
		}

		return {
			status: "success",
			message: "Director steering instructions updated.",
			instructions: director.instructions,
		};
	}

	return {
		status: "error",
		message: `Unknown director tool: ${toolName}`,
	};

}
