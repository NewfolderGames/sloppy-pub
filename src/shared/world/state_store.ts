import { getStateValueType, UniverseCoordinator, validateStateValue } from "../universe/coordinator.ts";
import { validateStateKey } from "./toml.ts";
import type { ActiveDirectives } from "./semantic/validation_engine.ts";
import { SemanticValidationEngine } from "./semantic/validation_engine.ts";
import type {
	SemanticBlueprints,
	StateChangeEvent,
	StateChangeListener,
	StateOperation,
	StateValue,
	UniverseStateChangeEvent,
	WorldStates,
} from "./types.ts";

export interface AttachUniverseOptions {
	coordinator: UniverseCoordinator;
	universeId: string;
	mode: "isolated" | "synchronized";
	instanceId: string;
}

export interface SetStateResult {
	previousValue: StateValue | null;
	newValue: StateValue;
}

export interface PatchStateResult {
	appliedCount: number;
	updates: WorldStates;
}

export interface ApplyOperationsResult {
	appliedCount: number;
	operations: StateOperation[];
}

// Deep Clone Helper

function cloneStateValue(value: StateValue): StateValue {

	if (Array.isArray(value)) {
		return [...value];
	}

	return value;

}

function cloneWorldStates(states: WorldStates): WorldStates {

	const result: WorldStates = {};

	for (const [key, value] of Object.entries(states)) {
		result[key] = cloneStateValue(value);
	}

	return result;

}

export class StateStore {

	private states: WorldStates;
	private listeners: Set<StateChangeListener>;
	private currentSnapshot: WorldStates = {};
	private isSnapshotDirty: boolean = true;
	private validationEngine: SemanticValidationEngine;
	private activeDirectivesCache?: ActiveDirectives;
	private isDirectivesDirty: boolean = true;

	// Universe Coordination

	private universeCoordinator?: UniverseCoordinator;
	private universeId?: string;
	private universeMode?: "isolated" | "synchronized";
	private instanceId?: string;
	private unsubscribeUniverse?: () => void;
	private isSyncingFromRemote: boolean = false;

	public constructor(initialStates?: WorldStates, blueprints?: SemanticBlueprints) {

		this.states = {};
		this.listeners = new Set<StateChangeListener>();
		this.validationEngine = new SemanticValidationEngine(blueprints);

		if (blueprints?.gauges) {
			for (const gauge of blueprints.gauges) {
				this.states[gauge.key] = gauge.defaultValue;
			}
		}

		if (blueprints?.stateMachines) {
			for (const fsm of blueprints.stateMachines) {
				this.states[fsm.key] = fsm.initialState;
			}
		}

		if (initialStates) {
			for (const [key, value] of Object.entries(initialStates)) {
				validateStateKey(key);
				const validatedValue = validateStateValue(value);
				this.states[key] = cloneStateValue(validatedValue);
			}
		}

	}

	// Semantic Blueprints & Directives

	public getBlueprints(): SemanticBlueprints {

		return this.validationEngine.getBlueprints();

	}

	public getValidationEngine(): SemanticValidationEngine {

		return this.validationEngine;

	}

	public setBlueprints(blueprints: SemanticBlueprints): void {

		this.validationEngine = new SemanticValidationEngine(blueprints);
		this.isDirectivesDirty = true;

		if (blueprints.gauges) {
			for (const gauge of blueprints.gauges) {
				if (this.states[gauge.key] === undefined) {
					this.states[gauge.key] = gauge.defaultValue;
				}
			}
		}

		if (blueprints.stateMachines) {
			for (const fsm of blueprints.stateMachines) {
				if (this.states[fsm.key] === undefined) {
					this.states[fsm.key] = fsm.initialState;
				}
			}
		}

	}

	public getActiveDirectives(): ActiveDirectives {

		if (this.isDirectivesDirty || !this.activeDirectivesCache) {
			this.activeDirectivesCache = this.validationEngine.extractActiveDirectives(this.states);
			this.isDirectivesDirty = false;
		}

		return this.activeDirectivesCache;

	}

	public getActiveDirectiveStrings(): string[] {

		return this.getActiveDirectives().allDirectives;

	}

	// State Accessors

	public getState(key: string): StateValue | undefined {

		const value = this.states[key];
		if (value === undefined) {
			return undefined;
		}

		return cloneStateValue(value);

	}

	public hasState(key: string): boolean {

		return Object.prototype.hasOwnProperty.call(this.states, key);

	}

	public getAllStates(): WorldStates {

		return cloneWorldStates(this.states);

	}

	public readStates(keys?: string[]): WorldStates {

		if (!keys || keys.length === 0) {
			return this.getAllStates();
		}

		const result: WorldStates = {};

		for (const key of keys) {
			if (this.hasState(key)) {
				result[key] = cloneStateValue(this.states[key]);
			}
		}

		return result;

	}

	// State Mutations

	public setState(
		key: string,
		value: unknown,
		reason?: string,
		source: "local" | "remote" | "rollback" | "initial" = "local",
	): SetStateResult {

		validateStateKey(key);
		const validatedValue = validateStateValue(value);

		let previousValue: StateValue | null = null;

		if (this.hasState(key)) {
			const existingValue = this.states[key];
			const existingType = getStateValueType(existingValue);
			const newType = getStateValueType(validatedValue);

			if (existingType !== newType) {
				throw new Error(
					`Type mismatch for key '${key}'. Expected ${existingType}, got ${newType}.`,
				);
			}

			previousValue = cloneStateValue(existingValue);
		}

		// Semantic Validation Check
		const validationResult = this.validationEngine.validateMutation(key, validatedValue, this.states);
		if (!validationResult.allowed) {
			throw new Error(validationResult.error ?? `Mutation rejected for key '${key}'.`);
		}

		const finalValue = validationResult.mutation?.value !== undefined
			? validationResult.mutation.value
			: validatedValue;

		this.states[key] = cloneStateValue(finalValue);
		this.isSnapshotDirty = true;
		this.isDirectivesDirty = true;

		// Execute transition operations triggered by tier crossings
		if (validationResult.mutation && validationResult.mutation.transitionOperations.length > 0) {
			for (const op of validationResult.mutation.transitionOperations) {
				if (op.type === "set") {
					this.setState(op.key, op.value, reason, source);
				}
				else if (op.type === "delete") {
					this.deleteState(op.key);
				}
			}
		}

		// Synchronize with Universe Coordinator

		if (
			source === "local"
			&& !this.isSyncingFromRemote
			&& this.universeMode === "synchronized"
			&& this.universeCoordinator
			&& this.universeId
			&& this.instanceId
			&& this.universeCoordinator.isUniverseNamespace(key)
		) {
			this.universeCoordinator.mutateState(
				this.universeId,
				this.instanceId,
				key,
				finalValue,
				reason,
			);
		}

		// Emit Local Event

		this.emitEvent({
			type: "state:updated",
			key,
			previousValue,
			newValue: cloneStateValue(finalValue),
			reason,
			source,
			timestamp: Date.now(),
		});

		return {
			previousValue,
			newValue: cloneStateValue(finalValue),
		};

	}

	public patchStates(
		updates: Record<string, unknown>,
		reason?: string,
		source: "local" | "remote" | "rollback" | "initial" = "local",
	): PatchStateResult {

		if (typeof updates !== "object" || updates === null || Array.isArray(updates)) {
			throw new Error("Updates must be a key-value dictionary");
		}

		// Validation Phase (Atomic Check)

		const simulatedStates: WorldStates = cloneWorldStates(this.states);
		const validatedEntries: Array<{ key: string; value: StateValue }> = [];

		for (const [key, value] of Object.entries(updates)) {
			validateStateKey(key);
			const validatedValue = validateStateValue(value);

			if (this.hasState(key)) {
				const existingValue = this.states[key];
				const existingType = getStateValueType(existingValue);
				const newType = getStateValueType(validatedValue);

				if (existingType !== newType) {
					throw new Error(
						`Type mismatch for key '${key}'. Expected ${existingType}, got ${newType}.`,
					);
				}
			}

			const validationResult = this.validationEngine.validateMutation(key, validatedValue, simulatedStates);
			if (!validationResult.allowed) {
				throw new Error(validationResult.error ?? `Mutation rejected for key '${key}'.`);
			}

			const finalValue = validationResult.mutation?.value !== undefined
				? validationResult.mutation.value
				: validatedValue;

			simulatedStates[key] = cloneStateValue(finalValue);
			validatedEntries.push({ key, value: finalValue });
		}

		// Mutation Phase

		const appliedUpdates: WorldStates = {};

		for (const entry of validatedEntries) {
			this.setState(entry.key, entry.value, reason, source);
			appliedUpdates[entry.key] = cloneStateValue(this.states[entry.key]);
		}

		return {
			appliedCount: validatedEntries.length,
			updates: appliedUpdates,
		};

	}

	public applyOperations(
		operations: StateOperation[],
		reason?: string,
		source: "local" | "remote" | "rollback" | "initial" = "local",
	): ApplyOperationsResult {

		if (!Array.isArray(operations)) {
			throw new Error("Operations must be an array");
		}

		// Validation Phase (Atomic Check)

		const simulatedStates: WorldStates = cloneWorldStates(this.states);
		const simulatedTypes = new Map<string, string | null>();
		const validatedOperations: StateOperation[] = [];

		for (const op of operations) {
			if (!op || typeof op !== "object") {
				throw new Error("Each operation must be an object");
			}

			if (op.type !== "set" && op.type !== "delete") {
				throw new Error(
					`Invalid operation type: '${(op as { type: string }).type}'. Expected 'set' or 'delete'.`,
				);
			}

			validateStateKey(op.key);

			if (op.type === "set") {
				if (op.value === undefined) {
					throw new Error(`Field 'value' is required for 'set' operation on key '${op.key}'`);
				}

				const validatedValue = validateStateValue(op.value);
				const newType = getStateValueType(validatedValue);

				const currentType = simulatedTypes.has(op.key)
					? simulatedTypes.get(op.key)
					: (this.hasState(op.key) ? getStateValueType(this.states[op.key]) : undefined);

				if (currentType !== undefined && currentType !== null && currentType !== newType) {
					throw new Error(
						`Type mismatch for key '${op.key}'. Expected ${currentType}, got ${newType}.`,
					);
				}

				const validationResult = this.validationEngine.validateMutation(op.key, validatedValue, simulatedStates);
				if (!validationResult.allowed) {
					throw new Error(validationResult.error ?? `Mutation rejected for key '${op.key}'.`);
				}

				const finalValue = validationResult.mutation?.value !== undefined
					? validationResult.mutation.value
					: validatedValue;

				simulatedTypes.set(op.key, newType);
				simulatedStates[op.key] = cloneStateValue(finalValue);

				validatedOperations.push({
					type: "set",
					key: op.key,
					value: finalValue,
				});
			}
			else if (op.type === "delete") {
				simulatedTypes.set(op.key, null);
				delete simulatedStates[op.key];

				validatedOperations.push({
					type: "delete",
					key: op.key,
				});
			}
		}

		// Mutation Phase

		for (const op of validatedOperations) {
			if (op.type === "set") {
				this.setState(op.key, op.value, reason, source);
			}
			else if (op.type === "delete") {
				this.deleteState(op.key);
			}
		}

		return {
			appliedCount: validatedOperations.length,
			operations: validatedOperations,
		};

	}

	public deleteState(key: string): boolean {

		if (!this.hasState(key)) {
			return false;
		}

		delete this.states[key];
		this.isSnapshotDirty = true;
		this.isDirectivesDirty = true;

		return true;

	}

	// Snapshot and Rollback

	public createSnapshot(): WorldStates {

		return cloneWorldStates(this.states);

	}

	public getSnapshot(): WorldStates {

		if (this.isSnapshotDirty) {
			this.currentSnapshot = cloneWorldStates(this.states);
			this.isSnapshotDirty = false;
		}

		return this.currentSnapshot;

	}

	public restoreSnapshot(snapshot: WorldStates): void {

		const newStates: WorldStates = {};

		for (const [key, value] of Object.entries(snapshot)) {
			validateStateKey(key);
			const validatedValue = validateStateValue(value);
			newStates[key] = cloneStateValue(validatedValue);
		}

		this.states = newStates;
		this.isSnapshotDirty = true;
		this.isDirectivesDirty = true;

		this.emitEvent({
			type: "state:updated",
			key: "*",
			previousValue: null,
			newValue: "",
			source: "rollback",
			timestamp: Date.now(),
		});

	}

	// Subscriptions

	public subscribe(listener: StateChangeListener): () => void {

		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};

	}

	private emitEvent(event: StateChangeEvent): void {

		for (const listener of this.listeners) {
			listener(event);
		}

	}

	// Universe Coordination Attachment

	public attachUniverse(options: AttachUniverseOptions): void {

		this.detachUniverse();

		this.universeCoordinator = options.coordinator;
		this.universeId = options.universeId;
		this.universeMode = options.mode;
		this.instanceId = options.instanceId;

		if (options.mode === "isolated") {
			const isolatedStates = options.coordinator.createIsolatedSnapshot(options.universeId);
			for (const [key, value] of Object.entries(isolatedStates)) {
				if (!this.hasState(key)) {
					this.states[key] = cloneStateValue(value);
				}
			}
		}
		else if (options.mode === "synchronized") {
			const universeStates = options.coordinator.getUniverseStates(options.universeId);
			for (const [key, value] of Object.entries(universeStates)) {
				this.states[key] = cloneStateValue(value);
			}

			this.unsubscribeUniverse = options.coordinator.attachInstance(
				options.universeId,
				options.instanceId,
				(event: UniverseStateChangeEvent) => {
					this.handleRemoteUniverseUpdate(event);
				},
			);
		}

	}

	public detachUniverse(): void {

		if (this.unsubscribeUniverse) {
			this.unsubscribeUniverse();
			this.unsubscribeUniverse = undefined;
		}

		this.universeCoordinator = undefined;
		this.universeId = undefined;
		this.universeMode = undefined;
		this.instanceId = undefined;

	}

	private handleRemoteUniverseUpdate(event: UniverseStateChangeEvent): void {

		this.isSyncingFromRemote = true;

		try {
			this.setState(event.key, event.value, event.reason, "remote");
		}
		finally {
			this.isSyncingFromRemote = false;
		}

	}

}
