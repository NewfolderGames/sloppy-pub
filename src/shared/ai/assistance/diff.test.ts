import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyLineEdits, computeStructuredDiff, computeUnifiedDiffString, formatLineNumberedContent, isContentIdentical } from "./diff.ts";

describe("Assistant Diff Engine", () => {

	it("returns zero changes when original and proposed content are identical", () => {
		const original = "name = \"Old World\"\nversion = \"1.0.0\"";
		const proposed = "name = \"Old World\"\nversion = \"1.0.0\"";

		const result = computeStructuredDiff(original, proposed);

		assert.strictEqual(result.hasChanges, false);
		assert.strictEqual(result.additionsCount, 0);
		assert.strictEqual(result.deletionsCount, 0);
		assert.strictEqual(result.hunks.length, 0);
		assert.strictEqual(isContentIdentical(original, proposed), true);
	});

	it("normalizes CRLF and LF newlines when detecting identical content", () => {
		const original = "line1\r\nline2\r\n";
		const proposed = "line1\nline2\n";

		assert.strictEqual(isContentIdentical(original, proposed), true);
		const result = computeStructuredDiff(original, proposed);
		assert.strictEqual(result.hasChanges, false);
	});

	it("detects line additions accurately", () => {
		const original = "alpha = 1\n";
		const proposed = "alpha = 1\nbeta = 2\ngamma = 3\n";

		const result = computeStructuredDiff(original, proposed);

		assert.strictEqual(result.hasChanges, true);
		assert.strictEqual(result.additionsCount, 2);
		assert.strictEqual(result.deletionsCount, 0);
		assert.ok(result.hunks.length > 0);

		const addedLines = result.hunks[0].lines.filter(l => l.type === "add");
		assert.strictEqual(addedLines.length, 2);
		assert.strictEqual(addedLines[0].content, "beta = 2");
		assert.strictEqual(addedLines[1].content, "gamma = 3");
	});

	it("detects line deletions and modifications", () => {
		const original = "header = true\nitem = \"old\"\nfooter = true\n";
		const proposed = "header = true\nitem = \"new\"\nfooter = true\n";

		const result = computeStructuredDiff(original, proposed);

		assert.strictEqual(result.hasChanges, true);
		assert.strictEqual(result.additionsCount, 1);
		assert.strictEqual(result.deletionsCount, 1);

		const deleteLine = result.hunks[0].lines.find(l => l.type === "delete");
		const addLine = result.hunks[0].lines.find(l => l.type === "add");

		assert.ok(deleteLine);
		assert.strictEqual(deleteLine.content, "item = \"old\"");
		assert.ok(addLine);
		assert.strictEqual(addLine.content, "item = \"new\"");
	});

	it("generates a unified diff string with file labels", () => {
		const original = "foo\n";
		const proposed = "bar\n";

		const patchString = computeUnifiedDiffString("Worldfile", original, proposed);

		assert.ok(patchString.includes("current: Worldfile"));
		assert.ok(patchString.includes("proposed: Worldfile"));
		assert.ok(patchString.includes("-foo"));
		assert.ok(patchString.includes("+bar"));
	});

	it("replaces a single line via applyLineEdits", () => {
		const original = "line1\nline2\nline3\n";
		const edited = applyLineEdits(original, [
			{
				operation: "replace",
				startLine: 2,
				endLine: 2,
				content: "line2_replaced",
			},
		]);

		assert.strictEqual(edited, "line1\nline2_replaced\nline3\n");
	});

	it("replaces a multi-line range via applyLineEdits", () => {
		const original = "[metadata]\nname = \"old\"\nversion = \"0.1\"\ntitle = \"World\"\n";
		const edited = applyLineEdits(original, [
			{
				operation: "replace",
				startLine: 2,
				endLine: 3,
				content: "name = \"new_name\"\nversion = \"1.0.0\"",
			},
		]);

		assert.strictEqual(edited, "[metadata]\nname = \"new_name\"\nversion = \"1.0.0\"\ntitle = \"World\"\n");
	});

	it("inserts content before or after targeted lines via applyLineEdits", () => {
		const original = "alpha = 1\nbeta = 2\n";

		// Insert before line 1
		const insertBefore = applyLineEdits(original, [
			{
				operation: "insert",
				startLine: 1,
				position: "before",
				content: "header = true",
			},
		]);
		assert.strictEqual(insertBefore, "header = true\nalpha = 1\nbeta = 2\n");

		// Insert after line 2
		const insertAfter = applyLineEdits(original, [
			{
				operation: "insert",
				startLine: 2,
				position: "after",
				content: "gamma = 3",
			},
		]);
		assert.strictEqual(insertAfter, "alpha = 1\nbeta = 2\ngamma = 3\n");
	});

	it("deletes targeted lines via applyLineEdits", () => {
		const original = "one\ntwo\nthree\nfour\n";
		const edited = applyLineEdits(original, [
			{
				operation: "delete",
				startLine: 2,
				endLine: 3,
			},
		]);

		assert.strictEqual(edited, "one\nfour\n");
	});

	it("applies multiple non-overlapping edits preserving line references", () => {
		const original = "line1\nline2\nline3\nline4\nline5\n";
		const edited = applyLineEdits(original, [
			{
				operation: "replace",
				startLine: 2,
				content: "line2_modified",
			},
			{
				operation: "insert",
				startLine: 4,
				position: "after",
				content: "line4_plus",
			},
		]);

		assert.strictEqual(
			edited,
			"line1\nline2_modified\nline3\nline4\nline4_plus\nline5\n",
		);
	});

	it("throws on overlapping replace/delete ranges", () => {
		const original = "line1\nline2\nline3\nline4\n";

		assert.throws(() => {
			applyLineEdits(original, [
				{
					operation: "replace",
					startLine: 2,
					endLine: 4,
					content: "foo",
				},
				{
					operation: "delete",
					startLine: 3,
					endLine: 3,
				},
			]);
		}, /Overlapping edit ranges/);
	});

	it("formats line-numbered content correctly", () => {
		const content = "alpha\nbeta\ngamma";
		const numbered = formatLineNumberedContent(content);

		assert.strictEqual(
			numbered,
			" 1 | alpha\n 2 | beta\n 3 | gamma",
		);
		assert.strictEqual(formatLineNumberedContent(""), "");
	});

});
