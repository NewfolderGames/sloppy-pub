import { getCharacterfile } from "../character/registry.ts";
import { getUniverse } from "../universe/registry.ts";
import { getWorldfile } from "../world/registry.ts";
import type { VariableDefinition } from "../world/types.ts";

export interface GenerateInstanceContext {
	worldId: string;
	vars: Record<string, VariableDefinition>;
	universeId?: string;
	characterIds?: string[];
	llmCall?: (prompt: string) => Promise<string>;
}

export function buildGenerationPrompt(context: GenerateInstanceContext): string {
	const world = getWorldfile(context.worldId)?.worldfile;
	const universe = context.universeId ? getUniverse(context.universeId)?.universe : undefined;
	const characters = (context.characterIds || [])
		.map(id => getCharacterfile(id)?.characterfile)
		.filter((c): c is NonNullable<typeof c> => c !== undefined);

	const sections: string[] = [
		"You are an AI World Roleplay Generator.",
		"Generate initial variable values and settings for a new world roleplay session based on the setting context.",
	];

	if (world) {
		sections.push(`World Title: ${world.metadata.title}`);
		if (world.content.description) {
			sections.push(`World Description: ${world.content.description}`);
		}
		if (world.content.guidelines && world.content.guidelines.length > 0) {
			sections.push(`Guidelines: ${world.content.guidelines.join("; ")}`);
		}
	}

	if (universe) {
		sections.push(`Universe: ${universe.metadata.title}`);
		if (universe.metadata.description) {
			sections.push(`Universe Description: ${universe.metadata.description}`);
		}
	}

	if (characters.length > 0) {
		sections.push("Characters in Session:");
		for (const char of characters) {
			sections.push(`- ${char.metadata.title}: ${char.summary || char.metadata.description}`);
		}
	}

	sections.push("\nVariables to Generate (return a JSON object mapping each variable name to a suitable value):");
	for (const [name, def] of Object.entries(context.vars)) {
		let typeInfo = `type: ${def.type}`;
		if (def.values && def.values.length > 0) {
			typeInfo += `, options: [${def.values.join(", ")}]`;
		}
		if (def.default !== undefined) {
			typeInfo += `, default: ${JSON.stringify(def.default)}`;
		}
		if (def.description) {
			typeInfo += `, description: ${def.description}`;
		}
		sections.push(`- "${name}" (${typeInfo})`);
	}

	sections.push("\nOutput valid JSON ONLY without explanation, for example: {\"var1\": \"value1\", \"var2\": 10}");
	return sections.join("\n");
}
