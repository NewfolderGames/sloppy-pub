import type { WorldStates } from "@/shared/world/types.ts";

export interface StateRow {
	key: string;
	type: "string" | "number" | "boolean" | "array";
	value: string;
}

export function stateMapToRows(states?: Record<string, unknown>): StateRow[] {

	if (!states) {
		return [];
	}

	return Object.entries(states).map(([key, value]) => {

		if (Array.isArray(value)) {
			return {
				key,
				type: "array",
				value: value.map(String).join(", "),
			};
		}

		if (typeof value === "number") {
			return {
				key,
				type: "number",
				value: String(value),
			};
		}

		if (typeof value === "boolean") {
			return {
				key,
				type: "boolean",
				value: String(value),
			};
		}

		return {
			key,
			type: "string",
			value: String(value ?? ""),
		};

	});

}

export function stateRowsToMap(
	rows: StateRow[],
): Record<string, string | number | boolean | Array<string | number | boolean>> {

	const map: WorldStates = {};

	for (const row of rows) {

		const key = row.key.trim();

		if (!key) {
			continue;
		}

		if (row.type === "number") {
			const num = Number(row.value);
			map[key] = Number.isNaN(num) ? 0 : num;
		}
		else if (row.type === "boolean") {
			map[key] = row.value === "true";
		}
		else if (row.type === "array") {
			map[key] = row.value
				.split(",")
				.map(item => item.trim())
				.filter(item => item.length > 0);
		}
		else {
			map[key] = row.value;
		}

	}

	return map;

}
