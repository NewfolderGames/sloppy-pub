import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	ALL_ASSISTANT_TOOLS,
} from "../assistance/schemas.ts";

interface GenericToolSchema {
	type: string;
	function: {
		name: string;
		description?: string;
		parameters?: {
			type?: string;
			properties?: Record<string, unknown>;
			required?: readonly string[];
		};
	};
}

describe("Tool Schema Validation", () => {

	const allAssistantTools: GenericToolSchema[] = ALL_ASSISTANT_TOOLS as unknown as GenericToolSchema[];

	it("verifies every assistant tool specifies type: function", () => {
		for (const tool of allAssistantTools) {
			assert.strictEqual(
				tool.type,
				"function",
				`Tool ${tool.function?.name ?? "unknown"} must have type: "function"`,
			);
		}
	});

	it("verifies every assistant tool has a valid function object and non-empty name", () => {
		for (const tool of allAssistantTools) {
			assert.ok(tool.function, "Tool must have a function property");
			assert.ok(
				typeof tool.function.name === "string" && tool.function.name.trim().length > 0,
				"Tool function name must be a non-empty string",
			);
			assert.ok(
				typeof tool.function.description === "string" && tool.function.description.trim().length > 0,
				`Tool ${tool.function.name} must have a non-empty description`,
			);
		}
	});

	it("verifies parameters schema format for every assistant tool", () => {
		for (const tool of allAssistantTools) {
			const params = tool.function.parameters;
			if (!params) {
				continue;
			}

			assert.strictEqual(
				params.type,
				"object",
				`Tool ${tool.function.name} parameters must have type: "object"`,
			);

			if (params.properties) {
				assert.strictEqual(
					typeof params.properties,
					"object",
					`Tool ${tool.function.name} properties must be an object`,
				);
			}

			if (params.required) {
				assert.ok(
					Array.isArray(params.required),
					`Tool ${tool.function.name} required must be an array`,
				);

				const propKeys = new Set(Object.keys(params.properties ?? {}));
				for (const requiredKey of params.required) {
					assert.ok(
						propKeys.has(requiredKey),
						`Tool ${tool.function.name} requires '${requiredKey}', but it is missing in properties`,
					);
				}
			}
		}
	});

	it("verifies all assistant tool names are unique", () => {
		const names = new Set<string>();
		for (const tool of allAssistantTools) {
			assert.ok(
				!names.has(tool.function.name),
				`Duplicate assistant tool name detected: ${tool.function.name}`,
			);
			names.add(tool.function.name);
		}
	});

});
