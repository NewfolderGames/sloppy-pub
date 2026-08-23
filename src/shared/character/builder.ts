import type { Characterfile, CharacterInstance, NamedTrait } from "./types.ts";

function formatTraitList(title: string, traits: NamedTrait[]): string[] {
	const validTraits = traits.filter(t => t.description && t.description.trim() !== "");

	if (validTraits.length === 0) {
		return [];
	}

	const lines: string[] = [`### ${title}`];

	for (const trait of validTraits) {
		lines.push(`- ${trait.name}: ${trait.description}`);
	}

	return lines;
}

export function formatCharacterPrompt(
	characters: Characterfile | Characterfile[] | string | null | undefined,
): string {
	if (!characters) {
		return "";
	}

	if (typeof characters === "string") {
		return characters.trim();
	}

	const list = Array.isArray(characters) ? characters : [characters];

	if (list.length === 0) {
		return "";
	}

	const sections: string[] = ["# Characters"];

	for (const character of list) {
		const charSections: string[] = [];
		const title = character.metadata.title || character.metadata.name;

		charSections.push(`## ${title}`);

		if (character.summary && character.summary.trim() !== "") {
			charSections.push(character.summary.trim());
		}

		const physical = formatTraitList("Physical Characteristics", character.physical_characteristics);
		if (physical.length > 0) {
			charSections.push(physical.join("\n"));
		}

		const linguistic = formatTraitList("Linguistic Patterns", character.linguistic_patterns);
		if (linguistic.length > 0) {
			charSections.push(linguistic.join("\n"));
		}

		const psychology = formatTraitList(
			"Psychology and Worldviews",
			character.psychology_and_worldviews,
		);
		if (psychology.length > 0) {
			charSections.push(psychology.join("\n"));
		}

		const lifestyle = formatTraitList(
			"Lifestyle and Preferences",
			character.lifestyle_and_preferences,
		);
		if (lifestyle.length > 0) {
			charSections.push(lifestyle.join("\n"));
		}

		const desires = formatTraitList("Desires", character.desires);
		if (desires.length > 0) {
			charSections.push(desires.join("\n"));
		}

		if (character.skills && character.skills.length > 0) {
			const skills = formatTraitList("Skills", character.skills);
			if (skills.length > 0) {
				charSections.push(skills.join("\n"));
			}
		}

		if (character.backgrounds && character.backgrounds.length > 0) {
			const bgLines: string[] = ["### Backgrounds"];
			for (const bg of character.backgrounds) {
				const title = typeof bg === "string" ? "" : bg.name;
				const text = typeof bg === "string" ? bg : bg.content;
				if (title && text) {
					bgLines.push(`- **${title}**: ${text}`);
				}
				else if (text) {
					bgLines.push(`- ${text}`);
				}
			}
			if (bgLines.length > 1) {
				charSections.push(bgLines.join("\n"));
			}
		}

		if (character.example_dialogs && character.example_dialogs.length > 0) {
			const dialogLines: string[] = ["### Example Dialogs"];

			for (const dialog of character.example_dialogs) {
				if (dialog.dialog && dialog.dialog.trim() !== "") {
					dialogLines.push(`- ${dialog.name}: "${dialog.dialog}"`);
				}
			}

			if (dialogLines.length > 1) {
				charSections.push(dialogLines.join("\n"));
			}
		}

		sections.push(charSections.join("\n\n"));
	}

	return sections.join("\n\n");
}

export function formatCharacterInstancesPrompt(
	instances: CharacterInstance | CharacterInstance[] | string | null | undefined,
): string {
	if (!instances) {
		return "";
	}

	if (typeof instances === "string") {
		return instances.trim();
	}

	const list = Array.isArray(instances) ? instances : [instances];

	if (list.length === 0) {
		return "";
	}

	const sections: string[] = ["# Character Instances"];

	for (const instance of list) {
		const charSections: string[] = [`## ${instance.name}`];

		if (instance.thoughts && instance.thoughts.length > 0) {
			const thoughtLines: string[] = ["### Recent Thoughts"];

			for (const thought of instance.thoughts) {
				thoughtLines.push(`- ${thought.title}: ${thought.internal_monologue}`);
			}

			charSections.push(thoughtLines.join("\n"));
		}

		if (instance.emotions && instance.emotions.length > 0) {
			const emotionLines: string[] = ["### Recent Emotions"];

			for (const emotion of instance.emotions) {
				emotionLines.push(`- ${emotion.name}: ${emotion.internal_monologue}`);
			}

			charSections.push(emotionLines.join("\n"));
		}

		if (instance.goals && instance.goals.length > 0) {
			const goalLines: string[] = ["### Goals"];

			for (const goal of instance.goals) {
				goalLines.push(`- ${goal.name}: ${goal.internal_monologue}`);
			}

			charSections.push(goalLines.join("\n"));
		}

		if (instance.states) {
			const stateEntries = Object.entries(instance.states);

			if (stateEntries.length > 0) {
				const stateLines: string[] = ["### States"];

				for (const [key, value] of stateEntries) {
					const formatted = Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
					stateLines.push(`- ${key}: ${formatted}`);
				}

				charSections.push(stateLines.join("\n"));
			}
		}

		sections.push(charSections.join("\n\n"));
	}

	return sections.join("\n\n");
}
