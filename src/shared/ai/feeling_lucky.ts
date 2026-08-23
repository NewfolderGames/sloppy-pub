import type { Characterfile } from "../character/types.ts";
import type { LoreBook } from "../lore/types.ts";
import type { Universefile, Worldfile } from "../world/types.ts";
import { OpenAIClient } from "./llm/client.ts";
import type { ChatCompletionRequest } from "./llm/request.ts";

export type FeelingLuckyTemplateType = "world" | "universe" | "character" | "lore";

export interface GenerateFieldContentInput {
	templateType: FeelingLuckyTemplateType;
	fieldName: string;
	context?: Record<string, unknown>;
	currentValue?: string;
	llmCall?: (prompt: string) => Promise<string>;
}

export interface PreprocessFeelingLuckyInput {
	worldfile: Worldfile;
	universe?: Universefile;
	characters?: Characterfile[];
	lorebooks?: LoreBook[];
	llmCall?: (prompt: string) => Promise<string>;
}

export interface PreprocessFeelingLuckyResult {
	worldfile: Worldfile;
	universe?: Universefile;
	characters?: Characterfile[];
	lorebooks?: LoreBook[];
}

export function buildFieldGenerationPrompt(input: GenerateFieldContentInput): string {
	const sections: string[] = [
		"You generate creative content for a roleplay template field.",
		`Template type: ${input.templateType}`,
		`Field name: ${input.fieldName}`,
		"Return only the generated field text. Do not wrap it in JSON or markdown fences.",
	];

	if (input.context && Object.keys(input.context).length > 0) {
		sections.push(`Context JSON:\n\n${JSON.stringify(input.context, null, 2)}`);
	}

	if (input.currentValue && input.currentValue.trim().length > 0) {
		sections.push(`Current value (improve or expand):\n\n${input.currentValue}`);
	}

	sections.push("Write concise, concrete content that fits the field purpose.");

	return sections.join("\n\n");
}

function extractGeneratedText(responseText: string): string {
	const trimmed = responseText.trim();

	if (!trimmed) {
		return "";
	}

	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;

		if (typeof parsed.content === "string" && parsed.content.trim().length > 0) {
			return parsed.content.trim();
		}

		if (typeof parsed.text === "string" && parsed.text.trim().length > 0) {
			return parsed.text.trim();
		}

		if (typeof parsed.value === "string" && parsed.value.trim().length > 0) {
			return parsed.value.trim();
		}
	}
	catch {
		// plain text response
	}

	const fenced = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/);
	if (fenced && fenced[1]) {
		return fenced[1].trim();
	}

	return trimmed;
}

export async function generateFieldContent(
	input: GenerateFieldContentInput,
): Promise<string> {
	const prompt = buildFieldGenerationPrompt(input);
	let responseText = "";

	try {
		if (input.llmCall) {
			responseText = await input.llmCall(prompt);
		}
		else {
			const client = OpenAIClient.getInstance();
			const endpoint = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:8080";
			const apiKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_KEY) || "";

			const requestPayload: ChatCompletionRequest = {
				model: "any",
				messages: [
					{
						role: "system",
						content: "You generate concise creative text for roleplay template fields.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				stream: true,
			};

			const stream = client.streamChatCompletion(endpoint, apiKey, requestPayload);
			for await (const chunk of stream) {
				for (const choice of chunk.choices) {
					if (choice.delta?.content) {
						responseText += choice.delta.content;
					}
				}
			}
		}
	}
	catch {
		return input.currentValue?.trim() || "";
	}

	const generated = extractGeneratedText(responseText);
	if (generated) {
		return generated;
	}

	return input.currentValue?.trim() || "";
}

/**
 * Preprocesses feeling lucky fields on all assets for a new world instance.
 * LLM replaces the values inside the input before being merged to the initial prompt.
 */
export async function preprocessFeelingLucky(
	input: PreprocessFeelingLuckyInput,
): Promise<PreprocessFeelingLuckyResult> {
	const { llmCall } = input;
	const worldfile: Worldfile = structuredClone(input.worldfile);
	const universe: Universefile | undefined = input.universe
		? structuredClone(input.universe)
		: undefined;
	const characters: Characterfile[] | undefined = input.characters
		? structuredClone(input.characters)
		: undefined;
	const lorebooks: LoreBook[] | undefined = input.lorebooks
		? structuredClone(input.lorebooks)
		: undefined;

	// 1. Process Universe
	if (universe && universe.settings) {
		const luckyRules = new Set(universe.settings.feeling_lucky?.rules || []);
		if (universe.settings.rules) {
			for (let i = 0; i < universe.settings.rules.length; i++) {
				if (luckyRules.has(i)) {
					universe.settings.rules[i] = await generateFieldContent({
						templateType: "universe",
						fieldName: "rules",
						context: {
							universeName: universe.metadata.name,
							universeTitle: universe.metadata.title,
							universeDescription: universe.metadata.description,
						},
						currentValue: universe.settings.rules[i],
						llmCall,
					});
				}
			}
		}

		const luckyBackgrounds = new Set(universe.settings.feeling_lucky?.backgrounds || []);
		if (universe.settings.backgrounds) {
			for (let i = 0; i < universe.settings.backgrounds.length; i++) {
				if (luckyBackgrounds.has(i)) {
					universe.settings.backgrounds[i] = await generateFieldContent({
						templateType: "universe",
						fieldName: "backgrounds",
						context: {
							universeName: universe.metadata.name,
							universeTitle: universe.metadata.title,
							universeDescription: universe.metadata.description,
						},
						currentValue: universe.settings.backgrounds[i],
						llmCall,
					});
				}
			}
		}
	}

	// 2. Process Worldfile
	const luckyWorldBg = new Set(worldfile.content.feeling_lucky?.backgrounds || []);
	if (worldfile.content.backgrounds) {
		for (let i = 0; i < worldfile.content.backgrounds.length; i++) {
			if (luckyWorldBg.has(i)) {
				worldfile.content.backgrounds[i] = await generateFieldContent({
					templateType: "world",
					fieldName: "backgrounds",
					context: {
						worldName: worldfile.metadata.name,
						worldTitle: worldfile.metadata.title,
						worldDescription: worldfile.metadata.description,
					},
					currentValue: worldfile.content.backgrounds[i],
					llmCall,
				});
			}
		}
	}

	const luckyWorldRules = new Set(worldfile.content.feeling_lucky?.rules || []);
	if (worldfile.content.settings?.rules) {
		for (let i = 0; i < worldfile.content.settings.rules.length; i++) {
			if (luckyWorldRules.has(i)) {
				worldfile.content.settings.rules[i] = await generateFieldContent({
					templateType: "world",
					fieldName: "rules",
					context: {
						worldName: worldfile.metadata.name,
						worldTitle: worldfile.metadata.title,
						worldDescription: worldfile.metadata.description,
					},
					currentValue: worldfile.content.settings.rules[i],
					llmCall,
				});
			}
		}
	}

	const luckyWorldGuidelines = new Set(worldfile.content.feeling_lucky?.guidelines || []);
	if (worldfile.content.settings?.guidelines) {
		for (let i = 0; i < worldfile.content.settings.guidelines.length; i++) {
			if (luckyWorldGuidelines.has(i)) {
				worldfile.content.settings.guidelines[i] = await generateFieldContent({
					templateType: "world",
					fieldName: "guidelines",
					context: {
						worldName: worldfile.metadata.name,
						worldTitle: worldfile.metadata.title,
						worldDescription: worldfile.metadata.description,
					},
					currentValue: worldfile.content.settings.guidelines[i],
					llmCall,
				});
			}
		}
	}

	const luckyWorldPlotIntro = new Set(worldfile.content.feeling_lucky?.plot_intro || []);
	if (worldfile.content.plot?.intro?.list) {
		for (let i = 0; i < worldfile.content.plot.intro.list.length; i++) {
			const item = worldfile.content.plot.intro.list[i];
			if (item.feelingLucky || luckyWorldPlotIntro.has(i)) {
				item.value = await generateFieldContent({
					templateType: "world",
					fieldName: "plot.intro",
					context: {
						worldName: worldfile.metadata.name,
						worldTitle: worldfile.metadata.title,
						worldDescription: worldfile.metadata.description,
					},
					currentValue: item.value,
					llmCall,
				});
			}
		}
	}

	// 3. Process Characters
	if (characters) {
		for (const character of characters) {
			const charContext = {
				characterName: character.metadata.name,
				characterTitle: character.metadata.title,
				characterDescription: character.metadata.description,
			};

			if (character.summary_lucky) {
				character.summary = await generateFieldContent({
					templateType: "character",
					fieldName: "summary",
					context: charContext,
					currentValue: character.summary,
					llmCall,
				});
			}

			const traitLists = [
				character.physical_characteristics,
				character.linguistic_patterns,
				character.psychology_and_worldviews,
				character.lifestyle_and_preferences,
				character.desires,
				character.skills,
			];

			for (const traitList of traitLists) {
				if (!traitList) {
					continue;
				}

				for (let i = 0; i < traitList.length; i++) {
					const trait = traitList[i];
					if (trait.feelingLucky) {
						trait.description = await generateFieldContent({
							templateType: "character",
							fieldName: `trait[${i}].description`,
							context: {
								...charContext,
								traitName: trait.name,
							},
							currentValue: trait.description,
							llmCall,
						});
					}
				}
			}

			if (character.backgrounds) {
				for (let i = 0; i < character.backgrounds.length; i++) {
					const bg = character.backgrounds[i];
					if (bg.feelingLucky) {
						bg.content = await generateFieldContent({
							templateType: "character",
							fieldName: `backgrounds[${i}].content`,
							context: {
								...charContext,
								backgroundName: bg.name,
							},
							currentValue: bg.content,
							llmCall,
						});
					}
				}
			}

			if (character.example_dialogs) {
				for (let i = 0; i < character.example_dialogs.length; i++) {
					const dialogItem = character.example_dialogs[i];
					if (dialogItem.feelingLucky) {
						dialogItem.dialog = await generateFieldContent({
							templateType: "character",
							fieldName: `example_dialogs[${i}].dialog`,
							context: {
								...charContext,
								dialogName: dialogItem.name,
							},
							currentValue: dialogItem.dialog,
							llmCall,
						});
					}
				}
			}
		}
	}

	// 4. Process Lorebooks
	if (lorebooks) {
		for (const lorebook of lorebooks) {
			for (const entry of lorebook.entries) {
				if (entry.feelingLucky?.title) {
					entry.title = await generateFieldContent({
						templateType: "lore",
						fieldName: "entry.title",
						context: {
							bookName: lorebook.name,
							activationMode: entry.activationMode,
						},
						currentValue: entry.title,
						llmCall,
					});
				}

				if (entry.feelingLucky?.content) {
					entry.content = await generateFieldContent({
						templateType: "lore",
						fieldName: "entry.content",
						context: {
							bookName: lorebook.name,
							title: entry.title,
							activationMode: entry.activationMode,
						},
						currentValue: entry.content,
						llmCall,
					});
				}

				if (entry.feelingLucky?.keywords) {
					const generatedKeywords = await generateFieldContent({
						templateType: "lore",
						fieldName: "entry.keywords",
						context: {
							bookName: lorebook.name,
							title: entry.title,
							content: entry.content,
						},
						currentValue: entry.keywords.join(", "),
						llmCall,
					});

					entry.keywords = generatedKeywords
						.split(",")
						.map(k => k.trim())
						.filter(Boolean);
				}
			}
		}
	}

	return {
		worldfile,
		universe,
		characters,
		lorebooks,
	};
}
