import { createTwoFilesPatch, structuredPatch } from "diff";
import type { DiffHunk, DiffHunkLine, LineEditOperation, StructuredDiff } from "./types.ts";

export function computeStructuredDiff(
	originalText: string,
	proposedText: string,
	contextLines: number = 3,
): StructuredDiff {

	const normalizedOriginal = originalText.replaceAll("\r\n", "\n");
	const normalizedProposed = proposedText.replaceAll("\r\n", "\n");

	if (normalizedOriginal === normalizedProposed) {
		return {
			hunks: [],
			additionsCount: 0,
			deletionsCount: 0,
			hasChanges: false,
		};
	}

	const patch = structuredPatch(
		"current",
		"proposed",
		normalizedOriginal,
		normalizedProposed,
		"",
		"",
		{ context: contextLines },
	);

	let additionsCount = 0;
	let deletionsCount = 0;

	const hunks: DiffHunk[] = patch.hunks.map((hunk) => {
		let currentOldLine = hunk.oldStart;
		let currentNewLine = hunk.newStart;

		const lines: DiffHunkLine[] = hunk.lines.map((line) => {
			const indicator = line[0];
			const content = line.slice(1);

			if (indicator === "+") {
				additionsCount++;
				const lineObj: DiffHunkLine = {
					type: "add",
					content,
					newLineNumber: currentNewLine,
				};
				currentNewLine++;
				return lineObj;
			}

			if (indicator === "-") {
				deletionsCount++;
				const lineObj: DiffHunkLine = {
					type: "delete",
					content,
					oldLineNumber: currentOldLine,
				};
				currentOldLine++;
				return lineObj;
			}

			const lineObj: DiffHunkLine = {
				type: "normal",
				content,
				oldLineNumber: currentOldLine,
				newLineNumber: currentNewLine,
			};
			currentOldLine++;
			currentNewLine++;
			return lineObj;
		});

		return {
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			lines,
		};
	});

	return {
		hunks,
		additionsCount,
		deletionsCount,
		hasChanges: additionsCount > 0 || deletionsCount > 0,
	};

}

export function computeUnifiedDiffString(
	title: string,
	originalText: string,
	proposedText: string,
): string {

	const normalizedOriginal = originalText.replace(/\r\n/g, "\n");
	const normalizedProposed = proposedText.replace(/\r\n/g, "\n");

	return createTwoFilesPatch(
		`current: ${title}`,
		`proposed: ${title}`,
		normalizedOriginal,
		normalizedProposed,
	);

}

export function isContentIdentical(a: string, b: string): boolean {

	return a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

}

export function applyLineEdits(
	originalText: string,
	edits: LineEditOperation[],
): string {

	if (!edits || edits.length === 0) {
		return originalText;
	}

	const hasTrailingNewline = originalText.endsWith("\n");
	const lineEnding = originalText.includes("\r\n") ? "\r\n" : "\n";
	const normalizedOriginal = originalText.replace(/\r\n/g, "\n");

	let lines = originalText.length === 0 ? [] : normalizedOriginal.split("\n");

	if (hasTrailingNewline && lines.length > 0 && lines[lines.length - 1] === "") {
		lines = lines.slice(0, -1);
	}

	interface NormalizedEdit {
		operation: "replace" | "insert" | "delete";
		startLine: number;
		endLine: number;
		contentLines: string[];
		sortKey: number;
	}

	const normalizedEdits: NormalizedEdit[] = [];

	for (let index = 0; index < edits.length; index++) {
		const edit = edits[index];

		if (!edit || typeof edit !== "object") {
			throw new Error(`Edit at index ${index} must be an object.`);
		}

		const { operation, position = "before" } = edit;

		if (operation !== "replace" && operation !== "insert" && operation !== "delete") {
			throw new Error(
				`Invalid edit operation "${operation}" at index ${index}. Must be 'replace', 'insert', or 'delete'.`,
			);
		}

		const rawStart = Number(edit.startLine);
		if (Number.isNaN(rawStart) || rawStart < 1) {
			throw new Error(`Invalid startLine "${edit.startLine}" at index ${index}. Must be an integer >= 1.`);
		}

		const content = typeof edit.content === "string" ? edit.content : "";
		const contentLines = content.length === 0 ? [] : content.replace(/\r\n/g, "\n").split("\n");

		if (operation === "insert") {
			const targetLine = position === "after" ? rawStart + 1 : rawStart;

			normalizedEdits.push({
				operation: "insert",
				startLine: targetLine,
				endLine: targetLine,
				contentLines,
				sortKey: targetLine,
			});

			continue;
		}

		const rawEnd = typeof edit.endLine === "number" ? Math.floor(edit.endLine) : rawStart;
		if (rawEnd < rawStart) {
			throw new Error(`Invalid endLine "${edit.endLine}" at index ${index}. Must be >= startLine (${rawStart}).`);
		}

		normalizedEdits.push({
			operation,
			startLine: rawStart,
			endLine: rawEnd,
			contentLines,
			sortKey: rawStart,
		});
	}

	// Check for overlapping replace/delete ranges
	const ranges = normalizedEdits.filter(e => e.operation !== "insert");
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			const a = ranges[i];
			const b = ranges[j];

			if (Math.max(a.startLine, b.startLine) <= Math.min(a.endLine, b.endLine)) {
				throw new Error(
					`Overlapping edit ranges detected between lines ${a.startLine}..${a.endLine} and lines ${b.startLine}..${b.endLine}.`,
				);
			}
		}
	}

	// Sort edits descending by sortKey so later edits do not shift earlier edit indices
	normalizedEdits.sort((a, b) => b.sortKey - a.sortKey);

	for (const edit of normalizedEdits) {
		if (edit.operation === "insert") {
			const insertIndex = Math.min(Math.max(edit.startLine - 1, 0), lines.length);
			lines.splice(insertIndex, 0, ...edit.contentLines);

			continue;
		}

		if (edit.operation === "delete") {
			const deleteIndex = Math.min(Math.max(edit.startLine - 1, 0), lines.length);
			const count = Math.max(0, Math.min(edit.endLine, lines.length) - edit.startLine + 1);
			lines.splice(deleteIndex, count);

			continue;
		}

		if (edit.operation === "replace") {
			const replaceIndex = Math.min(Math.max(edit.startLine - 1, 0), lines.length);
			const count = Math.max(0, Math.min(edit.endLine, lines.length) - edit.startLine + 1);
			lines.splice(replaceIndex, count, ...edit.contentLines);

			continue;
		}
	}

	let result = lines.join(lineEnding);

	if (hasTrailingNewline && lines.length > 0 && !result.endsWith(lineEnding)) {
		result += lineEnding;
	}

	return result;

}

export function formatLineNumberedContent(content: string): string {

	if (!content) {
		return "";
	}

	const normalized = content.replace(/\r\n/g, "\n");
	const lines = normalized.split("\n");
	const padWidth = Math.max(String(lines.length).length, 2);

	return lines
		.map((line, index) => {
			const lineNum = String(index + 1).padStart(padWidth, " ");
			return `${lineNum} | ${line}`;
		})
		.join("\n");

}
