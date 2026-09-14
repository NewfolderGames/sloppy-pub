import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { flattenStates, parseUniversefile, parseWorldfile, serializeUniversefile, serializeWorldfile, validateStateKey } from "./toml.ts";

describe("validateStateKey & flattenStates", () => {
	test("validates clean dot-notated state keys", () => {
		assert.doesNotThrow(() => validateStateKey("district.alert_level"));
		assert.doesNotThrow(() => validateStateKey("player.inventory.gold"));
		assert.doesNotThrow(() => validateStateKey("simple_key"));
	});

	test("rejects invalid state keys with empty segments", () => {
		assert.throws(() => validateStateKey(""), /empty/);
		assert.throws(() => validateStateKey("district..alert"), /empty segment/);
		assert.throws(() => validateStateKey(".district"), /empty segment/);
		assert.throws(() => validateStateKey("district."), /empty segment/);
	});

	test("flattens nested state tables into dot-notated dictionary", () => {
		const raw = {
			district: {
				alert_level: 2,
				power: {
					grid_active: true,
				},
			},
			factions: ["police", "syndicate"],
			currency: "credits",
		};

		const flat = flattenStates(raw);

		assert.deepEqual(flat, {
			"district.alert_level": 2,
			"district.power.grid_active": true,
			"factions": ["police", "syndicate"],
			"currency": "credits",
		});
	});

	test("rejects states with heterogeneous or non-primitive array items", () => {
		assert.throws(
			() => flattenStates({ items: [1, "two"] }),
			/homogeneous primitive values/,
		);
		assert.throws(
			() => flattenStates({ items: [{ nested: "obj" }] }),
			/non-primitive/,
		);
	});
});

describe("Worldfile TOML Parsing and Serialization", () => {
	const sampleWorldfileToml = `
name = "cyberpunk-underworld"
version = "1.0.0"
title = "Cyberpunk Underworld"
description = "A gritty cyberpunk city district."
authors = ["Alice", "Bob"]
tags = ["cyberpunk", "noir"]
from = "parent-world:0.1"

[[args]]
name = "DISTRICT_NAME"
type = "text"
default = "Sector 4"
description = "Starting district"

[[args]]
name = "DANGER_LEVEL"
type = "number"
format = "int"
range = "1,5"
default = 3

[[vars]]
name = "CALLSIGN"
type = "text"
default = "Ghost"

[content]
description = "The neon-lit streets of {{DISTRICT_NAME}}."

[content.settings]
rules = ["Augments need power.", "Security has jurisdiction."]
guidelines = ["Maintain noir tone."]

[content.plot.intro]
mode = "random"

[[content.plot.intro.list]]
value = "Rain falls over {{DISTRICT_NAME}}."
hidden = false

[[content.plot.intro.list]]
value = "{{DISTRICT_NAME}} is locked down."
hidden = true

[content.plot.incident]

[[content.plot.incident.list]]
value = "A power blackout strikes."
trigger = "dice_roll"
trigger_dice = "1d20"
trigger_threshold = 15

[states]
"district.alert" = 1
district.power_active = true
district.factions = ["cops", "runners"]
`;

	test("parses complete valid Worldfile TOML", () => {
		const wf = parseWorldfile(sampleWorldfileToml);

		assert.equal(wf.metadata.name, "cyberpunk-underworld");
		assert.equal(wf.metadata.version, "1.0.0");
		assert.equal(wf.metadata.title, "Cyberpunk Underworld");
		assert.deepEqual(wf.metadata.authors, ["Alice", "Bob"]);
		assert.deepEqual(wf.metadata.tags, ["cyberpunk", "noir"]);
		assert.equal(wf.metadata.from, "parent-world:0.1");

		assert.equal(wf.args?.length, 2);
		assert.equal(wf.args?.[0].name, "DISTRICT_NAME");
		assert.equal(wf.args?.[0].type, "text");
		assert.equal(wf.args?.[0].default, "Sector 4");

		assert.equal(wf.vars?.length, 1);
		assert.equal(wf.vars?.[0].name, "CALLSIGN");

		assert.equal(wf.content.description, "The neon-lit streets of {{DISTRICT_NAME}}.");
		assert.deepEqual(wf.content.backgrounds, ["The neon-lit streets of {{DISTRICT_NAME}}."]);
		assert.deepEqual(wf.content.settings?.rules, ["Augments need power.", "Security has jurisdiction."]);
		assert.deepEqual(wf.content.settings?.guidelines, ["Maintain noir tone."]);

		assert.equal(wf.content.plot?.intro?.mode, "random");
		assert.equal(wf.content.plot?.intro?.list?.length, 2);
		assert.equal(wf.content.plot?.intro?.list?.[1].hidden, true);

		assert.equal(wf.content.plot?.incident?.list?.length, 1);
		assert.equal(wf.content.plot?.incident?.list?.[0].trigger, "dice_roll");
		assert.equal(wf.content.plot?.incident?.list?.[0].trigger_threshold, 15);

		assert.deepEqual(wf.states, {
			"district.alert": 1,
			"district.power_active": true,
			"district.factions": ["cops", "runners"],
		});
	});

	test("serializes and round-trips Worldfile", () => {
		const original = parseWorldfile(sampleWorldfileToml);
		const tomlString = serializeWorldfile(original);
		const roundTripped = parseWorldfile(tomlString);

		assert.deepEqual(roundTripped, original);
	});

	test("parses Worldfile with content.backgrounds array", () => {
		const toml = `
name = "multiverse-city"
version = "1.0.0"
title = "Multiverse City"
description = "A sprawling city across dimensions."

[content]
backgrounds = [
  "District 1 is eternal rain.",
  "District 2 is neon towers."
]
`;
		const wf = parseWorldfile(toml);
		assert.deepEqual(wf.content.backgrounds, [
			"District 1 is eternal rain.",
			"District 2 is neon towers.",
		]);
		const serialized = serializeWorldfile(wf);
		const roundTripped = parseWorldfile(serialized);
		assert.deepEqual(roundTripped.content.backgrounds, wf.content.backgrounds);
	});

	test("parses Worldfile with [metadata] table and multiline triple-quoted strings", () => {
		const toml = `
[metadata]
name = "multiverse-city"
version = "1.0.0"
title = "Multiverse City"
description = """
A sprawling city across dimensions.
Second line of description.
Third line of description."""
authors = "Solo Author"
tags = "cyberpunk"

[content]
backgrounds = [
  """
District 1 is eternal rain.
The skies never clear.""",
  "District 2 is neon towers."
]

[content.settings]
rules = """
Rule 1: Power must be maintained.
Rule 2: Weapons forbidden."""
guidelines = "Single guideline"
`;
		const wf = parseWorldfile(toml);
		assert.equal(wf.metadata.name, "multiverse-city");
		assert.equal(wf.metadata.title, "Multiverse City");
		assert.equal(
			wf.metadata.description,
			"A sprawling city across dimensions.\nSecond line of description.\nThird line of description.",
		);
		assert.deepEqual(wf.metadata.authors, ["Solo Author"]);
		assert.deepEqual(wf.metadata.tags, ["cyberpunk"]);
		assert.deepEqual(wf.content.backgrounds, [
			"District 1 is eternal rain.\nThe skies never clear.",
			"District 2 is neon towers.",
		]);
		assert.deepEqual(wf.content.settings?.rules, [
			"Rule 1: Power must be maintained.\nRule 2: Weapons forbidden.",
		]);
		assert.deepEqual(wf.content.settings?.guidelines, ["Single guideline"]);

		const serialized = serializeWorldfile(wf);
		assert.ok(serialized.includes("\"\"\""));

		const roundTripped = parseWorldfile(serialized);
		assert.equal(roundTripped.metadata.description, wf.metadata.description);
		assert.deepEqual(roundTripped.content.backgrounds, wf.content.backgrounds);
	});

	test("rejects invalid Worldfiles with missing required fields", () => {
		assert.throws(() => parseWorldfile(""), /empty/);
		assert.throws(
			() => parseWorldfile(`version = "1.0"\ntitle = "T"\ndescription = "D"\n[content]\ndescription="C"`),
			/Field "name" must be a string/,
		);
		assert.throws(
			() => parseWorldfile(`name = "test"\nversion = "1.0"\ntitle = "T"\ndescription = "D"`),
			/Field "content" must be an object/,
		);
		assert.throws(
			() => parseWorldfile(`name = "test"\nversion = "1.0"\ntitle = "T"\ndescription = "D"\n[[args]]\nname="A"\ntype="invalid_type"\n[content]\ndescription="C"`),
			/must be one of/,
		);
		assert.throws(
			() => parseWorldfile(`name = "test"\nversion = "1.0"\ntitle = "T"\ndescription = "D"\n[content]\ndescription="C"\n[content.plot.intro]\nmode="invalid_mode"`),
			/must be one of/,
		);
	});
});

describe("Universefile TOML Parsing and Serialization", () => {
	const sampleUniverseToml = `
name = "neo-metropolis-universe"
version = "1.0.0"
title = "Neo Metropolis Universe"
description = "A persistent cyberpunk metropolis."
authors = ["Creator"]
tags = ["cyberpunk", "sci-fi"]

[settings]
rules = [
  "Megacorporations hold planetary sovereignty.",
  "The year is 2142."
]

[states]
"world.crime_index" = 45
world.currency = "Credits"
`;

	test("parses complete valid Universefile TOML", () => {
		const uf = parseUniversefile(sampleUniverseToml);

		assert.equal(uf.metadata.name, "neo-metropolis-universe");
		assert.equal(uf.metadata.title, "Neo Metropolis Universe");
		assert.deepEqual(uf.settings.rules, [
			"Megacorporations hold planetary sovereignty.",
			"The year is 2142.",
		]);
		assert.deepEqual(uf.states, {
			"world.crime_index": 45,
			"world.currency": "Credits",
		});
	});

	test("serializes and round-trips Universefile", () => {
		const original = parseUniversefile(sampleUniverseToml);
		const tomlString = serializeUniversefile(original);
		const roundTripped = parseUniversefile(tomlString);

		assert.deepEqual(roundTripped, original);
	});

	test("parses and serializes Universefile with settings.backgrounds", () => {
		const toml = `
name = "cosmic-hub"
version = "1.0.0"
title = "Cosmic Hub"
description = "Universal hub reality."

[settings]
rules = ["Law of conservation."]
backgrounds = [
  "The cosmic anchor spans between dimensions.",
  "Void gates connect all active sectors."
]
`;
		const uf = parseUniversefile(toml);
		assert.deepEqual(uf.settings.backgrounds, [
			"The cosmic anchor spans between dimensions.",
			"Void gates connect all active sectors.",
		]);
		const serialized = serializeUniversefile(uf);
		const roundTripped = parseUniversefile(serialized);
		assert.deepEqual(roundTripped.settings.backgrounds, uf.settings.backgrounds);
	});

	test("parses Universefile with [metadata] table and multiline strings", () => {
		const toml = `
[metadata]
name = "cosmic-multiverse"
version = "1.0.0"
title = "Cosmic Multiverse"
description = """
Spanning across infinite dimensional threads.
Rules and invariants are strictly upheld."""
authors = "Cosmic Architect"
tags = "multiverse"

[settings]
rules = """
Rule 1: Time dilation varies with energy density.
Rule 2: Entropy increases monotonically."""
backgrounds = """
Origin point at singularity.
Expansion continuing indefinitely."""
`;
		const uf = parseUniversefile(toml);
		assert.equal(uf.metadata.name, "cosmic-multiverse");
		assert.equal(uf.metadata.title, "Cosmic Multiverse");
		assert.deepEqual(uf.metadata.authors, ["Cosmic Architect"]);
		assert.deepEqual(uf.metadata.tags, ["multiverse"]);
		assert.deepEqual(uf.settings.rules, [
			"Rule 1: Time dilation varies with energy density.\nRule 2: Entropy increases monotonically.",
		]);
		assert.deepEqual(uf.settings.backgrounds, [
			"Origin point at singularity.\nExpansion continuing indefinitely.",
		]);

		const serialized = serializeUniversefile(uf);
		assert.ok(serialized.includes("\"\"\""));

		const roundTripped = parseUniversefile(serialized);
		assert.equal(roundTripped.metadata.description, uf.metadata.description);
		assert.deepEqual(roundTripped.settings.rules, uf.settings.rules);
		assert.deepEqual(roundTripped.settings.backgrounds, uf.settings.backgrounds);
	});

	test("rejects Universefile without settings.rules", () => {
		assert.throws(
			() =>
				parseUniversefile(`name = "u"\nversion = "1.0"\ntitle = "U"\ndescription = "D"\n[settings]`),
			/Field "settings.rules" must be an array of strings/,
		);
	});
});

describe("Worldfile Semantic Blueprints Parsing and Serialization", () => {
	const sampleBlueprintsToml = `
name = "eldritch-investigation"
version = "1.0.0"
title = "Eldritch Investigation"
description = "A psychological horror scenario."

[content]
description = "Investigating an abandoned observatory."

[blueprints]
flags = ["investigated_cellar", "found_relic"]

[[blueprints.gauges]]
key = "sanity"
min = 0
max = 100
default_value = 80
max_delta_per_turn = 15

[[blueprints.gauges.tiers]]
id = "lucid"
label = "Lucid"
min = 70
max = 100
directive = "The investigator perceives reality accurately and speaks calmly."

[[blueprints.gauges.tiers]]
id = "unsettled"
label = "Unsettled"
min = 30
max = 69
directive = "The investigator notices disturbing shadows and stammers occasionally."

[[blueprints.gauges.tiers]]
id = "hysterical"
label = "Hysterical"
min = 0
max = 29
directive = "The investigator hallucinates whispering voices and behaves erratically."

[[blueprints.gauges.tiers.on_enter]]
type = "set"
key = "hallucinating"
value = true

[[blueprints.state_machines]]
key = "investigation_phase"
initial_state = "briefing"

[blueprints.state_machines.states.briefing]
directive = "Reviewing case files before entering the manor."

[blueprints.state_machines.states.exploration]
directive = "Searching rooms for clues."

[blueprints.state_machines.states.climax]
directive = "Confronting the ritual in the underground chamber."

[[blueprints.state_machines.transitions]]
from = "briefing"
to = "exploration"

[blueprints.state_machines.transitions.guard]
required_flags = ["found_relic"]

[[blueprints.state_machines.transitions]]
from = "exploration"
to = "climax"

[blueprints.state_machines.transitions.guard]
gauge_key = "sanity"
max_gauge = 40
required_items = ["silver_key"]

[[blueprints.inventories]]
key = "backpack"
items = ["silver_key", "lantern"]
`;

	test("parses blueprints with gauges, state machines, inventories, and flags", () => {
		const wf = parseWorldfile(sampleBlueprintsToml);

		assert.ok(wf.blueprints);
		assert.deepEqual(wf.blueprints.flags, ["investigated_cellar", "found_relic"]);

		assert.equal(wf.blueprints.gauges?.length, 1);
		const gauge = wf.blueprints.gauges![0];
		assert.equal(gauge.key, "sanity");
		assert.equal(gauge.min, 0);
		assert.equal(gauge.max, 100);
		assert.equal(gauge.defaultValue, 80);
		assert.equal(gauge.maxDeltaPerTurn, 15);
		assert.equal(gauge.tiers.length, 3);
		assert.equal(gauge.tiers[0].id, "lucid");
		assert.equal(gauge.tiers[2].onEnter?.[0].type, "set");

		assert.equal(wf.blueprints.stateMachines?.length, 1);
		const fsm = wf.blueprints.stateMachines![0];
		assert.equal(fsm.key, "investigation_phase");
		assert.equal(fsm.initialState, "briefing");
		assert.equal(fsm.transitions.length, 2);
		assert.deepEqual(fsm.transitions[0].guard?.requiredFlags, ["found_relic"]);
		assert.equal(fsm.transitions[1].guard?.gaugeKey, "sanity");
		assert.equal(fsm.transitions[1].guard?.maxGauge, 40);
		assert.deepEqual(fsm.transitions[1].guard?.requiredItems, ["silver_key"]);

		assert.equal(wf.blueprints.inventories?.length, 1);
		assert.equal(wf.blueprints.inventories![0].key, "backpack");
		assert.deepEqual(wf.blueprints.inventories![0].items, ["silver_key", "lantern"]);
	});

	test("serializes and round-trips blueprints without loss", () => {
		const original = parseWorldfile(sampleBlueprintsToml);
		const toml = serializeWorldfile(original);
		const roundTripped = parseWorldfile(toml);

		assert.deepEqual(roundTripped.blueprints, original.blueprints);
	});

	test("rejects invalid gauge min and max boundaries", () => {
		const invalidGaugeToml = `
name = "test"
version = "1.0.0"
title = "Test"
description = "Test"
[content]
description = "Test content"
[blueprints]
[[blueprints.gauges]]
key = "bad_gauge"
min = 100
max = 50
[[blueprints.gauges.tiers]]
id = "t1"
label = "T1"
min = 0
max = 100
directive = "dir"
`;
		assert.throws(() => parseWorldfile(invalidGaugeToml), /min \(100\) must be less than max \(50\)/);
	});

	test("rejects FSM with transition referencing undefined state", () => {
		const invalidFsmToml = `
name = "test"
version = "1.0.0"
title = "Test"
description = "Test"
[content]
description = "Test content"
[blueprints]
[[blueprints.state_machines]]
key = "phase"
initial_state = "start"
[blueprints.state_machines.states.start]
directive = "start"
[[blueprints.state_machines.transitions]]
from = "start"
to = "nonexistent"
`;
		assert.throws(() => parseWorldfile(invalidFsmToml), /refers to an undefined state/);
	});
});
