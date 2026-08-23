import test from "node:test";
import assert from "node:assert/strict";
import { stateMapToRows, stateRowsToMap } from "./state_helpers.ts";

test("stateMapToRows converts empty or undefined states into an empty array", () => {

	assert.deepEqual(stateMapToRows(undefined), []);
	assert.deepEqual(stateMapToRows({}), []);

});

test("stateMapToRows converts primitive types and arrays to rows", () => {

	const input = {
		"test.str": "hello",
		"test.num": 42,
		"test.bool": true,
		"test.arr": ["alpha", 1, false],
	};

	const rows = stateMapToRows(input);

	assert.equal(rows.length, 4);
	assert.deepEqual(rows.find(r => r.key === "test.str"), {
		key: "test.str",
		type: "string",
		value: "hello",
	});
	assert.deepEqual(rows.find(r => r.key === "test.num"), {
		key: "test.num",
		type: "number",
		value: "42",
	});
	assert.deepEqual(rows.find(r => r.key === "test.bool"), {
		key: "test.bool",
		type: "boolean",
		value: "true",
	});
	assert.deepEqual(rows.find(r => r.key === "test.arr"), {
		key: "test.arr",
		type: "array",
		value: "alpha, 1, false",
	});

});

test("stateRowsToMap ignores empty keys and converts typed rows to values", () => {

	const rows = [
		{ key: "  ", type: "string" as const, value: "ignored" },
		{ key: "item.count", type: "number" as const, value: "10" },
		{ key: "item.invalid_num", type: "number" as const, value: "invalid" },
		{ key: "item.active", type: "boolean" as const, value: "true" },
		{ key: "item.inactive", type: "boolean" as const, value: "false" },
		{ key: "item.tags", type: "array" as const, value: "tag1, tag2,  " },
		{ key: "item.name", type: "string" as const, value: "sword" },
	];

	const mapped = stateRowsToMap(rows);

	assert.equal(mapped["item.count"], 10);
	assert.equal(mapped["item.invalid_num"], 0);
	assert.equal(mapped["item.active"], true);
	assert.equal(mapped["item.inactive"], false);
	assert.deepEqual(mapped["item.tags"], ["tag1", "tag2"]);
	assert.equal(mapped["item.name"], "sword");
	assert.equal(Object.keys(mapped).length, 6);

});
