import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	PROPOSE_CHARACTER_MODIFICATION_TOOL,
	PROPOSE_LORE_MODIFICATION_TOOL,
	PROPOSE_PROMPT_MODIFICATION_TOOL,
	PROPOSE_UNIVERSE_MODIFICATION_TOOL,
	PROPOSE_WORLD_MODIFICATION_TOOL,
} from "../assistance/schemas.ts";
import { CHARACTER_TOOL_DEFINITIONS, CHARACTER_TOOL_NAMES } from "../../character/tools.ts";
import { LORE_TOOL_DEFINITIONS, LORE_TOOL_NAMES } from "../../lore/tools.ts";
import { STATE_TOOL_DEFINITIONS, STATE_TOOL_NAMES } from "../../world/state_tools.ts";
import { CHAPTER_TOOL_DEFINITIONS, CHAPTER_TOOL_NAMES } from "../../world/tools/chapter_tools.ts";
import { DIRECTOR_TOOL_DEFINITIONS, DIRECTOR_TOOL_NAMES } from "../../world/tools/director_tools.ts";
import { EVENT_TOOL_DEFINITIONS, EVENT_TOOL_NAMES } from "../../world/tools/event_tools.ts";

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

	const allAssistantTools: GenericToolSchema[] = [
		PROPOSE_WORLD_MODIFICATION_TOOL,
		PROPOSE_UNIVERSE_MODIFICATION_TOOL,
		PROPOSE_CHARACTER_MODIFICATION_TOOL,
		PROPOSE_LORE_MODIFICATION_TOOL,
		PROPOSE_PROMPT_MODIFICATION_TOOL,
	];

	const allChatTools: GenericToolSchema[] = [
		...STATE_TOOL_DEFINITIONS,
		...CHARACTER_TOOL_DEFINITIONS,
		...LORE_TOOL_DEFINITIONS,
		...EVENT_TOOL_DEFINITIONS,
		...CHAPTER_TOOL_DEFINITIONS,
		...DIRECTOR_TOOL_DEFINITIONS,
	];

	const allTools: GenericToolSchema[] = [
		...allAssistantTools,
		...allChatTools,
	];

	it("verifies every tool specifies type: function", () => {
		for (const tool of allTools) {
			assert.strictEqual(
				tool.type,
				"function",
				`Tool ${tool.function?.name ?? "unknown"} must have type: "function"`,
			);
		}
	});

	it("verifies every tool has a valid function object and non-empty name", () => {
		for (const tool of allTools) {
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

	it("verifies parameters schema format for every tool", () => {
		for (const tool of allTools) {
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

	it("verifies tool names match their respective exported tool name sets", () => {
		for (const tool of STATE_TOOL_DEFINITIONS) {
			assert.ok(STATE_TOOL_NAMES.has(tool.function.name));
		}
		for (const tool of CHARACTER_TOOL_DEFINITIONS) {
			assert.ok(CHARACTER_TOOL_NAMES.has(tool.function.name));
		}
		for (const tool of LORE_TOOL_DEFINITIONS) {
			assert.ok(LORE_TOOL_NAMES.has(tool.function.name));
		}
		for (const tool of EVENT_TOOL_DEFINITIONS) {
			assert.ok(EVENT_TOOL_NAMES.has(tool.function.name));
		}
		for (const tool of CHAPTER_TOOL_DEFINITIONS) {
			assert.ok(CHAPTER_TOOL_NAMES.has(tool.function.name));
		}
		for (const tool of DIRECTOR_TOOL_DEFINITIONS) {
			assert.ok(DIRECTOR_TOOL_NAMES.has(tool.function.name));
		}
	});

	it("verifies all chat tool names are unique", () => {
		const names = new Set<string>();
		for (const tool of allChatTools) {
			assert.ok(
				!names.has(tool.function.name),
				`Duplicate chat tool name detected: ${tool.function.name}`,
			);
			names.add(tool.function.name);
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
