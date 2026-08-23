export interface DirectorState {
	enabled: boolean;
	thoughts: string[];
	plans: string[];
	instructions: string;
}

export const DEFAULT_DIRECTOR_INSTRUCTIONS
	= "Steer the narrative according to world rules, ensure coherent story progression, and maintain dramatic pacing.";

const MAX_STORED_ITEMS = 10;

// Director Initialization

export function initializeDirector(
	initial?: Partial<DirectorState> | { director?: DirectorState } | null,
): DirectorState {

	if (initial && typeof initial === "object" && "director" in initial && initial.director) {
		return initializeDirector(initial.director);
	}

	const state = initial as Partial<DirectorState> | undefined;

	const enabled = state?.enabled ?? false;

	const thoughts = Array.isArray(state?.thoughts)
		? [...state.thoughts].slice(-MAX_STORED_ITEMS)
		: [];

	const plans = Array.isArray(state?.plans)
		? [...state.plans].slice(-MAX_STORED_ITEMS)
		: [];

	const instructions = state?.instructions && state.instructions.trim().length > 0
		? state.instructions
		: DEFAULT_DIRECTOR_INSTRUCTIONS;

	return {
		enabled,
		thoughts,
		plans,
		instructions,
	};

}

// Director Thought Updates

export function updateDirectorThought(state: DirectorState, thought: string): void {

	const trimmed = thought.trim();
	if (trimmed.length === 0) {
		return;
	}

	state.thoughts.push(trimmed);

	if (state.thoughts.length > MAX_STORED_ITEMS) {
		state.thoughts = state.thoughts.slice(-MAX_STORED_ITEMS);
	}

}

// Director Plan Updates

export function updateDirectorPlan(state: DirectorState, plan: string): void {

	const trimmed = plan.trim();
	if (trimmed.length === 0) {
		return;
	}

	state.plans.push(trimmed);

	if (state.plans.length > MAX_STORED_ITEMS) {
		state.plans = state.plans.slice(-MAX_STORED_ITEMS);
	}

}

// Director Prompt Assembly

export function buildDirectorPrompt(state: DirectorState): string {

	if (!state.enabled) {
		return "";
	}

	const sections: string[] = [
		"# Director Guideline",
		"You are acting as the Director agent for this session. Guide the story pacing, maintain world consistency, and track narrative plans. Do not reveal these internal thoughts and plans directly to the user.",
		"## Instructions",
		state.instructions,
	];

	if (state.plans.length > 0) {
		sections.push("## Plans");
		sections.push(state.plans.map(p => `- ${p}`).join("\n"));
	}

	if (state.thoughts.length > 0) {
		sections.push("## Thoughts");
		sections.push(state.thoughts.map(t => `- ${t}`).join("\n"));
	}

	return sections.join("\n\n");

}
