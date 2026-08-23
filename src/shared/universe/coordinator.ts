import { validateStateKey } from "../world/toml.ts";
import type { StateValue, Universefile, UniverseStateChangeEvent, UniverseStateRecord, WorldStates } from "../world/types.ts";

export interface UniverseRegistrationOptions {
	initialStates?: WorldStates;
	rules?: string[];
	backgrounds?: string[];
}

export interface UniverseMutationResult {
	success: boolean;
	applied: boolean;
	currentRecord: UniverseStateRecord;
}

export interface UniversePatchResult {
	success: boolean;
	appliedCount: number;
	updates: WorldStates;
}

export type UniverseSubscriber = (event: UniverseStateChangeEvent) => void;

interface UniverseEntry {
	universeId: string;
	rules: string[];
	backgrounds: string[];
	sequence: number;
	states: Map<string, UniverseStateRecord>;
	subscribers: Map<string, UniverseSubscriber>;
}

// Validation Helpers

export function validateStateValue(value: unknown): StateValue {

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		if (typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))) {
			throw new Error("Number state value must be finite and not NaN");
		}

		return value;
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return value as StateValue;
		}

		const firstType = typeof value[0];
		if (firstType !== "string" && firstType !== "number" && firstType !== "boolean") {
			throw new Error("Array elements must be string, number, or boolean primitives");
		}

		for (const item of value) {
			if (typeof item !== firstType) {
				throw new Error("Array elements must be homogeneous primitive types");
			}
			if (typeof item === "number" && (!Number.isFinite(item) || Number.isNaN(item))) {
				throw new Error("Number elements in array must be finite and not NaN");
			}
		}

		return [...value] as StateValue;
	}

	throw new Error(`Invalid state value type: ${typeof value}`);

}

export function getStateValueType(value: StateValue): string {

	if (Array.isArray(value)) {
		return "array";
	}

	return typeof value;

}

export class UniverseCoordinator {

	private static instance: UniverseCoordinator | null = null;
	private universes: Map<string, UniverseEntry>;

	public constructor() {

		this.universes = new Map<string, UniverseEntry>();

	}

	public static getInstance(): UniverseCoordinator {

		if (!UniverseCoordinator.instance) {
			UniverseCoordinator.instance = new UniverseCoordinator();
		}

		return UniverseCoordinator.instance;

	}

	// Universe Registration

	public registerUniverse(
		universeId: string,
		options?: UniverseRegistrationOptions,
	): void {

		const initialStates = options?.initialStates ?? {};
		const rules = options?.rules ?? [];
		const backgrounds = options?.backgrounds ?? [];

		let entry = this.universes.get(universeId);

		if (!entry) {
			entry = {
				universeId,
				rules: [...rules],
				backgrounds: [...backgrounds],
				sequence: 0,
				states: new Map<string, UniverseStateRecord>(),
				subscribers: new Map<string, UniverseSubscriber>(),
			};
			this.universes.set(universeId, entry);
		}
		else {
			entry.rules = [...rules];
			entry.backgrounds = [...backgrounds];
		}

		const now = Date.now();

		for (const [key, value] of Object.entries(initialStates)) {
			validateStateKey(key);
			const validatedValue = validateStateValue(value);

			if (!entry.states.has(key)) {
				entry.sequence += 1;
				entry.states.set(key, {
					value: validatedValue,
					version: entry.sequence,
					timestamp: now,
					lastModifiedBy: "initial",
				});
			}
		}

	}

	public registerUniversefile(universefile: Universefile): void {

		this.registerUniverse(universefile.metadata.name, {
			initialStates: universefile.states,
			rules: universefile.settings?.rules ?? [],
			backgrounds: universefile.settings?.backgrounds ?? [],
		});

	}

	public hasUniverse(universeId: string): boolean {

		return this.universes.has(universeId);

	}

	public getUniverseRules(universeId: string): string[] {

		const entry = this.universes.get(universeId);
		if (!entry) {
			return [];
		}

		return [...entry.rules];

	}

	public getUniverseBackgrounds(universeId: string): string[] {

		const entry = this.universes.get(universeId);
		if (!entry) {
			return [];
		}

		return [...entry.backgrounds];

	}

	public getUniverseStates(universeId: string): WorldStates {

		const entry = this.universes.get(universeId);
		if (!entry) {
			return {};
		}

		const result: WorldStates = {};

		for (const [key, record] of entry.states.entries()) {
			result[key] = Array.isArray(record.value) ? [...record.value] : record.value;
		}

		return result;

	}

	public getStateRecord(universeId: string, key: string): UniverseStateRecord | undefined {

		const entry = this.universes.get(universeId);
		if (!entry) {
			return undefined;
		}

		const record = entry.states.get(key);
		if (!record) {
			return undefined;
		}

		return {
			...record,
			value: Array.isArray(record.value) ? [...record.value] : record.value,
		};

	}

	// Isolated Snapshot Inheritance

	public createIsolatedSnapshot(universeId: string): WorldStates {

		return this.getUniverseStates(universeId);

	}

	// Subscriptions

	public attachInstance(
		universeId: string,
		instanceId: string,
		onUpdate: UniverseSubscriber,
	): () => void {

		if (!this.universes.has(universeId)) {
			this.registerUniverse(universeId);
		}

		const entry = this.universes.get(universeId)!;
		entry.subscribers.set(instanceId, onUpdate);

		return () => {
			this.detachInstance(universeId, instanceId);
		};

	}

	public detachInstance(universeId: string, instanceId: string): void {

		const entry = this.universes.get(universeId);
		if (!entry) {
			return;
		}

		entry.subscribers.delete(instanceId);

	}

	// Namespace Resolution

	public isUniverseNamespace(key: string): boolean {

		return key.startsWith("world.") || key.startsWith("universe.");

	}

	// State Mutations with LWW

	public mutateState(
		universeId: string,
		instanceId: string,
		key: string,
		value: StateValue,
		reason?: string,
		incomingVersion?: number,
		incomingTimestamp?: number,
	): UniverseMutationResult {

		validateStateKey(key);
		const validatedValue = validateStateValue(value);

		if (!this.universes.has(universeId)) {
			this.registerUniverse(universeId);
		}

		const entry = this.universes.get(universeId)!;
		const existingRecord = entry.states.get(key);
		const targetTimestamp = incomingTimestamp ?? Date.now();

		if (existingRecord) {
			// Type compatibility check

			const existingType = getStateValueType(existingRecord.value);
			const newType = getStateValueType(validatedValue);

			if (existingType !== newType) {
				throw new Error(
					`Type mismatch for key '${key}'. Expected ${existingType}, got ${newType}.`,
				);
			}

			// Last-Write-Wins conflict resolution

			if (incomingTimestamp !== undefined && incomingTimestamp < existingRecord.timestamp) {
				return {
					success: true,
					applied: false,
					currentRecord: { ...existingRecord },
				};
			}

			if (incomingVersion !== undefined && incomingVersion < existingRecord.version) {
				return {
					success: true,
					applied: false,
					currentRecord: { ...existingRecord },
				};
			}
		}

		entry.sequence += 1;
		const version = entry.sequence;
		const finalTimestamp = Math.max(
			targetTimestamp,
			existingRecord ? existingRecord.timestamp + 1 : targetTimestamp,
		);

		const previousValue = existingRecord
			? Array.isArray(existingRecord.value)
				? [...existingRecord.value]
				: existingRecord.value
			: null;

		const newRecord: UniverseStateRecord = {
			value: Array.isArray(validatedValue) ? [...validatedValue] : validatedValue,
			version,
			timestamp: finalTimestamp,
			lastModifiedBy: instanceId,
		};

		entry.states.set(key, newRecord);

		// Broadcast to all subscribers

		const event: UniverseStateChangeEvent = {
			universeId,
			key,
			value: Array.isArray(validatedValue) ? [...validatedValue] : validatedValue,
			previousValue,
			version,
			timestamp: finalTimestamp,
			modifiedBy: instanceId,
			reason,
		};

		for (const subscriber of entry.subscribers.values()) {
			subscriber(event);
		}

		return {
			success: true,
			applied: true,
			currentRecord: { ...newRecord },
		};

	}

	public mutatePatch(
		universeId: string,
		instanceId: string,
		updates: Record<string, StateValue>,
		reason?: string,
	): UniversePatchResult {

		if (!this.universes.has(universeId)) {
			this.registerUniverse(universeId);
		}

		const entry = this.universes.get(universeId)!;

		// Validation Phase (atomic)

		const validatedEntries: Array<{ key: string; value: StateValue }> = [];

		for (const [key, value] of Object.entries(updates)) {
			validateStateKey(key);
			const validatedValue = validateStateValue(value);

			const existingRecord = entry.states.get(key);
			if (existingRecord) {
				const existingType = getStateValueType(existingRecord.value);
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

		for (const item of validatedEntries) {
			this.mutateState(universeId, instanceId, item.key, item.value, reason);
			appliedUpdates[item.key] = item.value;
		}

		return {
			success: true,
			appliedCount: validatedEntries.length,
			updates: appliedUpdates,
		};

	}

	public clear(): void {

		this.universes.clear();

	}

}
