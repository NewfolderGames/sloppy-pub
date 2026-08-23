// TOML Stringifier
//
// Custom TOML serializer that supports and preserves multiline strings
// formatted with triple double-quotes (""").

const BARE_KEY_REGEX = /^[A-Za-z0-9_-]+$/;

function extendedTypeOf(value: unknown): string {

	if (value === null) {
		return "null";
	}

	if (Array.isArray(value)) {
		return "array";
	}

	if (value instanceof Date) {
		return "date";
	}

	const rawType = typeof value;

	return rawType;

}

function formatSingleLineString(str: string): string {

	return JSON.stringify(str).replace(/\x7f/g, "\\u007f");

}

function isControlChar(code: number): boolean {

	return (code >= 0 && code <= 8)
		|| code === 11
		|| code === 12
		|| (code >= 14 && code <= 31)
		|| code === 127;

}

function formatMultilineString(str: string): string {

	let escaped = str.replace(/\\/g, "\\\\");

	// Escape any trailing quotes at the end of the string so closing delimiter is unambiguous
	escaped = escaped.replace(/"+$/, match => match.split("").map(() => "\\\"").join(""));

	// Escape triple quotes inside the string body
	escaped = escaped.replace(/"""/g, "\"\"\\\"");

	// Escape ASCII control characters except tab, newline, and carriage return
	let result = "";

	for (let index = 0; index < escaped.length; index++) {
		const char = escaped[index];
		const code = char.charCodeAt(0);

		if (isControlChar(code)) {
			const hex = code.toString(16).padStart(4, "0");
			result += `\\u${hex}`;
		}
		else {
			result += char;
		}
	}

	return `"""\n${result}"""`;

}

export function formatTomlString(str: string): string {

	if (str.includes("\n")) {
		return formatMultilineString(str);
	}

	return formatSingleLineString(str);

}

export function formatTomlKey(key: string): string {

	if (BARE_KEY_REGEX.test(key)) {
		return key;
	}

	return formatSingleLineString(key);

}

function isArrayOfTables(arr: unknown[]): boolean {

	if (arr.length === 0) {
		return false;
	}

	return arr.every(item => extendedTypeOf(item) === "object");

}

function stringifyValue(val: unknown, depth: number = 100): string {

	const type = extendedTypeOf(val);

	switch (type) {
		case "number": {
			const num = val as number;

			if (Number.isNaN(num)) {
				return "nan";
			}

			if (num === Infinity) {
				return "inf";
			}

			if (num === -Infinity) {
				return "-inf";
			}

			return num.toString();
		}

		case "bigint":
		case "boolean": {
			return String(val);
		}

		case "string": {
			return formatTomlString(val as string);
		}

		case "date": {
			return (val as Date).toISOString();
		}

		case "array": {
			return stringifyInlineArray(val as unknown[], depth - 1);
		}

		case "object": {
			return stringifyInlineTable(val as Record<string, unknown>, depth - 1);
		}

		default: {
			throw new TypeError(`Cannot serialize value of type "${type}" to TOML.`);
		}
	}

}

function stringifyInlineTable(obj: Record<string, unknown>, depth: number): string {

	const keys = Object.keys(obj);

	if (keys.length === 0) {
		return "{}";
	}

	const pairs = keys.map((key) => {
		const formattedKey = formatTomlKey(key);
		const formattedVal = stringifyValue(obj[key], depth - 1);
		return `${formattedKey} = ${formattedVal}`;
	});

	return `{ ${pairs.join(", ")} }`;

}

function stringifyInlineArray(arr: unknown[], depth: number): string {

	if (arr.length === 0) {
		return "[]";
	}

	const hasMultiline = arr.some(item => typeof item === "string" && item.includes("\n"));
	const serializedItems = arr.map(item => stringifyValue(item, depth - 1));

	if (hasMultiline || arr.length > 5 || serializedItems.some(item => item.length > 40)) {
		return `[\n  ${serializedItems.join(",\n  ")}\n]`;
	}

	return `[ ${serializedItems.join(", ")} ]`;

}

function stringifyTable(
	tableHeader: string,
	obj: Record<string, unknown>,
	prefix: string = "",
	depth: number = 100,
): string {

	let preamble = "";
	let nestedTables = "";
	const keys = Object.keys(obj);

	for (const key of keys) {
		const val = obj[key];

		if (val === null || val === undefined) {
			continue;
		}

		const type = extendedTypeOf(val);

		if (type === "array" && isArrayOfTables(val as unknown[])) {
			const formattedKey = formatTomlKey(key);
			const fullKey = prefix ? `${prefix}.${formattedKey}` : formattedKey;
			const tableArray = val as Record<string, unknown>[];

			for (const item of tableArray) {
				const separator = nestedTables ? "\n" : "";
				nestedTables += `${separator}[[${fullKey}]]\n`;
				nestedTables += stringifyTable("", item, fullKey, depth - 1);
			}
		}
		else if (type === "object") {
			const formattedKey = formatTomlKey(key);
			const fullKey = prefix ? `${prefix}.${formattedKey}` : formattedKey;
			const subTable = stringifyTable(fullKey, val as Record<string, unknown>, fullKey, depth - 1);

			if (subTable) {
				const separator = nestedTables ? "\n" : "";
				nestedTables += `${separator}${subTable}`;
			}
		}
		else {
			const formattedKey = formatTomlKey(key);
			const formattedValue = stringifyValue(val, depth);
			preamble += `${formattedKey} = ${formattedValue}\n`;
		}
	}

	if (tableHeader && (preamble || !nestedTables)) {
		preamble = preamble ? `[${tableHeader}]\n${preamble}` : `[${tableHeader}]\n`;
	}

	if (preamble && nestedTables) {
		return `${preamble}\n${nestedTables}`;
	}

	return preamble || nestedTables;

}

export function stringifyToml(obj: Record<string, unknown>): string {

	if (extendedTypeOf(obj) !== "object") {
		throw new TypeError("stringifyToml only accepts a record object.");
	}

	let result = stringifyTable("", obj, "", 100);

	if (result && !result.endsWith("\n")) {
		result += "\n";
	}

	return result;

}
