import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { assembleSystemPrompt, interpolateText } from "./builder.ts";

describe("interpolateText & assembleSystemPrompt", () => {
	test("interpolates arguments correctly", () => {
		const map = new Map<string, string>([
			["DISTRICT", "Sector 7"],
			["HERO", "Neon"],
		]);

		const result = interpolateText("Welcome to {{DISTRICT}}, {{ HERO }}!", map);
		assert.equal(result, "Welcome to Sector 7, Neon!");
	});

	test("throws on undefined placeholder token", () => {
		const map = new Map<string, string>([["NAME", "Ghost"]]);

		assert.throws(
			() => interpolateText("Hello {{UNKNOWN}}", map),
			/Undefined argument token: "{{UNKNOWN}}"/,
		);
	});

	test("assembles system prompt with rules, guidelines, and top-level guidelines", () => {
		const prompt = assembleSystemPrompt(
			"Metropolis",
			["A dark futuristic metropolis."],
			["Rule 1: No weapons.", "Rule 2: Curfew at midnight."],
			["Guideline 1: Stay in character."],
			["Guideline 2: Top-level directive."],
		);

		assert.equal(
			prompt,
			`You are the narrator for the Metropolis setting.

---

<!-- Description of the setting. -->

A dark futuristic metropolis.

---

<!-- Rules of the world and the universe -->

Rule 1: No weapons.

Rule 2: Curfew at midnight.

---

<!-- Guidelines for the narrator. -->

Guideline 2: Top-level directive.

Guideline 1: Stay in character.`,
		);
	});

	test("assembles system prompt with guidelines only from top-level", () => {
		const prompt = assembleSystemPrompt(
			"Metropolis",
			["A dark futuristic metropolis."],
			["Rule 1: No weapons."],
			[],
			["Guideline 1: Top-level directive."],
		);

		assert.equal(
			prompt,
			`You are the narrator for the Metropolis setting.

---

<!-- Description of the setting. -->

A dark futuristic metropolis.

---

<!-- Rules of the world and the universe -->

Rule 1: No weapons.

---

<!-- Guidelines for the narrator. -->

Guideline 1: Top-level directive.`,
		);
	});

	test("assembles system prompt with guidelines only from settings.guidelines (backward compat)", () => {
		const prompt = assembleSystemPrompt(
			"Metropolis",
			["A dark futuristic metropolis."],
			["Rule 1: No weapons."],
			["Guideline 1: Legacy guideline."],
		);

		assert.equal(
			prompt,
			`You are the narrator for the Metropolis setting.

---

<!-- Description of the setting. -->

A dark futuristic metropolis.

---

<!-- Rules of the world and the universe -->

Rule 1: No weapons.

---

<!-- Guidelines for the narrator. -->

Guideline 1: Legacy guideline.`,
		);
	});

	test("assembles system prompt with multiple background entries", () => {
		const prompt = assembleSystemPrompt(
			"Metropolis",
			["A dark futuristic metropolis.", "Neon lights flicker in the endless drizzle."],
			["Rule 1: No weapons."],
			["Guideline 1: Stay in character."],
		);

		assert.equal(
			prompt,
			`You are the narrator for the Metropolis setting.

---

<!-- Description of the setting. -->

A dark futuristic metropolis.

Neon lights flicker in the endless drizzle.

---

<!-- Rules of the world and the universe -->

Rule 1: No weapons.

---

<!-- Guidelines for the narrator. -->

Guideline 1: Stay in character.`,
		);
	});
});
