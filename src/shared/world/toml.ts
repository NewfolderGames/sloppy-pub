import { parse } from "smol-toml";
import { stringifyToml } from "../toml/stringify.ts";
import type {
	ArgumentDefinition,
	ArgumentType,
	ContentPlotIncident,
	ContentPlotIncidentItem,
	ContentPlotIntro,
	ContentPlotIntroItem,
	ContentSettings,
	FsmBlueprint,
	FsmGuard,
	FsmTransition,
	GaugeBlueprint,
	GaugeTier,
	InventoryBlueprint,
	SemanticBlueprints,
	StateOperation,
	StatePrimitive,
	StateValue,
	Universefile,
	Worldfile,
	WorldfileContent,
	WorldfileFeelingLucky,
	WorldfileMetadata,
	WorldStates,
} from "./types.ts";

const VALID_ARG_TYPES: readonly ArgumentType[] = [
	"text",
	"number",
	"boolean",
	"select",
	"radio",
	"checkbox",
];

const VALID_PLOT_INTRO_MODES = ["random", "user_select", "dynamic"] as const;
const VALID_INCIDENT_TRIGGERS = ["dice_roll", "periodic", "manual"] as const;

// Validation and Error Helpers

function assertObject(value: unknown, fieldName: string): asserts value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Field "${fieldName}" must be an object.`);
	}
}

function assertString(value: unknown, fieldName: string, allowEmpty = false): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`Field "${fieldName}" must be a string.`);
	}

	if (!allowEmpty && value.trim() === "") {
		throw new Error(`Field "${fieldName}" cannot be empty.`);
	}
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`Field "${fieldName}" must be an array of strings.`);
	}

	for (let index = 0; index < value.length; index++) {
		if (typeof value[index] !== "string") {
			throw new Error(`Item at index ${index} in "${fieldName}" must be a string.`);
		}
	}
}

export function validateStateKey(key: string): void {
	if (typeof key !== "string" || key.trim() === "") {
		throw new Error(`State key cannot be empty.`);
	}

	if (/\s/.test(key)) {
		throw new Error(`Invalid state key "${key}": whitespace is not permitted.`);
	}

	const segments = key.split(".");

	for (const segment of segments) {
		if (segment === "") {
			throw new Error(`Invalid state key "${key}": empty segment found.`);
		}
	}
}

function isPrimitive(value: unknown): value is StatePrimitive {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function flattenStates(rawStates: unknown, prefix = ""): WorldStates {
	if (rawStates === null || typeof rawStates !== "object" || Array.isArray(rawStates)) {
		throw new Error("States definition must be an object table.");
	}

	const result: WorldStates = {};
	const entries = Object.entries(rawStates as Record<string, unknown>);

	for (const [key, value] of entries) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		validateStateKey(fullKey);

		if (isPrimitive(value)) {
			result[fullKey] = value;
			continue;
		}

		if (Array.isArray(value)) {
			if (value.length === 0) {
				result[fullKey] = [];
				continue;
			}

			const firstType = typeof value[0];
			if (!isPrimitive(value[0])) {
				throw new Error(`State array "${fullKey}" contains non-primitive values.`);
			}

			for (let index = 0; index < value.length; index++) {
				const item = value[index];
				if (!isPrimitive(item) || typeof item !== firstType) {
					throw new Error(`State array "${fullKey}" must contain homogeneous primitive values.`);
				}
			}

			result[fullKey] = [...value] as StateValue;
			continue;
		}

		if (value !== null && typeof value === "object") {
			const nested = flattenStates(value, fullKey);
			Object.assign(result, nested);
			continue;
		}

		throw new Error(`State value for key "${fullKey}" has unsupported type.`);
	}

	return result;
}

// Argument and Variable Schema Parsers

function parseParamDefinition(
	raw: unknown,
	index: number,
	category: "args" | "vars",
): ArgumentDefinition {
	assertObject(raw, `${category}[${index}]`);

	assertString(raw.name, `${category}[${index}].name`);

	if (typeof raw.type !== "string" || !VALID_ARG_TYPES.includes(raw.type as ArgumentType)) {
		throw new Error(
			`Field "${category}[${index}].type" must be one of: ${VALID_ARG_TYPES.join(", ")}.`,
		);
	}

	const param: ArgumentDefinition = {
		name: raw.name,
		type: raw.type as ArgumentType,
	};

	if (raw.description !== undefined) {
		assertString(raw.description, `${category}[${index}].description`, true);
		param.description = raw.description;
	}

	if (raw.default !== undefined) {
		if (!isPrimitive(raw.default)) {
			throw new Error(`Field "${category}[${index}].default" must be a primitive value.`);
		}
		param.default = raw.default;
	}

	if (raw.optional !== undefined) {
		if (typeof raw.optional !== "boolean") {
			throw new Error(`Field "${category}[${index}].optional" must be a boolean.`);
		}
		param.optional = raw.optional;
	}

	if (raw.multiline !== undefined) {
		if (typeof raw.multiline !== "boolean") {
			throw new Error(`Field "${category}[${index}].multiline" must be a boolean.`);
		}
		param.multiline = raw.multiline;
	}

	if (raw.format !== undefined) {
		assertString(raw.format, `${category}[${index}].format`);
		param.format = raw.format;
	}

	if (raw.range !== undefined) {
		assertString(raw.range, `${category}[${index}].range`);
		param.range = raw.range;
	}

	if (raw.values !== undefined) {
		assertStringArray(raw.values, `${category}[${index}].values`);
		param.values = raw.values;
	}

	if (raw.multiple !== undefined) {
		if (typeof raw.multiple !== "boolean") {
			throw new Error(`Field "${category}[${index}].multiple" must be a boolean.`);
		}
		param.multiple = raw.multiple;
	}

	return param;
}

function parseMetadata(raw: Record<string, unknown>): WorldfileMetadata {
	const source = raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
		? (raw.metadata as Record<string, unknown>)
		: raw;

	const rawName = source.name !== undefined ? source.name : raw.name;
	const rawVersion = source.version !== undefined ? source.version : raw.version;
	const rawTitle = source.title !== undefined ? source.title : raw.title;
	const rawDescription = source.description !== undefined ? source.description : raw.description;

	assertString(rawName, "name");
	assertString(rawVersion, "version");
	assertString(rawTitle, "title");
	assertString(rawDescription, "description", true);

	const metadata: WorldfileMetadata = {
		name: (rawName as string).trim(),
		version: (rawVersion as string).trim(),
		title: (rawTitle as string).trim(),
		description: (rawDescription as string).trim(),
	};

	const rawAuthors = source.authors !== undefined ? source.authors : raw.authors;

	if (rawAuthors !== undefined) {
		if (typeof rawAuthors === "string") {
			metadata.authors = [rawAuthors.trim()];
		}
		else {
			assertStringArray(rawAuthors, "authors");
			metadata.authors = rawAuthors;
		}
	}

	const rawTags = source.tags !== undefined ? source.tags : raw.tags;

	if (rawTags !== undefined) {
		if (typeof rawTags === "string") {
			metadata.tags = [rawTags.trim()];
		}
		else {
			assertStringArray(rawTags, "tags");
			metadata.tags = rawTags;
		}
	}

	const rawFrom = source.from !== undefined ? source.from : raw.from;

	if (rawFrom !== undefined) {
		assertString(rawFrom, "from");
		metadata.from = rawFrom.trim();
	}

	return metadata;
}

function parseContent(rawContent: unknown): WorldfileContent {
	assertObject(rawContent, "content");

	let backgrounds: string[];
	let legacyDescription: string | undefined;

	if (rawContent.backgrounds !== undefined) {
		if (typeof rawContent.backgrounds === "string") {
			backgrounds = [rawContent.backgrounds];
		}
		else {
			assertStringArray(rawContent.backgrounds, "content.backgrounds");
			backgrounds = rawContent.backgrounds;
		}

		if (rawContent.description !== undefined) {
			assertString(rawContent.description, "content.description", true);
			legacyDescription = rawContent.description;
		}
	}
	else if (rawContent.description !== undefined) {
		assertString(rawContent.description, "content.description", true);
		legacyDescription = rawContent.description;
		backgrounds = [rawContent.description];
	}
	else {
		throw new Error("Field \"content.backgrounds\" must be an array of strings.");
	}

	const content: WorldfileContent = {
		backgrounds,
		guidelines: [],
	};

	if (rawContent.guidelines !== undefined) {
		if (typeof rawContent.guidelines === "string") {
			content.guidelines = [rawContent.guidelines];
		}
		else {
			assertStringArray(rawContent.guidelines, "content.guidelines");
			content.guidelines = rawContent.guidelines;
		}
	}

	if (rawContent.setting_description !== undefined) {
		assertString(rawContent.setting_description, "content.setting_description", true);
		content.setting_description = rawContent.setting_description;
	}

	if (legacyDescription !== undefined) {
		content.description = legacyDescription;
	}

	if (rawContent.generation !== undefined) {
		assertObject(rawContent.generation, "content.generation");
		content.generation = rawContent.generation;
	}

	if (rawContent.settings !== undefined) {
		assertObject(rawContent.settings, "content.settings");
		const settings: ContentSettings = {};

		if (rawContent.settings.rules !== undefined) {
			if (typeof rawContent.settings.rules === "string") {
				settings.rules = [rawContent.settings.rules];
			}
			else {
				assertStringArray(rawContent.settings.rules, "content.settings.rules");
				settings.rules = rawContent.settings.rules;
			}
		}

		if (rawContent.settings.guidelines !== undefined) {
			if (typeof rawContent.settings.guidelines === "string") {
				settings.guidelines = [rawContent.settings.guidelines];
			}
			else {
				assertStringArray(rawContent.settings.guidelines, "content.settings.guidelines");
				settings.guidelines = rawContent.settings.guidelines;
			}
		}

		content.settings = settings;
	}

	if (rawContent.plot !== undefined) {
		assertObject(rawContent.plot, "content.plot");
		const plot: { intro?: ContentPlotIntro; incident?: ContentPlotIncident } = {};

		if (rawContent.plot.intro !== undefined) {
			assertObject(rawContent.plot.intro, "content.plot.intro");
			assertString(rawContent.plot.intro.mode, "content.plot.intro.mode");

			if (!VALID_PLOT_INTRO_MODES.includes(rawContent.plot.intro.mode as any)) {
				throw new Error(
					`Field "content.plot.intro.mode" must be one of: ${VALID_PLOT_INTRO_MODES.join(", ")}.`,
				);
			}

			const intro: ContentPlotIntro = {
				mode: rawContent.plot.intro.mode as ContentPlotIntro["mode"],
			};

			if (rawContent.plot.intro.list !== undefined) {
				if (!Array.isArray(rawContent.plot.intro.list)) {
					throw new Error("Field \"content.plot.intro.list\" must be an array.");
				}

				const introList: ContentPlotIntroItem[] = [];
				for (let i = 0; i < rawContent.plot.intro.list.length; i++) {
					const item = rawContent.plot.intro.list[i];
					assertObject(item, `content.plot.intro.list[${i}]`);
					assertString(item.value, `content.plot.intro.list[${i}].value`, true);

					const introItem: ContentPlotIntroItem = { value: item.value };
					if (item.hidden !== undefined) {
						if (typeof item.hidden !== "boolean") {
							throw new Error(`Field "content.plot.intro.list[${i}].hidden" must be a boolean.`);
						}
						introItem.hidden = item.hidden;
					}
					if (item.feeling_lucky !== undefined || item.feelingLucky !== undefined) {
						introItem.feelingLucky = Boolean(item.feeling_lucky ?? item.feelingLucky);
					}
					introList.push(introItem);
				}

				intro.list = introList;
			}

			plot.intro = intro;
		}

		if (rawContent.plot.incident !== undefined) {
			assertObject(rawContent.plot.incident, "content.plot.incident");
			const incident: ContentPlotIncident = {};

			if (rawContent.plot.incident.list !== undefined) {
				if (!Array.isArray(rawContent.plot.incident.list)) {
					throw new Error("Field \"content.plot.incident.list\" must be an array.");
				}

				const incidentList: ContentPlotIncidentItem[] = [];
				for (let i = 0; i < rawContent.plot.incident.list.length; i++) {
					const item = rawContent.plot.incident.list[i];
					assertObject(item, `content.plot.incident.list[${i}]`);
					assertString(item.value, `content.plot.incident.list[${i}].value`, true);
					assertString(item.trigger, `content.plot.incident.list[${i}].trigger`);

					if (!VALID_INCIDENT_TRIGGERS.includes(item.trigger as any)) {
						throw new Error(
							`Field "content.plot.incident.list[${i}].trigger" must be one of: ${VALID_INCIDENT_TRIGGERS.join(", ")}.`,
						);
					}

					const incidentItem: ContentPlotIncidentItem = {
						value: item.value,
						trigger: item.trigger as ContentPlotIncidentItem["trigger"],
					};

					if (item.trigger_dice !== undefined) {
						assertString(item.trigger_dice, `content.plot.incident.list[${i}].trigger_dice`);
						incidentItem.trigger_dice = item.trigger_dice;
					}

					if (item.trigger_threshold !== undefined) {
						if (typeof item.trigger_threshold !== "number" || !Number.isInteger(item.trigger_threshold)) {
							throw new Error(
								`Field "content.plot.incident.list[${i}].trigger_threshold" must be an integer.`,
							);
						}
						incidentItem.trigger_threshold = item.trigger_threshold;
					}

					incidentList.push(incidentItem);
				}

				incident.list = incidentList;
			}

			plot.incident = incident;
		}

		content.plot = plot;
	}

	if (rawContent.feeling_lucky !== undefined || rawContent.feelingLucky !== undefined) {
		const rawLucky = (rawContent.feeling_lucky ?? rawContent.feelingLucky) as Record<string, unknown>;
		if (typeof rawLucky === "object" && rawLucky !== null) {
			content.feeling_lucky = rawLucky as WorldfileFeelingLucky;
		}
	}

	return content;
}

// Blueprints Parsing and Validation

function parseStateOperations(rawOps: unknown, fieldName: string): StateOperation[] {
	if (!Array.isArray(rawOps)) {
		throw new Error(`Field "${fieldName}" must be an array of state operations.`);
	}

	return rawOps.map((opItem, opIdx) => {
		assertObject(opItem, `${fieldName}[${opIdx}]`);

		const type = opItem.type;
		if (type !== "set" && type !== "delete") {
			throw new Error(`State operation at ${fieldName}[${opIdx}] must have type "set" or "delete".`);
		}

		assertString(opItem.key, `${fieldName}[${opIdx}].key`);
		validateStateKey(opItem.key);

		if (type === "delete") {
			return { type: "delete", key: opItem.key };
		}

		if (opItem.value === undefined) {
			throw new Error(`Set operation at ${fieldName}[${opIdx}] must specify a value.`);
		}

		return {
			type: "set",
			key: opItem.key,
			value: opItem.value as StateValue,
		};
	});
}

function parseGaugeTier(tierItem: unknown, gaugeKey: string, tierIndex: number): GaugeTier {
	assertObject(tierItem, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}]`);

	assertString(tierItem.id, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}].id`);
	assertString(tierItem.label, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}].label`);

	if (typeof tierItem.min !== "number" || Number.isNaN(tierItem.min)) {
		throw new Error(`Tier "${tierItem.id}" min must be a number.`);
	}

	if (typeof tierItem.max !== "number" || Number.isNaN(tierItem.max)) {
		throw new Error(`Tier "${tierItem.id}" max must be a number.`);
	}

	if (tierItem.min > tierItem.max) {
		throw new Error(`Tier "${tierItem.id}" min (${tierItem.min}) cannot exceed max (${tierItem.max}).`);
	}

	assertString(tierItem.directive, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}].directive`, true);

	const tier: GaugeTier = {
		id: tierItem.id,
		label: tierItem.label,
		min: tierItem.min,
		max: tierItem.max,
		directive: tierItem.directive,
	};

	const rawOnEnter = tierItem.on_enter ?? tierItem.onEnter;
	if (rawOnEnter !== undefined) {
		tier.onEnter = parseStateOperations(rawOnEnter, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}].onEnter`);
	}

	const rawOnExit = tierItem.on_exit ?? tierItem.onExit;
	if (rawOnExit !== undefined) {
		tier.onExit = parseStateOperations(rawOnExit, `blueprints.gauges[${gaugeKey}].tiers[${tierIndex}].onExit`);
	}

	return tier;
}

function parseGaugeBlueprint(item: unknown, index: number): GaugeBlueprint {
	assertObject(item, `blueprints.gauges[${index}]`);

	assertString(item.key, `blueprints.gauges[${index}].key`);
	validateStateKey(item.key);

	if (typeof item.min !== "number" || Number.isNaN(item.min)) {
		throw new Error(`Field "blueprints.gauges[${index}].min" must be a number.`);
	}

	if (typeof item.max !== "number" || Number.isNaN(item.max)) {
		throw new Error(`Field "blueprints.gauges[${index}].max" must be a number.`);
	}

	if (item.min >= item.max) {
		throw new Error(`Gauge "${item.key}" min (${item.min}) must be less than max (${item.max}).`);
	}

	const rawDefault = item.default_value ?? item.defaultValue ?? item.default;
	const defaultValue = typeof rawDefault === "number" && !Number.isNaN(rawDefault) ? rawDefault : item.min;

	const rawDelta = item.max_delta_per_turn ?? item.maxDeltaPerTurn;
	const maxDeltaPerTurn = typeof rawDelta === "number" && !Number.isNaN(rawDelta) ? rawDelta : undefined;

	if (!Array.isArray(item.tiers) || item.tiers.length === 0) {
		throw new Error(`Gauge "${item.key}" must contain at least one tier.`);
	}

	const tiers: GaugeTier[] = item.tiers.map((tierItem, tierIdx) => parseGaugeTier(tierItem, item.key as string, tierIdx));

	return {
		key: item.key,
		min: item.min,
		max: item.max,
		defaultValue,
		...(maxDeltaPerTurn !== undefined ? { maxDeltaPerTurn } : {}),
		tiers,
	};
}

function parseFsmBlueprint(item: unknown, index: number): FsmBlueprint {
	assertObject(item, `blueprints.state_machines[${index}]`);

	assertString(item.key, `blueprints.state_machines[${index}].key`);
	validateStateKey(item.key);

	const rawInitial = item.initial_state ?? item.initialState;
	assertString(rawInitial, `blueprints.state_machines[${index}].initialState`);

	assertObject(item.states, `blueprints.state_machines[${index}].states`);

	const states: Record<string, { directive?: string }> = {};

	for (const [stateName, stateDef] of Object.entries(item.states)) {
		if (typeof stateDef === "string") {
			states[stateName] = { directive: stateDef };
			continue;
		}

		if (stateDef !== null && typeof stateDef === "object" && !Array.isArray(stateDef)) {
			const dir = (stateDef as Record<string, unknown>).directive;
			states[stateName] = {
				...(typeof dir === "string" ? { directive: dir } : {}),
			};
			continue;
		}

		states[stateName] = {};
	}

	if (!(rawInitial in states)) {
		throw new Error(`State machine "${item.key}" initialState "${rawInitial}" is not declared in states.`);
	}

	const rawTransitions = item.transitions;
	if (!Array.isArray(rawTransitions)) {
		throw new Error(`State machine "${item.key}" transitions must be an array.`);
	}

	const transitions: FsmTransition[] = rawTransitions.map((tItem, tIdx) => {
		assertObject(tItem, `blueprints.state_machines[${index}].transitions[${tIdx}]`);
		assertString(tItem.from, `transitions[${tIdx}].from`);
		assertString(tItem.to, `transitions[${tIdx}].to`);

		if (!(tItem.from in states)) {
			throw new Error(`Transition from "${tItem.from}" refers to an undefined state.`);
		}

		if (!(tItem.to in states)) {
			throw new Error(`Transition to "${tItem.to}" refers to an undefined state.`);
		}

		const transition: FsmTransition = {
			from: tItem.from,
			to: tItem.to,
		};

		if (tItem.guard !== undefined && tItem.guard !== null && typeof tItem.guard === "object") {
			const g = tItem.guard as Record<string, unknown>;
			const guard: FsmGuard = {};

			const gaugeKey = g.gauge_key ?? g.gaugeKey;
			if (typeof gaugeKey === "string") {
				guard.gaugeKey = gaugeKey;
			}

			const minGauge = g.min_gauge ?? g.minGauge;
			if (typeof minGauge === "number" && !Number.isNaN(minGauge)) {
				guard.minGauge = minGauge;
			}

			const maxGauge = g.max_gauge ?? g.maxGauge;
			if (typeof maxGauge === "number" && !Number.isNaN(maxGauge)) {
				guard.maxGauge = maxGauge;
			}

			const reqFlags = g.required_flags ?? g.requiredFlags;
			if (Array.isArray(reqFlags)) {
				assertStringArray(reqFlags, `transitions[${tIdx}].guard.requiredFlags`);
				guard.requiredFlags = [...reqFlags];
			}

			const reqItems = g.required_items ?? g.requiredItems;
			if (Array.isArray(reqItems)) {
				assertStringArray(reqItems, `transitions[${tIdx}].guard.requiredItems`);
				guard.requiredItems = [...reqItems];
			}

			transition.guard = guard;
		}

		return transition;
	});

	return {
		key: item.key,
		initialState: rawInitial,
		states,
		transitions,
	};
}

function parseInventoryBlueprint(item: unknown, index: number): InventoryBlueprint {
	assertObject(item, `blueprints.inventories[${index}]`);

	assertString(item.key, `blueprints.inventories[${index}].key`);
	validateStateKey(item.key);

	const rawItems = item.items ?? [];
	assertStringArray(rawItems, `blueprints.inventories[${index}].items`);

	return {
		key: item.key,
		items: [...rawItems],
	};
}

export function parseSemanticBlueprints(rawBlueprints: unknown): SemanticBlueprints {
	if (rawBlueprints === null || typeof rawBlueprints !== "object" || Array.isArray(rawBlueprints)) {
		throw new Error("Field \"blueprints\" must be an object table.");
	}

	const raw = rawBlueprints as Record<string, unknown>;
	const result: SemanticBlueprints = {};

	if (raw.flags !== undefined) {
		assertStringArray(raw.flags, "blueprints.flags");
		result.flags = [...raw.flags];
	}

	if (raw.gauges !== undefined) {
		if (!Array.isArray(raw.gauges)) {
			throw new Error("Field \"blueprints.gauges\" must be an array of gauge tables.");
		}

		result.gauges = raw.gauges.map((gaugeItem, idx) => parseGaugeBlueprint(gaugeItem, idx));
	}

	const rawStateMachines = raw.state_machines ?? raw.stateMachines;
	if (rawStateMachines !== undefined) {
		if (!Array.isArray(rawStateMachines)) {
			throw new Error("Field \"blueprints.state_machines\" must be an array of state machine tables.");
		}

		result.stateMachines = rawStateMachines.map((fsmItem, idx) => parseFsmBlueprint(fsmItem, idx));
	}

	if (raw.inventories !== undefined) {
		if (!Array.isArray(raw.inventories)) {
			throw new Error("Field \"blueprints.inventories\" must be an array of inventory tables.");
		}

		result.inventories = raw.inventories.map((invItem, idx) => parseInventoryBlueprint(invItem, idx));
	}

	return result;
}

export function serializeSemanticBlueprints(blueprints: SemanticBlueprints): Record<string, unknown> {
	const doc: Record<string, unknown> = {};

	if (blueprints.flags && blueprints.flags.length > 0) {
		doc.flags = blueprints.flags;
	}

	if (blueprints.gauges && blueprints.gauges.length > 0) {
		doc.gauges = blueprints.gauges.map((gauge) => {
			const gaugeDoc: Record<string, unknown> = {
				key: gauge.key,
				min: gauge.min,
				max: gauge.max,
				default_value: gauge.defaultValue,
			};

			if (gauge.maxDeltaPerTurn !== undefined) {
				gaugeDoc.max_delta_per_turn = gauge.maxDeltaPerTurn;
			}

			gaugeDoc.tiers = gauge.tiers.map((tier) => {
				const tierDoc: Record<string, unknown> = {
					id: tier.id,
					label: tier.label,
					min: tier.min,
					max: tier.max,
					directive: tier.directive,
				};

				if (tier.onEnter && tier.onEnter.length > 0) {
					tierDoc.on_enter = tier.onEnter;
				}

				if (tier.onExit && tier.onExit.length > 0) {
					tierDoc.on_exit = tier.onExit;
				}

				return tierDoc;
			});

			return gaugeDoc;
		});
	}

	if (blueprints.stateMachines && blueprints.stateMachines.length > 0) {
		doc.state_machines = blueprints.stateMachines.map((fsm) => {
			const fsmDoc: Record<string, unknown> = {
				key: fsm.key,
				initial_state: fsm.initialState,
				states: fsm.states,
				transitions: fsm.transitions.map((t) => {
					const tDoc: Record<string, unknown> = {
						from: t.from,
						to: t.to,
					};

					if (t.guard) {
						const gDoc: Record<string, unknown> = {};

						if (t.guard.gaugeKey !== undefined) {
							gDoc.gauge_key = t.guard.gaugeKey;
						}

						if (t.guard.minGauge !== undefined) {
							gDoc.min_gauge = t.guard.minGauge;
						}

						if (t.guard.maxGauge !== undefined) {
							gDoc.max_gauge = t.guard.maxGauge;
						}

						if (t.guard.requiredFlags && t.guard.requiredFlags.length > 0) {
							gDoc.required_flags = t.guard.requiredFlags;
						}

						if (t.guard.requiredItems && t.guard.requiredItems.length > 0) {
							gDoc.required_items = t.guard.requiredItems;
						}

						if (Object.keys(gDoc).length > 0) {
							tDoc.guard = gDoc;
						}
					}

					return tDoc;
				}),
			};

			return fsmDoc;
		});
	}

	if (blueprints.inventories && blueprints.inventories.length > 0) {
		doc.inventories = blueprints.inventories.map(inv => ({
			key: inv.key,
			items: inv.items,
		}));
	}

	return doc;
}

// Public TOML Parsers and Serializers

export function parseWorldfile(tomlContent: string): Worldfile {
	if (typeof tomlContent !== "string" || tomlContent.trim() === "") {
		throw new Error("Worldfile TOML content cannot be empty.");
	}

	const raw = parse(tomlContent);
	assertObject(raw, "root");

	const metadata = parseMetadata(raw);

	const worldfile: Worldfile = {
		metadata,
		content: parseContent(raw.content),
	};

	if (raw.args !== undefined) {
		if (!Array.isArray(raw.args)) {
			throw new Error("Field \"args\" must be an array of argument tables.");
		}
		worldfile.args = raw.args.map((arg, idx) => parseParamDefinition(arg, idx, "args"));
	}

	if (raw.vars !== undefined) {
		if (!Array.isArray(raw.vars)) {
			throw new Error("Field \"vars\" must be an array of variable tables.");
		}
		worldfile.vars = raw.vars.map((v, idx) => parseParamDefinition(v, idx, "vars"));
	}

	if (raw.states !== undefined) {
		worldfile.states = flattenStates(raw.states);
	}

	if (raw.blueprints !== undefined) {
		worldfile.blueprints = parseSemanticBlueprints(raw.blueprints);
	}

	return worldfile;
}

export function serializeWorldfile(worldfile: Worldfile): string {
	const doc: Record<string, unknown> = {
		name: worldfile.metadata.name,
		version: worldfile.metadata.version,
		title: worldfile.metadata.title,
		description: worldfile.metadata.description,
	};

	if (worldfile.metadata.authors && worldfile.metadata.authors.length > 0) {
		doc.authors = worldfile.metadata.authors;
	}

	if (worldfile.metadata.tags && worldfile.metadata.tags.length > 0) {
		doc.tags = worldfile.metadata.tags;
	}

	if (worldfile.metadata.from) {
		doc.from = worldfile.metadata.from;
	}

	if (worldfile.args && worldfile.args.length > 0) {
		doc.args = worldfile.args;
	}

	if (worldfile.vars && worldfile.vars.length > 0) {
		doc.vars = worldfile.vars;
	}

	const contentDoc: Record<string, unknown> = {
		backgrounds: worldfile.content.backgrounds ?? (worldfile.content.description ? [worldfile.content.description] : []),
	};

	if (worldfile.content.description !== undefined) {
		contentDoc.description = worldfile.content.description;
	}

	if (worldfile.content.setting_description !== undefined) {
		contentDoc.setting_description = worldfile.content.setting_description;
	}

	if (worldfile.content.guidelines && worldfile.content.guidelines.length > 0) {
		contentDoc.guidelines = worldfile.content.guidelines;
	}

	if (worldfile.content.generation !== undefined) {
		contentDoc.generation = worldfile.content.generation;
	}

	if (worldfile.content.settings !== undefined) {
		contentDoc.settings = worldfile.content.settings;
	}

	if (worldfile.content.plot !== undefined) {
		const plotDoc: Record<string, unknown> = {};
		if (worldfile.content.plot.intro !== undefined) {
			const introDoc: Record<string, unknown> = {
				mode: worldfile.content.plot.intro.mode,
			};
			if (worldfile.content.plot.intro.list !== undefined) {
				introDoc.list = worldfile.content.plot.intro.list.map((item) => {
					const itemDoc: Record<string, unknown> = {
						value: item.value,
					};
					if (item.hidden !== undefined) {
						itemDoc.hidden = item.hidden;
					}
					if (item.feelingLucky) {
						itemDoc.feeling_lucky = true;
					}
					return itemDoc;
				});
			}
			plotDoc.intro = introDoc;
		}
		if (worldfile.content.plot.incident !== undefined) {
			plotDoc.incident = worldfile.content.plot.incident;
		}
		contentDoc.plot = plotDoc;
	}

	if (worldfile.content.feeling_lucky && Object.keys(worldfile.content.feeling_lucky).length > 0) {
		contentDoc.feeling_lucky = worldfile.content.feeling_lucky;
	}

	doc.content = contentDoc;

	if (worldfile.states && Object.keys(worldfile.states).length > 0) {
		doc.states = worldfile.states;
	}

	if (worldfile.blueprints !== undefined) {
		const blueprintsDoc = serializeSemanticBlueprints(worldfile.blueprints);
		if (Object.keys(blueprintsDoc).length > 0) {
			doc.blueprints = blueprintsDoc;
		}
	}

	return stringifyToml(doc);
}

export function parseUniversefile(tomlContent: string): Universefile {
	if (typeof tomlContent !== "string" || tomlContent.trim() === "") {
		throw new Error("Universefile TOML content cannot be empty.");
	}

	const raw = parse(tomlContent);
	assertObject(raw, "root");

	const metadata = parseMetadata(raw);

	assertObject(raw.settings, "settings");

	let rules: string[];

	if (typeof raw.settings.rules === "string") {
		rules = [raw.settings.rules];
	}
	else {
		assertStringArray(raw.settings.rules, "settings.rules");
		rules = raw.settings.rules;
	}

	const universefile: Universefile = {
		metadata,
		settings: {
			rules,
		},
		states: {},
	};

	if (raw.settings.backgrounds !== undefined) {
		if (typeof raw.settings.backgrounds === "string") {
			universefile.settings.backgrounds = [raw.settings.backgrounds];
		}
		else {
			assertStringArray(raw.settings.backgrounds, "settings.backgrounds");
			universefile.settings.backgrounds = raw.settings.backgrounds;
		}
	}

	if (raw.settings.feeling_lucky !== undefined || raw.settings.feelingLucky !== undefined) {
		const rawLucky = (raw.settings.feeling_lucky ?? raw.settings.feelingLucky) as Record<string, unknown>;
		if (typeof rawLucky === "object" && rawLucky !== null) {
			universefile.settings.feeling_lucky = rawLucky as { rules?: number[]; backgrounds?: number[] };
		}
	}

	if (raw.states !== undefined) {
		universefile.states = flattenStates(raw.states);
	}

	return universefile;
}

export function serializeUniversefile(universefile: Universefile): string {
	const doc: Record<string, unknown> = {
		name: universefile.metadata.name,
		version: universefile.metadata.version,
		title: universefile.metadata.title,
		description: universefile.metadata.description,
	};

	if (universefile.metadata.authors && universefile.metadata.authors.length > 0) {
		doc.authors = universefile.metadata.authors;
	}

	if (universefile.metadata.tags && universefile.metadata.tags.length > 0) {
		doc.tags = universefile.metadata.tags;
	}

	if (universefile.metadata.from) {
		doc.from = universefile.metadata.from;
	}

	const settingsDoc: Record<string, unknown> = {
		rules: universefile.settings.rules,
	};

	if (universefile.settings.backgrounds !== undefined) {
		settingsDoc.backgrounds = universefile.settings.backgrounds;
	}

	if (universefile.settings.feeling_lucky && Object.keys(universefile.settings.feeling_lucky).length > 0) {
		settingsDoc.feeling_lucky = universefile.settings.feeling_lucky;
	}

	doc.settings = settingsDoc;

	if (universefile.states && Object.keys(universefile.states).length > 0) {
		doc.states = universefile.states;
	}

	return stringifyToml(doc);
}
