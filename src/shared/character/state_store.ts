import type { CharacterInstance } from "./types.ts";
import type { StateValue } from "../world/types.ts";

export type CharacterCategory = "thought" | "emotion" | "goal" | "state";

export type CharacterOperationType = "set" | "delete";

export interface CharacterOperation {
	type: CharacterOperationType;
	category: CharacterCategory | string;
	id?: string;
	title?: string;
	name?: string;
	internal_monologue?: string;
	key?: string;
	value?: StateValue;
}

export interface CharacterMutationResult {
	status: "success" | "error";
	message?: string;
	applied_count?: number;
	character?: CharacterInstance;
}

export type CharacterChangeListener = (instances: CharacterInstance[]) => void;

function cloneInstances(instances: CharacterInstance[]): CharacterInstance[] {
	return instances.map(inst => ({
		id: inst.id,
		characterId: inst.characterId,
		name: inst.name,
		isNpc: inst.isNpc,
		thoughts: inst.thoughts.map(t => ({ ...t })),
		emotions: inst.emotions.map(e => ({ ...e })),
		goals: inst.goals.map(g => ({ ...g })),
		states: Object.fromEntries(
			Object.entries(inst.states).map(([k, v]) => [
				k,
				Array.isArray(v) ? [...v] : v,
			]),
		),
	}));
}

function normalizeCategory(category: string): CharacterCategory | null {
	const lower = category.toLowerCase().trim().replace(/s$/, "");

	if (lower === "thought" || lower === "emotion" || lower === "goal" || lower === "state") {
		return lower as CharacterCategory;
	}

	return null;
}

function generateItemId(prefix: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);

	return `${prefix}_${timestamp}_${random}`;
}

export class CharacterStateStore {

	private instances: CharacterInstance[];
	private listeners: Set<CharacterChangeListener>;

	public constructor(initialInstances?: CharacterInstance[]) {

		this.instances = initialInstances ? cloneInstances(initialInstances) : [];
		this.listeners = new Set<CharacterChangeListener>();

	}

	// Subscriptions

	public subscribe(listener: CharacterChangeListener): () => void {

		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};

	}

	private notifyListeners(): void {

		const snapshot = cloneInstances(this.instances);

		for (const listener of this.listeners) {
			listener(snapshot);
		}

	}

	// Instance Accessors

	public getAllInstances(): CharacterInstance[] {

		return cloneInstances(this.instances);

	}

	public getInstance(identifier: string): CharacterInstance | undefined {

		if (!identifier || typeof identifier !== "string") {
			return undefined;
		}

		const query = identifier.trim().toLowerCase();

		const found = this.instances.find(
			inst =>
				inst.id.toLowerCase() === query
				|| (inst.characterId?.toLowerCase() ?? "") === query
				|| inst.name.toLowerCase() === query,
		);

		if (!found) {
			return undefined;
		}

		return cloneInstances([found])[0];

	}

	public hasInstance(identifier: string): boolean {

		return this.getInstance(identifier) !== undefined;

	}

	public setInstances(instances: CharacterInstance[]): void {

		this.instances = cloneInstances(instances);
		this.notifyListeners();

	}

	public addInstance(instance: CharacterInstance): void {

		const existing = this.getInstance(instance.id);
		if (existing) {
			throw new Error(`Character instance with id "${instance.id}" already exists.`);
		}

		this.instances.push(cloneInstances([instance])[0]);
		this.notifyListeners();

	}

	public removeInstance(identifier: string): boolean {

		const initialLength = this.instances.length;
		const query = identifier.trim().toLowerCase();

		this.instances = this.instances.filter(
			inst =>
				inst.id.toLowerCase() !== query
				&& (inst.characterId?.toLowerCase() ?? "") !== query
				&& inst.name.toLowerCase() !== query,
		);

		if (this.instances.length === initialLength) {
			return false;
		}

		this.notifyListeners();

		return true;

	}

	// Thought Operations

	public setThought(
		identifier: string,
		thought: { id?: string; title: string; internal_monologue: string },
	): void {

		const instance = this.findInternalInstance(identifier);

		const targetId = thought.id;
		const targetTitle = thought.title ? thought.title.trim() : "";

		const existingIndex = instance.thoughts.findIndex(
			t =>
				(targetId && t.id === targetId)
				|| (targetTitle && t.title.toLowerCase() === targetTitle.toLowerCase()),
		);

		if (existingIndex >= 0) {
			instance.thoughts[existingIndex] = {
				id: instance.thoughts[existingIndex].id,
				title: targetTitle || instance.thoughts[existingIndex].title,
				internal_monologue: thought.internal_monologue.trim(),
			};
		}
		else {
			instance.thoughts.push({
				id: targetId || generateItemId("thought"),
				title: targetTitle || "Thought",
				internal_monologue: thought.internal_monologue.trim(),
			});
		}

		this.notifyListeners();

	}

	public deleteThought(identifier: string, thoughtIdentifier: string): boolean {

		const instance = this.findInternalInstance(identifier);
		const query = thoughtIdentifier.trim().toLowerCase();
		const initialLength = instance.thoughts.length;

		instance.thoughts = instance.thoughts.filter(
			t => t.id.toLowerCase() !== query && t.title.toLowerCase() !== query,
		);

		if (instance.thoughts.length === initialLength) {
			return false;
		}

		this.notifyListeners();

		return true;

	}

	// Emotion Operations

	public setEmotion(
		identifier: string,
		emotion: { id?: string; name: string; internal_monologue: string },
	): void {

		const instance = this.findInternalInstance(identifier);

		const targetId = emotion.id;
		const targetName = emotion.name ? emotion.name.trim() : "";

		const existingIndex = instance.emotions.findIndex(
			e =>
				(targetId && e.id === targetId)
				|| (targetName && e.name.toLowerCase() === targetName.toLowerCase()),
		);

		if (existingIndex >= 0) {
			instance.emotions[existingIndex] = {
				id: instance.emotions[existingIndex].id,
				name: targetName || instance.emotions[existingIndex].name,
				internal_monologue: emotion.internal_monologue.trim(),
			};
		}
		else {
			instance.emotions.push({
				id: targetId || generateItemId("emotion"),
				name: targetName || "Emotion",
				internal_monologue: emotion.internal_monologue.trim(),
			});
		}

		this.notifyListeners();

	}

	public deleteEmotion(identifier: string, emotionIdentifier: string): boolean {

		const instance = this.findInternalInstance(identifier);
		const query = emotionIdentifier.trim().toLowerCase();
		const initialLength = instance.emotions.length;

		instance.emotions = instance.emotions.filter(
			e => e.id.toLowerCase() !== query && e.name.toLowerCase() !== query,
		);

		if (instance.emotions.length === initialLength) {
			return false;
		}

		this.notifyListeners();

		return true;

	}

	// Goal Operations

	public setGoal(
		identifier: string,
		goal: { id?: string; name: string; internal_monologue: string },
	): void {

		const instance = this.findInternalInstance(identifier);

		const targetId = goal.id;
		const targetName = goal.name ? goal.name.trim() : "";

		const existingIndex = instance.goals.findIndex(
			g =>
				(targetId && g.id === targetId)
				|| (targetName && g.name.toLowerCase() === targetName.toLowerCase()),
		);

		if (existingIndex >= 0) {
			instance.goals[existingIndex] = {
				id: instance.goals[existingIndex].id,
				name: targetName || instance.goals[existingIndex].name,
				internal_monologue: goal.internal_monologue.trim(),
			};
		}
		else {
			instance.goals.push({
				id: targetId || generateItemId("goal"),
				name: targetName || "Goal",
				internal_monologue: goal.internal_monologue.trim(),
			});
		}

		this.notifyListeners();

	}

	public deleteGoal(identifier: string, goalIdentifier: string): boolean {

		const instance = this.findInternalInstance(identifier);
		const query = goalIdentifier.trim().toLowerCase();
		const initialLength = instance.goals.length;

		instance.goals = instance.goals.filter(
			g => g.id.toLowerCase() !== query && g.name.toLowerCase() !== query,
		);

		if (instance.goals.length === initialLength) {
			return false;
		}

		this.notifyListeners();

		return true;

	}

	// State Variable Operations

	public setState(identifier: string, key: string, value: StateValue): void {

		const instance = this.findInternalInstance(identifier);

		if (!key || typeof key !== "string" || key.trim() === "") {
			throw new Error("State key cannot be empty.");
		}

		instance.states[key.trim()] = Array.isArray(value) ? [...value] : value;
		this.notifyListeners();

	}

	public deleteState(identifier: string, key: string): boolean {

		const instance = this.findInternalInstance(identifier);
		const trimmedKey = key.trim();

		if (!(trimmedKey in instance.states)) {
			return false;
		}

		delete instance.states[trimmedKey];
		this.notifyListeners();

		return true;

	}

	// Atomic Batch Mutation

	public applyOperations(
		identifier: string,
		operations: CharacterOperation[],
	): CharacterMutationResult {

		let instance: CharacterInstance;
		try {
			instance = this.findInternalInstance(identifier);
		}
		catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : `Character instance "${identifier}" not found.`,
			};
		}

		if (!Array.isArray(operations)) {
			return {
				status: "error",
				message: "Field 'operations' must be an array.",
			};
		}

		let appliedCount = 0;

		for (let index = 0; index < operations.length; index++) {
			const op = operations[index];

			if (!op || typeof op !== "object") {
				return {
					status: "error",
					message: `Operation at index ${index} must be an object.`,
				};
			}

			if (op.type !== "set" && op.type !== "delete") {
				return {
					status: "error",
					message: `Unsupported operation type "${op.type}". Allowed: set, delete.`,
				};
			}

			const category = normalizeCategory(String(op.category || ""));

			if (!category) {
				return {
					status: "error",
					message: `Unsupported category "${op.category}". Allowed: thought, emotion, goal, state.`,
				};
			}

			if (op.type === "set") {
				if (category === "thought") {
					const title = (op.title || op.name || op.id || "").trim();
					const monologue = (op.internal_monologue || "").trim();

					if (!title && !monologue) {
						return {
							status: "error",
							message: "Set thought operation requires title or internal_monologue.",
						};
					}

					this.setThought(instance.id, {
						id: op.id,
						title: title || "Recent Thought",
						internal_monologue: monologue,
					});

					appliedCount += 1;
					continue;
				}

				if (category === "emotion") {
					const name = (op.name || op.title || op.id || "").trim();
					const monologue = (op.internal_monologue || "").trim();

					if (!name && !monologue) {
						return {
							status: "error",
							message: "Set emotion operation requires name or internal_monologue.",
						};
					}

					this.setEmotion(instance.id, {
						id: op.id,
						name: name || "Recent Emotion",
						internal_monologue: monologue,
					});

					appliedCount += 1;
					continue;
				}

				if (category === "goal") {
					const name = (op.name || op.title || op.id || "").trim();
					const monologue = (op.internal_monologue || "").trim();

					if (!name && !monologue) {
						return {
							status: "error",
							message: "Set goal operation requires name or internal_monologue.",
						};
					}

					this.setGoal(instance.id, {
						id: op.id,
						name: name || "Goal",
						internal_monologue: monologue,
					});

					appliedCount += 1;
					continue;
				}

				if (category === "state") {
					const stateKey = (op.key || op.name || op.id || "").trim();

					if (!stateKey) {
						return {
							status: "error",
							message: "Set state operation requires key.",
						};
					}

					if (op.value === undefined) {
						return {
							status: "error",
							message: "Set state operation requires value.",
						};
					}

					this.setState(instance.id, stateKey, op.value);
					appliedCount += 1;
					continue;
				}
			}

			if (op.type === "delete") {
				const itemTarget = (op.id || op.name || op.title || op.key || "").trim();

				if (!itemTarget) {
					return {
						status: "error",
						message: `Delete ${category} operation requires an identifier (id, name, title, or key).`,
					};
				}

				if (category === "thought") {
					this.deleteThought(instance.id, itemTarget);
					appliedCount += 1;
					continue;
				}

				if (category === "emotion") {
					this.deleteEmotion(instance.id, itemTarget);
					appliedCount += 1;
					continue;
				}

				if (category === "goal") {
					this.deleteGoal(instance.id, itemTarget);
					appliedCount += 1;
					continue;
				}

				if (category === "state") {
					this.deleteState(instance.id, itemTarget);
					appliedCount += 1;
					continue;
				}
			}
		}

		return {
			status: "success",
			applied_count: appliedCount,
			character: this.getInstance(instance.id),
		};

	}

	// Internal helper

	private findInternalInstance(identifier: string): CharacterInstance {

		if (!identifier || typeof identifier !== "string") {
			throw new Error("Character identifier must be a non-empty string.");
		}

		const query = identifier.trim().toLowerCase();

		const found = this.instances.find(
			inst =>
				inst.id.toLowerCase() === query
				|| (inst.characterId?.toLowerCase() ?? "") === query
				|| inst.name.toLowerCase() === query,
		);

		if (!found) {
			throw new Error(`Character instance "${identifier}" not found.`);
		}

		return found;

	}

}
