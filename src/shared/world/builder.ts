// Token Interpolation

export function interpolateText(
	template: string,
	argsMap: Map<string, string>,
): string {

	const tokenRegex = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

	return template.replace(tokenRegex, (match, argName) => {
		if (!argsMap.has(argName)) {
			throw new Error(`Undefined argument token: "${match}".`);
		}

		return argsMap.get(argName)!;
	});

}

// System Prompt Assembly

export function assembleSystemPrompt(
	title: string,
	backgrounds: string[],
	rules?: string[],
	guidelines?: string[],
	contentGuidelines?: string[],
): string {

	const sections: string[] = [];

	sections.push(`You are the narrator for the ${title} setting.`);
	sections.push(`---`);

	// Setting Description

	sections.push(`<!-- Description of the setting. -->`);
	if (Array.isArray(backgrounds)) sections.push(...backgrounds);
	sections.push(`---`);

	// Rules

	sections.push(`<!-- Rules of the world and the universe -->`);
	if (rules && rules.length > 0) sections.push(...rules);
	sections.push(`---`);

	// Guidelines

	const mergedGuidelines: string[] = [];

	if (contentGuidelines && contentGuidelines.length > 0) mergedGuidelines.push(...contentGuidelines);
	if (guidelines && guidelines.length > 0) mergedGuidelines.push(...guidelines);

	sections.push(`<!-- Guidelines for the narrator. -->`);
	if (mergedGuidelines.length > 0) sections.push(...mergedGuidelines);

	return sections.join("\n\n");

}
