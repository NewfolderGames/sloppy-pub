import { getStateValueType, UniverseCoordinator, validateStateValue } from "../universe/coordinator.ts";
import { validateStateKey } from "./toml.ts";
import type { StateChangeEvent, StateChangeListener, StateOperation, StateValue, UniverseStateChangeEvent, WorldStates } from "./types.ts";

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

	// Universe Coordination

	private universeCoordinator?: UniverseCoordinator;
	private universeId?: string;
	private universeMode?: "isolated" | "synchronized";
	private instanceId?: string;
	private unsubscribeUniverse?: () => void;
	private isSyncingFromRemote: boolean = false;

	public constructor(initialStates?: WorldStates) {

		this.states = {};
		this.listeners = new Set<StateChangeListener>();

		if (initialStates) {
			for (const [key, value] of Object.entries(initialStates)) {
				validateStateKey(key);
				const validatedValue = validateStateValue(value);
				this.states[key] = cloneStateValue(validatedValue);
			}
		}

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

		this.states[key] = cloneStateValue(validatedValue);
		this.isSnapshotDirty = true;

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
				validatedValue,
				reason,
			);
		}

		// Emit Local Event

		this.emitEvent({
			type: "state:updated",
			key,
			previousValue,
			newValue: cloneStateValue(validatedValue),
			reason,
			source,
			timestamp: Date.now(),
		});

		return {
			previousValue,
			newValue: cloneStateValue(validatedValue),
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

			validatedEntries.push({ key, value: validatedValue });
		}

		// Mutation Phase

		const appliedUpdates: WorldStates = {};

		for (const entry of validatedEntries) {
			this.setState(entry.key, entry.value, reason, source);
			appliedUpdates[entry.key] = cloneStateValue(entry.value);
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

				simulatedTypes.set(op.key, newType);

				validatedOperations.push({
					type: "set",
					key: op.key,
					value: validatedValue,
				});
			}
			else if (op.type === "delete") {
				simulatedTypes.set(op.key, null);

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
