import type {
	FsmBlueprint,
	FsmGuard,
	FsmTransition,
	GaugeBlueprint,
	GaugeTier,
	SemanticBlueprints,
	StateOperation,
	StateValue,
	WorldStates,
} from "../types.ts";

export interface TierCrossingResult {
	exitedTiers: GaugeTier[];
	enteredTiers: GaugeTier[];
	operations: StateOperation[];
}

export interface FsmTransitionEvaluation {
	allowed: boolean;
	reason?: string;
	transition?: FsmTransition;
}

export interface ActiveDirectiveItem {
	key: string;
	source: "gauge" | "fsm";
	label: string;
	directive: string;
}

export interface ActiveDirectives {
	tierDirectives: Array<{ gaugeKey: string; tierId: string; label: string; directive: string }>;
	fsmDirectives: Array<{ fsmKey: string; state: string; directive: string }>;
	allDirectives: string[];
}

export interface ValidatedMutation {
	key: string;
	value: StateValue;
	previousValue: StateValue | null;
	clamped: boolean;
	transitionOperations: StateOperation[];
}

export interface MutationValidationResult {
	allowed: boolean;
	error?: string;
	mutation?: ValidatedMutation;
}

// Pure Evaluation Functions

export function clampGaugeDelta(
	currentVal: number,
	targetVal: number,
	gaugeDef: GaugeBlueprint,
): number {
	let nextVal = targetVal;

	if (gaugeDef.maxDeltaPerTurn !== undefined && gaugeDef.maxDeltaPerTurn > 0) {
		const delta = targetVal - currentVal;
		const maxDelta = gaugeDef.maxDeltaPerTurn;

		if (delta > maxDelta) {
			nextVal = currentVal + maxDelta;
		}
		else if (delta < -maxDelta) {
			nextVal = currentVal - maxDelta;
		}
	}

	if (nextVal < gaugeDef.min) {
		nextVal = gaugeDef.min;
	}

	if (nextVal > gaugeDef.max) {
		nextVal = gaugeDef.max;
	}

	return nextVal;
}

export function getTierForValue(
	value: number,
	gaugeDef: GaugeBlueprint,
): GaugeTier | undefined {
	for (const tier of gaugeDef.tiers) {
		if (value >= tier.min && value <= tier.max) {
			return tier;
		}
	}

	return undefined;
}

export function detectTierCrossings(
	oldVal: number,
	newVal: number,
	gaugeDef: GaugeBlueprint,
): TierCrossingResult {
	const oldTier = getTierForValue(oldVal, gaugeDef);
	const newTier = getTierForValue(newVal, gaugeDef);

	if (oldTier?.id === newTier?.id) {
		return {
			exitedTiers: [],
			enteredTiers: [],
			operations: [],
		};
	}

	const exitedTiers: GaugeTier[] = [];
	const enteredTiers: GaugeTier[] = [];
	const operations: StateOperation[] = [];

	if (oldTier !== undefined) {
		exitedTiers.push(oldTier);
		if (oldTier.onExit && oldTier.onExit.length > 0) {
			operations.push(...oldTier.onExit);
		}
	}

	if (newTier !== undefined) {
		enteredTiers.push(newTier);
		if (newTier.onEnter && newTier.onEnter.length > 0) {
			operations.push(...newTier.onEnter);
		}
	}

	return {
		exitedTiers,
		enteredTiers,
		operations,
	};
}

function isFlagSatisfied(flag: string, currentStates: WorldStates): boolean {
	const directVal = currentStates[flag];
	if (directVal === true) {
		return true;
	}

	const flagsVal = currentStates["flags"];
	if (Array.isArray(flagsVal) && flagsVal.includes(flag)) {
		return true;
	}

	if (typeof directVal === "string" && directVal.trim() !== "") {
		return true;
	}

	return false;
}

function isItemSatisfied(
	item: string,
	currentStates: WorldStates,
	blueprints?: SemanticBlueprints,
): boolean {
	const directVal = currentStates[item];
	if (directVal === true) {
		return true;
	}

	if (typeof directVal === "number" && directVal > 0) {
		return true;
	}

	if (blueprints?.inventories) {
		for (const inv of blueprints.inventories) {
			const invState = currentStates[inv.key];
			if (Array.isArray(invState) && invState.includes(item)) {
				return true;
			}
		}
	}

	const defaultInv = currentStates["inventory"] ?? currentStates["items"];
	if (Array.isArray(defaultInv) && defaultInv.includes(item)) {
		return true;
	}

	return false;
}

export function evaluateFsmGuard(
	guard: FsmGuard,
	currentStates: WorldStates,
	blueprints?: SemanticBlueprints,
): { satisfied: boolean; reason?: string } {
	if (guard.gaugeKey !== undefined) {
		const rawGauge = currentStates[guard.gaugeKey];
		const gaugeVal = typeof rawGauge === "number" ? rawGauge : 0;

		if (guard.minGauge !== undefined && gaugeVal < guard.minGauge) {
			return {
				satisfied: false,
				reason: `Gauge "${guard.gaugeKey}" value (${gaugeVal}) is below required minimum (${guard.minGauge}).`,
			};
		}

		if (guard.maxGauge !== undefined && gaugeVal > guard.maxGauge) {
			return {
				satisfied: false,
				reason: `Gauge "${guard.gaugeKey}" value (${gaugeVal}) is above required maximum (${guard.maxGauge}).`,
			};
		}
	}

	if (guard.requiredFlags && guard.requiredFlags.length > 0) {
		for (const flag of guard.requiredFlags) {
			if (!isFlagSatisfied(flag, currentStates)) {
				return {
					satisfied: false,
					reason: `Required flag "${flag}" is not active.`,
				};
			}
		}
	}

	if (guard.requiredItems && guard.requiredItems.length > 0) {
		for (const item of guard.requiredItems) {
			if (!isItemSatisfied(item, currentStates, blueprints)) {
				return {
					satisfied: false,
					reason: `Required item "${item}" is missing from inventory.`,
				};
			}
		}
	}

	return { satisfied: true };
}

export function evaluateFsmTransition(
	currentState: string,
	targetState: string,
	fsmDef: FsmBlueprint,
	currentStates: WorldStates,
	blueprints?: SemanticBlueprints,
): FsmTransitionEvaluation {
	if (!(targetState in fsmDef.states)) {
		return {
			allowed: false,
			reason: `Target state "${targetState}" is not declared in state machine "${fsmDef.key}".`,
		};
	}

	if (currentState === targetState) {
		return { allowed: true };
	}

	const transition = fsmDef.transitions.find(
		t => t.from === currentState && t.to === targetState,
	);

	if (!transition) {
		return {
			allowed: false,
			reason: `No permitted transition from "${currentState}" to "${targetState}" in state machine "${fsmDef.key}".`,
		};
	}

	if (transition.guard) {
		const guardCheck = evaluateFsmGuard(transition.guard, currentStates, blueprints);
		if (!guardCheck.satisfied) {
			return {
				allowed: false,
				reason: `Transition guard failed: ${guardCheck.reason}`,
				transition,
			};
		}
	}

	return {
		allowed: true,
		transition,
	};
}

export function extractActiveDirectives(
	blueprints: SemanticBlueprints,
	currentStates: WorldStates,
): ActiveDirectives {
	const tierDirectives: Array<{ gaugeKey: string; tierId: string; label: string; directive: string }> = [];
	const fsmDirectives: Array<{ fsmKey: string; state: string; directive: string }> = [];
	const allDirectives: string[] = [];

	if (blueprints.gauges) {
		for (const gauge of blueprints.gauges) {
			const rawVal = currentStates[gauge.key];
			const val = typeof rawVal === "number" ? rawVal : gauge.defaultValue;
			const tier = getTierForValue(val, gauge);

			if (tier && tier.directive.trim() !== "") {
				tierDirectives.push({
					gaugeKey: gauge.key,
					tierId: tier.id,
					label: tier.label,
					directive: tier.directive,
				});
				allDirectives.push(tier.directive);
			}
		}
	}

	if (blueprints.stateMachines) {
		for (const fsm of blueprints.stateMachines) {
			const rawState = currentStates[fsm.key];
			const currentState = typeof rawState === "string" ? rawState : fsm.initialState;
			const stateDef = fsm.states[currentState];

			if (stateDef?.directive && stateDef.directive.trim() !== "") {
				fsmDirectives.push({
					fsmKey: fsm.key,
					state: currentState,
					directive: stateDef.directive,
				});
				allDirectives.push(stateDef.directive);
			}
		}
	}

	return {
		tierDirectives,
		fsmDirectives,
		allDirectives,
	};
}

// Semantic Validation Engine Class

export class SemanticValidationEngine {
	private readonly blueprints: SemanticBlueprints;
	private readonly gaugeMap: Map<string, GaugeBlueprint> = new Map();
	private readonly fsmMap: Map<string, FsmBlueprint> = new Map();

	constructor(blueprints?: SemanticBlueprints) {
		this.blueprints = blueprints ?? {};

		if (this.blueprints.gauges) {
			for (const gauge of this.blueprints.gauges) {
				this.gaugeMap.set(gauge.key, gauge);
			}
		}

		if (this.blueprints.stateMachines) {
			for (const fsm of this.blueprints.stateMachines) {
				this.fsmMap.set(fsm.key, fsm);
			}
		}
	}

	public getBlueprints(): SemanticBlueprints {
		return this.blueprints;
	}

	public getGauge(key: string): GaugeBlueprint | undefined {
		return this.gaugeMap.get(key);
	}

	public getFsm(key: string): FsmBlueprint | undefined {
		return this.fsmMap.get(key);
	}

	public isGauge(key: string): boolean {
		return this.gaugeMap.has(key);
	}

	public isFsm(key: string): boolean {
		return this.fsmMap.has(key);
	}

	public clampGaugeDelta(currentVal: number, targetVal: number, gaugeKey: string): number {
		const gauge = this.gaugeMap.get(gaugeKey);
		if (!gauge) {
			return targetVal;
		}

		return clampGaugeDelta(currentVal, targetVal, gauge);
	}

	public detectTierCrossings(oldVal: number, newVal: number, gaugeKey: string): TierCrossingResult {
		const gauge = this.gaugeMap.get(gaugeKey);
		if (!gauge) {
			return { exitedTiers: [], enteredTiers: [], operations: [] };
		}

		return detectTierCrossings(oldVal, newVal, gauge);
	}

	public evaluateFsmTransition(
		currentState: string,
		targetState: string,
		fsmKey: string,
		currentStates: WorldStates,
	): FsmTransitionEvaluation {
		const fsm = this.fsmMap.get(fsmKey);
		if (!fsm) {
			return { allowed: true };
		}

		return evaluateFsmTransition(currentState, targetState, fsm, currentStates, this.blueprints);
	}

	public extractActiveDirectives(currentStates: WorldStates): ActiveDirectives {
		return extractActiveDirectives(this.blueprints, currentStates);
	}

	public validateMutation(
		key: string,
		targetValue: StateValue,
		currentStates: WorldStates,
	): MutationValidationResult {
		// Gauge evaluation
		const gauge = this.gaugeMap.get(key);
		if (gauge) {
			if (typeof targetValue !== "number") {
				return {
					allowed: false,
					error: `Gauge "${key}" requires numeric values, received: ${typeof targetValue}.`,
				};
			}

			const rawCurrent = currentStates[key];
			const currentVal = typeof rawCurrent === "number" ? rawCurrent : gauge.defaultValue;
			const clampedValue = clampGaugeDelta(currentVal, targetValue, gauge);
			const crossing = detectTierCrossings(currentVal, clampedValue, gauge);

			return {
				allowed: true,
				mutation: {
					key,
					value: clampedValue,
					previousValue: currentVal,
					clamped: clampedValue !== targetValue,
					transitionOperations: crossing.operations,
				},
			};
		}

		// FSM evaluation
		const fsm = this.fsmMap.get(key);
		if (fsm) {
			if (typeof targetValue !== "string") {
				return {
					allowed: false,
					error: `State machine "${key}" requires string state names, received: ${typeof targetValue}.`,
				};
			}

			const rawCurrent = currentStates[key];
			const currentState = typeof rawCurrent === "string" ? rawCurrent : fsm.initialState;
			const evalResult = evaluateFsmTransition(
				currentState,
				targetValue,
				fsm,
				currentStates,
				this.blueprints,
			);

			if (!evalResult.allowed) {
				return {
					allowed: false,
					error: evalResult.reason ?? `Transition to "${targetValue}" is not permitted.`,
				};
			}

			return {
				allowed: true,
				mutation: {
					key,
					value: targetValue,
					previousValue: currentState,
					clamped: false,
					transitionOperations: [],
				},
			};
		}

		// Baseline key-value state
		const prev = currentStates[key] ?? null;

		return {
			allowed: true,
			mutation: {
				key,
				value: targetValue,
				previousValue: prev,
				clamped: false,
				transitionOperations: [],
			},
		};
	}
}
