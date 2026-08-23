import type { ArgumentDefinition, VariableDefinition, Worldfile } from "../../shared/world/types.ts";
import { type StateRow, stateRowsToMap } from "./common/state_helpers.ts";

export interface WorldfileFormState {
	metaName: string;
	metaVersion: string;
	metaTitle: string;
	metaDescription: string;
	metaAuthors: string;
	metaTags: string;
	backgroundsList: string[];
	backgroundsLucky?: boolean[];
	rulesList: string[];
	rulesLucky?: boolean[];
	guidelinesList: string[];
	guidelinesLucky?: boolean[];
	plotIntroMode: "random" | "user_select" | "dynamic";
	plotIntroList: string[];
	plotIntroLucky?: boolean[];
	argsList: ArgumentDefinition[];
	varsList: VariableDefinition[];
	stateRows: StateRow[];
}

export function mergeWorldfileFormState(
	baseWorldfile: Worldfile,
	formState: WorldfileFormState,
): Worldfile {
	// Plot Processing

	const basePlot = baseWorldfile.content.plot ? { ...baseWorldfile.content.plot } : {};
	const baseIntro = baseWorldfile.content.plot?.intro;

	if (formState.plotIntroList.length > 0) {
		basePlot.intro = {
			...baseIntro,
			mode: formState.plotIntroMode,
			list: formState.plotIntroList.map((value, index) => {
				const isLucky = formState.plotIntroLucky?.[index] ?? baseIntro?.list?.[index]?.feelingLucky;
				return {
					...(baseIntro?.list?.[index] || {}),
					value,
					...(isLucky !== undefined ? { feelingLucky: isLucky } : {}),
				};
			}),
		};
	}
	else {
		delete basePlot.intro;
	}

	// Content Preparation

	const restContent = { ...baseWorldfile.content };
	delete restContent.description;

	const luckyBackgrounds = (formState.backgroundsLucky || [])
		.map((lucky, idx) => (lucky ? idx : -1))
		.filter(idx => idx >= 0);
	const luckyRules = (formState.rulesLucky || [])
		.map((lucky, idx) => (lucky ? idx : -1))
		.filter(idx => idx >= 0);
	const luckyGuidelines = (formState.guidelinesLucky || [])
		.map((lucky, idx) => (lucky ? idx : -1))
		.filter(idx => idx >= 0);
	const luckyPlotIntro = (formState.plotIntroLucky || [])
		.map((lucky, idx) => (lucky ? idx : -1))
		.filter(idx => idx >= 0);

	const feelingLuckyDoc: Record<string, number[]> = {};
	if (luckyBackgrounds.length > 0) {
		feelingLuckyDoc.backgrounds = luckyBackgrounds;
	}
	if (luckyRules.length > 0) {
		feelingLuckyDoc.rules = luckyRules;
	}
	if (luckyGuidelines.length > 0) {
		feelingLuckyDoc.guidelines = luckyGuidelines;
	}
	if (luckyPlotIntro.length > 0) {
		feelingLuckyDoc.plot_intro = luckyPlotIntro;
	}

	return {
		...baseWorldfile,
		metadata: {
			...baseWorldfile.metadata,
			name: formState.metaName.trim(),
			version: formState.metaVersion.trim(),
			title: formState.metaTitle.trim(),
			description: formState.metaDescription.trim(),
			authors: formState.metaAuthors.split(",").map(value => value.trim()).filter(Boolean),
			tags: formState.metaTags.split(",").map(value => value.trim()).filter(Boolean),
		},
		args: formState.argsList
			.filter(argument => argument.name.trim().length > 0)
			.map(argument => ({ ...argument })),
		vars: formState.varsList
			.filter(variable => variable.name.trim().length > 0)
			.map(variable => ({ ...variable })),
		content: {
			...restContent,
			backgrounds: [...formState.backgroundsList],
			settings: {
				...baseWorldfile.content.settings,
				rules: formState.rulesList.filter(rule => rule.trim().length > 0),
				guidelines: formState.guidelinesList.filter(guideline => guideline.trim().length > 0),
			},
			plot: Object.keys(basePlot).length > 0 ? basePlot : undefined,
			feeling_lucky: Object.keys(feelingLuckyDoc).length > 0 ? feelingLuckyDoc : undefined,
		},
		states: stateRowsToMap(formState.stateRows),
	};
}
