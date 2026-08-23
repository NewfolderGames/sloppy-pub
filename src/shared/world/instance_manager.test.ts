import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_CHARACTERFILE, saveCharacterfile } from "../character/registry.ts";
import type { Characterfile } from "../character/types.ts";
import { saveUniverse } from "../universe/registry.ts";
import { deleteLoreBook, saveLoreBook } from "../lore/registry.ts";
import type { LoreBook } from "../lore/types.ts";
import { createInstanceSession, createWorldInstance, ensureDefaultInstance, getActiveInstanceId, getInstance, setActiveInstanceId, synthesizeInstancePrompt, validateAndResolveInstanceVars } from "./instance_manager.ts";
import { saveWorldfile } from "./registry.ts";
import type { Universefile, VariableDefinition, Worldfile } from "./types.ts";

const TEST_WORLDFILE: Worldfile = {
	metadata: {
		name: "test_cyberpunk",
		version: "1.0.0",
		title: "Cyber City",
		description: "Cyberpunk test setting.",
	},
	args: [
		{
			name: "CORP",
			type: "text",
			default: "MegaCorp",
		},
	],
	vars: [
		{
			name: "HERO_NAME",
			type: "text",
			default: "Neon",
		},
		{
			name: "HERO_LEVEL",
			type: "number",
			default: 1,
			range: "1,100",
			format: "int",
		},
		{
			name: "IS_AUGMENTED",
			type: "boolean",
			default: true,
		},
		{
			name: "FACTION",
			type: "select",
			default: "rebels",
			values: ["rebels", "corpos", "nomads"],
		},
	],
	content: {
		backgrounds: ["City dominated by {{CORP}}."],
		description: "City dominated by {{CORP}}.",
		guidelines: [],
	},
	states: {
		"city.danger_level": 3,
		"player.hp": 100,
	},
};

const TEST_UNIVERSE: Universefile = {
	metadata: {
		name: "test_multiverse",
		version: "1.0.0",
		title: "Test Multiverse",
		description: "Shared reality layer.",
	},
	settings: {
		rules: ["Energy cannot be created or destroyed."],
		backgrounds: ["All timelines originate from the Nexus core."],
	},
	states: {
		"universe.gravity": 9.8,
		"universe.factions": ["rebels", "corpos"],
	},
};

describe("Instance Manager - Variable Validation & Resolution", () => {

	const varDefs: VariableDefinition[] = TEST_WORLDFILE.vars!;

	it("uses default values when variables are omitted", () => {

		const resolved = validateAndResolveInstanceVars(varDefs, {});
		assert.equal(resolved.HERO_NAME, "Neon");
		assert.equal(resolved.HERO_LEVEL, 1);
		assert.equal(resolved.IS_AUGMENTED, true);
		assert.equal(resolved.FACTION, "rebels");

	});

	it("validates and accepts supplied variables", () => {

		const resolved = validateAndResolveInstanceVars(varDefs, {
			HERO_NAME: "Cipher",
			HERO_LEVEL: 5,
			IS_AUGMENTED: false,
			FACTION: "corpos",
		});

		assert.equal(resolved.HERO_NAME, "Cipher");
		assert.equal(resolved.HERO_LEVEL, 5);
		assert.equal(resolved.IS_AUGMENTED, false);
		assert.equal(resolved.FACTION, "corpos");

	});

	it("throws on invalid number range or non-integer format", () => {

		assert.throws(() => {
			validateAndResolveInstanceVars(varDefs, { HERO_LEVEL: 150 });
		}, /outside range/);

		assert.throws(() => {
			validateAndResolveInstanceVars(varDefs, { HERO_LEVEL: 3.5 });
		}, /must be an integer/);

	});

	it("throws on disallowed select value", () => {

		assert.throws(() => {
			validateAndResolveInstanceVars(varDefs, { FACTION: "aliens" });
		}, /not in allowed values/);

	});

});

describe("Instance Manager - Prompt Synthesis", () => {

	const testWorldfile: Worldfile = {
		metadata: TEST_WORLDFILE.metadata,
		content: {
			backgrounds: ["Welcome to {{HERO_NAME}}'s adventure in the city."],
			description: "Welcome to {{HERO_NAME}}'s adventure in the city.",
			guidelines: [],
		},
		vars: TEST_WORLDFILE.vars!,
		states: TEST_WORLDFILE.states!,
	};

	it("synthesizes prompt with variable interpolation and universe rules", () => {

		const prompt = synthesizeInstancePrompt(
			testWorldfile,
			{ HERO_NAME: "Kaelen", HERO_LEVEL: 10 },
			TEST_UNIVERSE,
		);

		assert.match(prompt, /Test Multiverse : Cyber City/);
		assert.match(prompt, /<!-- Description of the setting\. -->/);
		assert.match(prompt, /All timelines originate from the Nexus core\./);
		assert.match(prompt, /Welcome to Kaelen's adventure/);
		assert.match(prompt, /<!-- Rules of the world and the universe -->/);
		assert.match(prompt, /Energy cannot be created or destroyed\./);
		assert.match(prompt, /Active Session Variables:/);
		assert.match(prompt, /HERO_NAME: Kaelen/);
		assert.match(prompt, /HERO_LEVEL: 10/);

	});

});

describe("Instance Manager - Lifecycle & Session", () => {

	it("creates instance and initializes session with state and tree", async () => {

		const savedWorld = saveWorldfile(TEST_WORLDFILE);
		saveUniverse(TEST_UNIVERSE);

		const instance = await createWorldInstance({
			title: "Cyber City Run 1",
			worldId: savedWorld.id,
			universeId: TEST_UNIVERSE.metadata.name,
			universeMode: "synchronized",
			injectedVars: {
				HERO_NAME: "Ghost",
				HERO_LEVEL: 2,
			},
		});

		assert.ok(instance.id);
		assert.equal(instance.title, "Cyber City Run 1");
		assert.equal(instance.universeMode, "synchronized");
		assert.equal(instance.activeStates["city.danger_level"], 3);
		assert.equal(instance.activeStates["universe.gravity"], 9.8);

		// Initialize session
		const session = createInstanceSession(instance);
		assert.equal(session.stateStore.getState("city.danger_level"), 3);

		// World prompt should be stored on instance and session, not in message tree
		assert.ok(session.worldPrompt);
		assert.match(session.worldPrompt, /City dominated by/);
		assert.equal(instance.worldPrompt, session.worldPrompt);
		assert.equal(session.treeManager.getMessages().length, 0);

		// Adding messages and state changes
		session.stateStore.setState("city.danger_level", 5);
		const savedAfterState = getInstance(instance.id);
		assert.equal(savedAfterState?.activeStates["city.danger_level"], 5);

		session.detach();

	});

	it("manages active instance id and fallback deletion", () => {

		const inst1 = ensureDefaultInstance();
		assert.ok(inst1);
		assert.equal(getActiveInstanceId(), inst1.id);

		setActiveInstanceId(inst1.id);
		assert.equal(getActiveInstanceId(), inst1.id);

	});

	it("creates instance with multiple selected character files and synchronizes character state", async () => {

		const savedWorld = saveWorldfile(TEST_WORLDFILE);

		const secondCharacter: Characterfile = {
			metadata: {
				name: "marcus_guard",
				version: "1.0.0",
				title: "Marcus Guard",
				description: "Security personnel.",
			},
			summary: "Marcus is a vigilant sentinel.",
			physical_characteristics: [{ name: "Species", description: "Human" }],
			linguistic_patterns: [{ name: "Voice", description: "Direct" }],
			psychology_and_worldviews: [],
			lifestyle_and_preferences: [],
			desires: [],
			skills: [],
			backgrounds: [],
			example_dialogs: [],
			initial_states: {
				guard_status: "alert",
			},
		};

		saveCharacterfile(SAMPLE_CHARACTERFILE);
		saveCharacterfile(secondCharacter);

		const instance = await createWorldInstance({
			title: "Multi Character World Run",
			worldId: savedWorld.id,
			characterIds: [
				SAMPLE_CHARACTERFILE.metadata.name,
				"marcus_guard",
				SAMPLE_CHARACTERFILE.metadata.name,
			],
		});

		assert.ok(instance.id);
		assert.equal(instance.characterIds?.length, 2);
		assert.equal(instance.characterInstances?.length, 2);

		const vanceInst = instance.characterInstances?.find(
			ci => ci.characterId === SAMPLE_CHARACTERFILE.metadata.name,
		);
		const marcusInst = instance.characterInstances?.find(
			ci => ci.characterId === "marcus_guard",
		);

		assert.ok(vanceInst);
		assert.ok(marcusInst);
		assert.equal(vanceInst.name, SAMPLE_CHARACTERFILE.metadata.title);
		assert.equal(marcusInst.name, "Marcus Guard");
		assert.equal(vanceInst.states["focus_level"], 90);
		assert.equal(marcusInst.states["guard_status"], "alert");

		const session = createInstanceSession(instance);

		assert.ok(session.characterStore);
		assert.equal(session.characterStore.getAllInstances().length, 2);

		session.characterStore.setThought(vanceInst.id, {
			title: "Radio Frequency",
			internal_monologue: "Analyzing signal harmonics.",
		});

		const persisted = getInstance(instance.id);
		const updatedVance = persisted?.characterInstances?.find(
			ci => ci.id === vanceInst.id,
		);

		assert.ok(updatedVance);
		assert.equal(updatedVance.thoughts.length, 1);
		assert.equal(updatedVance.thoughts[0].title, "Radio Frequency");

		session.detach();

	});

	it("associates lorebookId with instance and injects static lore into initial worldPrompt", async () => {

		const savedWorld = saveWorldfile(TEST_WORLDFILE);
		const testLorebook: LoreBook = {
			id: "lb_inst_test",
			name: "Instance Lore",
			entries: [
				{
					id: "entry_faction",
					title: "Underground Rebels",
					content: "The rebels operate from Sector 4.",
					keywords: [],
					activationMode: "static",
					enabled: true,
				},
				{
					id: "entry_secret",
					title: "Secret Weapon",
					content: "Experimental plasma coil.",
					keywords: ["plasma"],
					activationMode: "dynamic",
					enabled: true,
				},
			],
		};

		saveLoreBook(testLorebook, "lb_inst_test");

		try {
			// 1. synthesizeInstancePrompt directly
			const prompt = synthesizeInstancePrompt(TEST_WORLDFILE, {}, undefined, "lb_inst_test");
			assert.ok(prompt.includes("Underground Rebels"));
			assert.ok(prompt.includes("The rebels operate from Sector 4."));
			assert.ok(!prompt.includes("Experimental plasma coil"), "Dynamic lore should not be in static instance prompt");

			// 2. createWorldInstance with lorebookId
			const instance = await createWorldInstance({
				title: "Lore-enabled Session",
				worldId: savedWorld.id,
				lorebookId: "lb_inst_test",
			});

			assert.equal(instance.lorebookId, "lb_inst_test");
			assert.ok(instance.worldPrompt?.includes("Underground Rebels"));

			// 3. createInstanceSession preserves lorebookId
			const session = createInstanceSession(instance);
			assert.equal(session.lorebookId, "lb_inst_test");
			session.detach();
		}
		finally {
			deleteLoreBook("lb_inst_test");
		}

	});

	it("creates instance with multiple lore books and keeps legacy lorebookId", async () => {

		const savedWorld = saveWorldfile(TEST_WORLDFILE);

		const loreA: LoreBook = {
			id: "lb_multi_a",
			name: "Lore A",
			entries: [
				{
					id: "a_static",
					title: "Lore A Static",
					content: "Content from lore book A.",
					keywords: [],
					activationMode: "static",
					enabled: true,
				},
			],
		};

		const loreB: LoreBook = {
			id: "lb_multi_b",
			name: "Lore B",
			entries: [
				{
					id: "b_static",
					title: "Lore B Static",
					content: "Content from lore book B.",
					keywords: [],
					activationMode: "static",
					enabled: true,
				},
			],
		};

		saveLoreBook(loreA, "lb_multi_a");
		saveLoreBook(loreB, "lb_multi_b");

		try {
			const instance = await createWorldInstance({
				title: "Multi Lore Session",
				worldId: savedWorld.id,
				lorebookIds: ["lb_multi_a", "lb_multi_b"],
			});

			assert.deepEqual(instance.lorebookIds, ["lb_multi_a", "lb_multi_b"]);
			assert.equal(instance.lorebookId, "lb_multi_a");
			assert.ok(instance.worldPrompt?.includes("Content from lore book A."));
			assert.ok(instance.worldPrompt?.includes("Content from lore book B."));

			const session = createInstanceSession(instance);
			assert.deepEqual(session.lorebookIds, ["lb_multi_a", "lb_multi_b"]);
			session.detach();
		}
		finally {
			deleteLoreBook("lb_multi_a");
			deleteLoreBook("lb_multi_b");
		}

	});

});
