import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCharacterInstancesPrompt, formatCharacterPrompt } from "./builder.ts";
import type { Characterfile, CharacterInstance } from "./types.ts";

describe("Character Builder", () => {
	const sampleCharacter: Characterfile = {
		metadata: {
			name: "dr_elena",
			version: "1.0.0",
			title: "Dr. Elena Vance",
			description: "Lead astrophysicist at Kepler Observatory.",
		},
		summary: "Dr. Elena Vance investigates anomalies in stellar telemetry.",
		physical_characteristics: [
			{ name: "Species", description: "Human" },
			{ name: "Age", description: "34" },
			{ name: "Height", description: "172 cm" },
		],
		linguistic_patterns: [
			{ name: "Voice", description: "Measured and calm" },
			{ name: "Accent", description: "Mid-Atlantic" },
			{ name: "Tone", description: "Analytical" },
			{ name: "Dialect", description: "Technical English" },
		],
		psychology_and_worldviews: [
			{ name: "Curiosity", description: "Fascinated by unsolved cosmological questions." },
		],
		lifestyle_and_preferences: [
			{ name: "Work Habits", description: "Works late hours in the lab." },
		],
		desires: [
			{ name: "Decode Signal", description: "Decipher the periodic interstellar broadcast." },
		],
		skills: [],
		backgrounds: [],
		example_dialogs: [
			{ name: "Observation", dialog: "The waveform displays non-random modulation." },
		],
		initial_states: {
			focus: 100,
		},
	};

	const sampleInstance: CharacterInstance = {
		id: "inst_1",
		characterId: "dr_elena",
		name: "Dr. Elena Vance",
		thoughts: [
			{
				id: "t1",
				title: "Signal Pattern",
				internal_monologue: "The pulse intervals follow prime numbers.",
			},
		],
		emotions: [
			{
				id: "e1",
				name: "Excitement",
				internal_monologue: "This confirms an artificial origin.",
			},
		],
		goals: [
			{
				id: "g1",
				name: "Isolate Frequency",
				internal_monologue: "Filter out cosmic background noise.",
			},
		],
		states: {
			alert_level: "yellow",
			active_receivers: 4,
			coordinates: ["Sector 7", "Array B"],
		},
	};

	describe("formatCharacterPrompt", () => {
		it("returns empty string when characters is null or empty", () => {
			assert.equal(formatCharacterPrompt(null), "");
			assert.equal(formatCharacterPrompt(undefined), "");
			assert.equal(formatCharacterPrompt([]), "");
		});

		it("returns string as-is when input is a string", () => {
			assert.equal(formatCharacterPrompt("Custom character prompt"), "Custom character prompt");
		});

		it("formats single character profile into markdown", () => {
			const prompt = formatCharacterPrompt(sampleCharacter);

			assert.ok(prompt.includes("# Characters"));
			assert.ok(prompt.includes("## Dr. Elena Vance"));
			assert.ok(prompt.includes("Dr. Elena Vance investigates anomalies in stellar telemetry."));
			assert.ok(prompt.includes("### Physical Characteristics"));
			assert.ok(prompt.includes("- Species: Human"));
			assert.ok(prompt.includes("### Linguistic Patterns"));
			assert.ok(prompt.includes("- Voice: Measured and calm"));
			assert.ok(prompt.includes("### Psychology and Worldviews"));
			assert.ok(prompt.includes("- Curiosity: Fascinated by unsolved cosmological questions."));
			assert.ok(prompt.includes("### Lifestyle and Preferences"));
			assert.ok(prompt.includes("- Work Habits: Works late hours in the lab."));
			assert.ok(prompt.includes("### Desires"));
			assert.ok(prompt.includes("- Decode Signal: Decipher the periodic interstellar broadcast."));
			assert.ok(prompt.includes("### Example Dialogs"));
			assert.ok(prompt.includes("- Observation: \"The waveform displays non-random modulation.\""));
		});

		it("formats multiple character profiles", () => {
			const secondCharacter: Characterfile = {
				metadata: {
					name: "marcus",
					version: "1.0.0",
					title: "Marcus Thorne",
					description: "Chief of security.",
				},
				summary: "Marcus ensures observatory perimeter security.",
				physical_characteristics: [{ name: "Species", description: "Human" }],
				linguistic_patterns: [{ name: "Voice", description: "Gravelly" }],
				psychology_and_worldviews: [],
				lifestyle_and_preferences: [],
				desires: [],
				skills: [],
				backgrounds: [],
				example_dialogs: [],
				initial_states: {},
			};

			const prompt = formatCharacterPrompt([sampleCharacter, secondCharacter]);

			assert.ok(prompt.includes("## Dr. Elena Vance"));
			assert.ok(prompt.includes("## Marcus Thorne"));
			assert.ok(prompt.includes("Marcus ensures observatory perimeter security."));
		});
	});

	describe("formatCharacterInstancesPrompt", () => {
		it("returns empty string when instances is null or empty", () => {
			assert.equal(formatCharacterInstancesPrompt(null), "");
			assert.equal(formatCharacterInstancesPrompt(undefined), "");
			assert.equal(formatCharacterInstancesPrompt([]), "");
		});

		it("returns string as-is when input is a string", () => {
			assert.equal(
				formatCharacterInstancesPrompt("Custom instances prompt"),
				"Custom instances prompt",
			);
		});

		it("formats character instance with thoughts, emotions, goals, and states", () => {
			const prompt = formatCharacterInstancesPrompt(sampleInstance);

			assert.ok(prompt.includes("# Character Instances"));
			assert.ok(prompt.includes("## Dr. Elena Vance"));
			assert.ok(prompt.includes("### Recent Thoughts"));
			assert.ok(prompt.includes("- Signal Pattern: The pulse intervals follow prime numbers."));
			assert.ok(prompt.includes("### Recent Emotions"));
			assert.ok(prompt.includes("- Excitement: This confirms an artificial origin."));
			assert.ok(prompt.includes("### Goals"));
			assert.ok(prompt.includes("- Isolate Frequency: Filter out cosmic background noise."));
			assert.ok(prompt.includes("### States"));
			assert.ok(prompt.includes("- alert_level: yellow"));
			assert.ok(prompt.includes("- active_receivers: 4"));
			assert.ok(prompt.includes("- coordinates: [Sector 7, Array B]"));
		});
	});
});
