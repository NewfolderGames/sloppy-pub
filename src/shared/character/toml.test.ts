import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LINGUISTIC_TRAITS, DEFAULT_PHYSICAL_TRAITS, parseCharacterfile, serializeCharacterfile } from "./toml.ts";
import type { Characterfile } from "./types.ts";

describe("Characterfile TOML Parsing and Serialization", () => {
	const sampleCharacterToml = `
[metadata]
name = "elena_vance"
version = "1.0.0"
title = "Dr. Elena Vance"
description = "A brilliant astrophysicist researching deep-space signals."
authors = ["Roleplay Author"]
tags = ["sci-fi", "scientist"]
from = "origin_station"

summary = "Dr. Elena Vance is an astrophysicist at Kepler Observatory."

[[physical_characteristics]]
name = "Species"
description = "Human"

[[physical_characteristics]]
name = "Age"
description = "34"

[[physical_characteristics]]
name = "Height"
description = "172 cm"

[[physical_characteristics]]
name = "Cybernetics"
description = "Neural data port"

[[linguistic_patterns]]
name = "Voice"
description = "Calm and measured"

[[linguistic_patterns]]
name = "Accent"
description = "Mid-Atlantic"

[[linguistic_patterns]]
name = "Tone"
description = "Analytical"

[[linguistic_patterns]]
name = "Dialect"
description = "Technical English"

[[psychology_and_worldviews]]
name = "Curiosity"
description = "Driven by deep curiosity."

[[lifestyle_and_preferences]]
name = "Tea"
description = "Drinks Earl Grey."

[[desires]]
name = "Discovery"
description = "Wants to decode signal."

[[example_dialogs]]
name = "Greeting"
dialog = "Hello, colleague."

[initial_states]
energy = 100
current_room = "Main Lab"
alerts = ["low_oxygen", "radio_silence"]
`;

	test("parses valid characterfile TOML correctly", () => {
		const parsed = parseCharacterfile(sampleCharacterToml);

		assert.equal(parsed.metadata.name, "elena_vance");
		assert.equal(parsed.metadata.version, "1.0.0");
		assert.equal(parsed.metadata.title, "Dr. Elena Vance");
		assert.equal(
			parsed.metadata.description,
			"A brilliant astrophysicist researching deep-space signals.",
		);
		assert.deepEqual(parsed.metadata.authors, ["Roleplay Author"]);
		assert.deepEqual(parsed.metadata.tags, ["sci-fi", "scientist"]);
		assert.equal(parsed.metadata.from, "origin_station");
		assert.equal(parsed.summary, "Dr. Elena Vance is an astrophysicist at Kepler Observatory.");

		assert.equal(parsed.physical_characteristics.length, 4);
		assert.equal(parsed.physical_characteristics[0].name, "Species");
		assert.equal(parsed.physical_characteristics[0].description, "Human");
		assert.equal(parsed.physical_characteristics[3].name, "Cybernetics");

		assert.equal(parsed.linguistic_patterns.length, 4);
		assert.equal(parsed.linguistic_patterns[0].name, "Voice");
		assert.equal(parsed.linguistic_patterns[0].description, "Calm and measured");

		assert.equal(parsed.psychology_and_worldviews.length, 1);
		assert.equal(parsed.psychology_and_worldviews[0].name, "Curiosity");

		assert.equal(parsed.lifestyle_and_preferences.length, 1);
		assert.equal(parsed.lifestyle_and_preferences[0].name, "Tea");

		assert.equal(parsed.desires.length, 1);
		assert.equal(parsed.desires[0].name, "Discovery");

		assert.equal(parsed.example_dialogs.length, 1);
		assert.equal(parsed.example_dialogs[0].name, "Greeting");
		assert.equal(parsed.example_dialogs[0].dialog, "Hello, colleague.");

		assert.equal(parsed.initial_states["energy"], 100);
		assert.equal(parsed.initial_states["current_room"], "Main Lab");
		assert.deepEqual(parsed.initial_states["alerts"], ["low_oxygen", "radio_silence"]);
	});

	test("populates default physical and linguistic traits if omitted", () => {
		const minimalToml = `
[metadata]
name = "minimal_char"
version = "0.1.0"
title = "Minimal Character"
description = "A minimal character definition."

summary = "A test summary."
`;

		const parsed = parseCharacterfile(minimalToml);

		for (const traitName of DEFAULT_PHYSICAL_TRAITS) {
			const found = parsed.physical_characteristics.find(
				t => t.name.toLowerCase() === traitName.toLowerCase(),
			);
			assert.ok(found, `Expected default physical trait "${traitName}" to be present.`);
		}

		for (const traitName of DEFAULT_LINGUISTIC_TRAITS) {
			const found = parsed.linguistic_patterns.find(
				t => t.name.toLowerCase() === traitName.toLowerCase(),
			);
			assert.ok(found, `Expected default linguistic trait "${traitName}" to be present.`);
		}

		assert.deepEqual(parsed.psychology_and_worldviews, []);
		assert.deepEqual(parsed.lifestyle_and_preferences, []);
		assert.deepEqual(parsed.desires, []);
		assert.deepEqual(parsed.example_dialogs, []);
		assert.deepEqual(parsed.initial_states, {});
	});

	test("handles character file with empty optional trait lists", () => {
		const emptyOptionalToml = `
[metadata]
name = "scout"
version = "1.0.0"
title = "Scout"
description = "Scout unit."

summary = "Scout on patrol."

physical_characteristics = []
linguistic_patterns = []
psychology_and_worldviews = []
lifestyle_and_preferences = []
desires = []
example_dialogs = []

[initial_states]
`;

		const parsed = parseCharacterfile(emptyOptionalToml);

		// Default physical and linguistic traits are ensured even if empty list passed
		assert.equal(parsed.physical_characteristics.length, DEFAULT_PHYSICAL_TRAITS.length);
		assert.equal(parsed.linguistic_patterns.length, DEFAULT_LINGUISTIC_TRAITS.length);

		assert.deepEqual(parsed.psychology_and_worldviews, []);
		assert.deepEqual(parsed.lifestyle_and_preferences, []);
		assert.deepEqual(parsed.desires, []);
		assert.deepEqual(parsed.example_dialogs, []);
		assert.deepEqual(parsed.initial_states, {});
	});

	test("serializes and parses back in roundtrip", () => {
		const original: Characterfile = {
			metadata: {
				name: "roundtrip_hero",
				version: "1.2.3",
				title: "Roundtrip Hero",
				description: "Testing roundtrip consistency.",
				authors: ["Tester"],
				tags: ["test", "roundtrip"],
			},
			summary: "Hero on a journey.",
			physical_characteristics: [
				{ name: "Species", description: "Cyborg" },
				{ name: "Age", description: "45" },
				{ name: "Height", description: "185 cm" },
			],
			linguistic_patterns: [
				{ name: "Voice", description: "Gravelly" },
				{ name: "Accent", description: "Northern" },
				{ name: "Tone", description: "Direct" },
				{ name: "Dialect", description: "Colloquial" },
			],
			psychology_and_worldviews: [{ name: "Pragmatism", description: "Results matter." }],
			lifestyle_and_preferences: [{ name: "Coffee", description: "Espresso only." }],
			desires: [{ name: "Peace", description: "Wants retirement." }],
			skills: [{ name: "Combat", description: "Trained in plasma blade combat." }],
			backgrounds: [
				{ name: "Military", content: "Former military officer." },
				{ name: "Exile", content: "Exiled from home planet." },
			],
			example_dialogs: [{ name: "Briefing", dialog: "Let's get this done." }],
			initial_states: {
				morale: 80,
				equipped_weapon: "Plasma Blade",
			},
		};

		const serialized = serializeCharacterfile(original);
		const roundtripped = parseCharacterfile(serialized);

		assert.equal(roundtripped.metadata.name, original.metadata.name);
		assert.equal(roundtripped.metadata.title, original.metadata.title);
		assert.equal(roundtripped.summary, original.summary);
		assert.deepEqual(
			roundtripped.physical_characteristics,
			original.physical_characteristics,
		);
		assert.deepEqual(
			roundtripped.linguistic_patterns,
			original.linguistic_patterns,
		);
		assert.deepEqual(
			roundtripped.psychology_and_worldviews,
			original.psychology_and_worldviews,
		);
		assert.deepEqual(
			roundtripped.lifestyle_and_preferences,
			original.lifestyle_and_preferences,
		);
		assert.deepEqual(roundtripped.skills, original.skills);
		assert.deepEqual(roundtripped.backgrounds, original.backgrounds);
		assert.deepEqual(roundtripped.example_dialogs, original.example_dialogs);
		assert.deepEqual(roundtripped.initial_states, original.initial_states);
	});

	test("parses legacy string array backgrounds for backward compatibility", () => {
		const legacyToml = `
[metadata]
name = "legacy_char"
version = "1.0.0"
title = "Legacy Character"
description = "Legacy test"

backgrounds = [
  "First legacy background",
  "Second legacy background"
]
`;
		const parsed = parseCharacterfile(legacyToml);
		assert.equal(parsed.backgrounds.length, 2);
		assert.deepEqual(parsed.backgrounds, [
			{ name: "", content: "First legacy background" },
			{ name: "", content: "Second legacy background" },
		]);
	});

	test("parses Characterfile with multiline triple-quoted strings and flexible trait syntax", () => {
		const toml = `
name = "cyber_samurai"
version = "1.0.0"
title = "Cyber Samurai"
description = """
A wandering ronin in the neon dystopia.
Master of electromagnetic blades."""
authors = "Author One"
tags = "samurai"

summary = """
First line of character summary.
Second line of character summary."""

physical_characteristics = [
  "Species: Augmented Human",
  "Age - 32",
  "Height = 180cm",
  "Cybernetics"
]

linguistic_patterns = {
  Voice = "Resonant",
  Tone = "Stoic",
  Accent = "Neo-Tokyo"
}

backgrounds = """
Trained in the orbital dojo.
Banished after the corporate uprising."""

example_dialogs = {
  name = "Encounter",
  dialog = """
"You should not have come here."
*draws blade*"""
}
`;
		const parsed = parseCharacterfile(toml);
		assert.equal(parsed.metadata.name, "cyber_samurai");
		assert.equal(parsed.metadata.title, "Cyber Samurai");
		assert.equal(
			parsed.summary,
			"First line of character summary.\nSecond line of character summary.",
		);
		assert.ok(
			parsed.physical_characteristics.some(
				t => t.name === "Species" && t.description === "Augmented Human",
			),
		);
		assert.ok(
			parsed.physical_characteristics.some(
				t => t.name === "Age" && t.description === "32",
			),
		);
		assert.ok(
			parsed.linguistic_patterns.some(
				t => t.name === "Voice" && t.description === "Resonant",
			),
		);
		assert.deepEqual(parsed.backgrounds, [
			{
				name: "",
				content: "Trained in the orbital dojo.\nBanished after the corporate uprising.",
			},
		]);
		assert.deepEqual(parsed.example_dialogs, [
			{
				name: "Encounter",
				dialog: "\"You should not have come here.\"\n*draws blade*",
			},
		]);

		const serialized = serializeCharacterfile(parsed);
		assert.ok(serialized.includes("\"\"\""));

		const roundTripped = parseCharacterfile(serialized);
		assert.equal(roundTripped.summary, parsed.summary);
		assert.deepEqual(roundTripped.backgrounds, parsed.backgrounds);
	});

	test("rejects invalid TOML structure", () => {
		assert.throws(() => parseCharacterfile(""), /cannot be empty/);
		assert.throws(() => parseCharacterfile("invalid toml [[]"), /Failed to parse TOML/);
		assert.throws(
			() => parseCharacterfile("name = \"missing_metadata\""),
			/Field "metadata" must be an object/,
		);
		assert.throws(
			() =>
				parseCharacterfile(`
[metadata]
name = ""
version = "1.0.0"
title = "Title"
description = "Desc"
summary = "Summary"
`),
			/Field "metadata.name" cannot be empty/,
		);
		assert.throws(
			() =>
				parseCharacterfile(`
summary = "Summary"
physical_characteristics = "not an array"

[metadata]
name = "char"
version = "1.0.0"
title = "Title"
description = "Desc"
`),
			/Field "physical_characteristics" must be an array/,
		);
	});

	test("parses and serializes Characterfile with blueprints", () => {
		const toml = `
[metadata]
name = "sorceress"
version = "1.0.0"
title = "Sorceress"
description = "A powerful arcane spellcaster."
summary = "Arcane spellcaster"

[blueprints]
flags = ["awakened", "ascended"]

[[blueprints.gauges]]
key = "mana"
min = 0
max = 200
default_value = 100
max_delta_per_turn = 50

[[blueprints.gauges.tiers]]
id = "surge"
label = "Surge"
min = 150
max = 200
directive = "Cast spells with overpowering intensity."

[[blueprints.gauges.tiers]]
id = "normal"
label = "Normal"
min = 50
max = 149
directive = "Maintain steady magical cadence."

[[blueprints.gauges.tiers]]
id = "depleted"
label = "Depleted"
min = 0
max = 49
directive = "Gasp for breath and avoid spellcasting."

[[blueprints.inventories]]
key = "spellbook"
items = ["fireball", "teleport"]
`;
		const parsed = parseCharacterfile(toml);

		assert.ok(parsed.blueprints);
		assert.deepEqual(parsed.blueprints.flags, ["awakened", "ascended"]);
		assert.equal(parsed.blueprints.gauges?.length, 1);
		assert.equal(parsed.blueprints.gauges![0].key, "mana");
		assert.equal(parsed.blueprints.gauges![0].defaultValue, 100);
		assert.equal(parsed.blueprints.gauges![0].tiers.length, 3);
		assert.deepEqual(parsed.blueprints.inventories?.[0].items, ["fireball", "teleport"]);

		const serialized = serializeCharacterfile(parsed);
		const roundTripped = parseCharacterfile(serialized);

		assert.deepEqual(roundTripped.blueprints, parsed.blueprints);
	});
});
