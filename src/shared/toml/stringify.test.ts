import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "smol-toml";
import { formatTomlKey, formatTomlString, stringifyToml } from "./stringify.ts";

describe("TOML Stringifier", () => {

	it("formats single-line strings and keys", () => {
		assert.equal(formatTomlString("hello world"), "\"hello world\"");
		assert.equal(formatTomlKey("simple_key"), "simple_key");
		assert.equal(formatTomlKey("dotted.key"), "\"dotted.key\"");
		assert.equal(formatTomlKey("spaced key"), "\"spaced key\"");
	});

	it("formats multiline strings using triple double-quotes", () => {
		const multiline = "Line 1\nLine 2\nLine 3";
		const formatted = formatTomlString(multiline);

		assert.ok(formatted.startsWith("\"\"\"\n"));
		assert.ok(formatted.endsWith("\"\"\""));

		const parsed = parse(`content = ${formatted}`) as { content: string };
		assert.equal(parsed.content, multiline);
	});

	it("handles multiline strings with trailing quotes, triple quotes, and special characters", () => {
		const testCases = [
			"Hello\nWorld",
			"Hello\nWorld\n",
			"\nHello\nWorld",
			"\n\nHello\n\nWorld\n\n",
			"Line 1\r\nLine 2",
			"Line 1\n\"Line 2 with quotes\"\nLine 3",
			"Line 1\n\"\"\"triple quotes\"\"\"\nLine 3",
			"Line 1\n\"\"\"\"four quotes\"\"\"\"\nLine 3",
			"Line 1\nEnding with one quote \"",
			"Line 1\nEnding with two quotes \"\"",
			"Line 1\nEnding with three quotes \"\"\"",
			"Line 1\nEnding with four quotes \"\"\"\"",
			"Line 1\nEnding with quote and newline \"\n",
			"Line 1\nEnding with two quotes and newline \"\"\n",
			"Line 1\nEnding with three quotes and newline \"\"\"\n",
			"Path: C:\\Program Files\\App\nNext line",
			"Line 1\tTabbed\nLine 2",
		];

		for (const testCase of testCases) {
			const toml = stringifyToml({ val: testCase });
			const parsed = parse(toml) as { val: string };
			assert.equal(parsed.val, testCase);
		}
	});

	it("serializes nested tables and arrays of tables", () => {
		const doc = {
			name: "cyberpunk",
			version: "1.0.0",
			description: "Line 1\nLine 2",
			tags: ["tag1", "tag2"],
			content: {
				backgrounds: [
					"Background 1\nMulti line",
					"Background 2 single",
				],
				settings: {
					rules: ["Rule 1", "Rule 2"],
				},
			},
			entries: [
				{ id: "e1", content: "Entry 1\nDetails" },
				{ id: "e2", content: "Entry 2" },
			],
			states: {
				"player.hp": 100,
				"player.alive": true,
			},
		};

		const toml = stringifyToml(doc);
		const parsed = parse(toml) as typeof doc;

		assert.equal(parsed.name, doc.name);
		assert.equal(parsed.version, doc.version);
		assert.equal(parsed.description, doc.description);
		assert.deepEqual(parsed.tags, doc.tags);
		assert.deepEqual(parsed.content.backgrounds, doc.content.backgrounds);
		assert.deepEqual(parsed.content.settings.rules, doc.content.settings.rules);
		assert.deepEqual(parsed.entries, doc.entries);
		assert.deepEqual(parsed.states, doc.states);
	});

});
