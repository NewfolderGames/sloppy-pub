import type { FormEvent } from "react";
import type { ArgumentDefinition, VariableDefinition } from "@/shared/world/types.ts";
import { MetadataFormSection } from "../common/MetadataFormSection.tsx";
import type { StateRow } from "../common/state_helpers.ts";
import { StateVariableTable } from "../common/StateVariableTable.tsx";
import { StringListEditor } from "../common/StringListEditor.tsx";
import { ArgumentsSection } from "./ArgumentsSection.tsx";
import { VariablesSection } from "./VariablesSection.tsx";
import styles from "../WorldManagerView.module.css";

export interface WorldfileEditorProps {
	metaName: string;
	onMetaNameChange: (value: string) => void;
	metaVersion: string;
	onMetaVersionChange: (value: string) => void;
	metaTitle: string;
	onMetaTitleChange: (value: string) => void;
	metaDescription: string;
	onMetaDescriptionChange: (value: string) => void;
	metaAuthors: string;
	onMetaAuthorsChange: (value: string) => void;
	metaTags: string;
	onMetaTagsChange: (value: string) => void;

	argsList: ArgumentDefinition[];
	onAddArg: () => void;
	onUpdateArg: (idx: number, patch: Partial<ArgumentDefinition>) => void;
	onRemoveArg: (idx: number) => void;

	varsList: VariableDefinition[];
	onAddVar: () => void;
	onUpdateVar: (idx: number, patch: Partial<VariableDefinition>) => void;
	onRemoveVar: (idx: number) => void;

	backgroundsList: string[];
	backgroundsLucky?: boolean[];
	onAddBackground: () => void;
	onUpdateBackground: (idx: number, value: string) => void;
	onRemoveBackground: (idx: number) => void;
	onToggleBackgroundLucky?: (idx: number, checked: boolean) => void;

	rulesList: string[];
	rulesLucky?: boolean[];
	onAddRule: () => void;
	onUpdateRule: (idx: number, value: string) => void;
	onRemoveRule: (idx: number) => void;
	onToggleRuleLucky?: (idx: number, checked: boolean) => void;

	guidelinesList: string[];
	guidelinesLucky?: boolean[];
	onAddGuideline: () => void;
	onUpdateGuideline: (idx: number, value: string) => void;
	onRemoveGuideline: (idx: number) => void;
	onToggleGuidelineLucky?: (idx: number, checked: boolean) => void;

	plotIntroMode: "random" | "user_select" | "dynamic";
	onPlotIntroModeChange: (value: "random" | "user_select" | "dynamic") => void;
	plotIntroList: string[];
	plotIntroLucky?: boolean[];
	onAddIntroPlot: () => void;
	onUpdateIntroPlot: (idx: number, value: string) => void;
	onRemoveIntroPlot: (idx: number) => void;
	onTogglePlotIntroLucky?: (idx: number, checked: boolean) => void;

	stateRows: StateRow[];
	onAddStateRow: () => void;
	onUpdateStateRow: (idx: number, patch: Partial<StateRow>) => void;
	onRemoveStateRow: (idx: number) => void;

	onSubmit: (e?: FormEvent) => void;
}

export function WorldfileEditor(props: Readonly<WorldfileEditorProps>) {

	const {
		metaName,
		onMetaNameChange,
		metaVersion,
		onMetaVersionChange,
		metaTitle,
		onMetaTitleChange,
		metaDescription,
		onMetaDescriptionChange,
		metaAuthors,
		onMetaAuthorsChange,
		metaTags,
		onMetaTagsChange,
		argsList,
		onAddArg,
		onUpdateArg,
		onRemoveArg,
		varsList,
		onAddVar,
		onUpdateVar,
		onRemoveVar,
		backgroundsList,
		backgroundsLucky,
		onAddBackground,
		onUpdateBackground,
		onRemoveBackground,
		onToggleBackgroundLucky,
		rulesList,
		rulesLucky,
		onAddRule,
		onUpdateRule,
		onRemoveRule,
		onToggleRuleLucky,
		guidelinesList,
		guidelinesLucky,
		onAddGuideline,
		onUpdateGuideline,
		onRemoveGuideline,
		onToggleGuidelineLucky,
		plotIntroMode,
		onPlotIntroModeChange,
		plotIntroList,
		plotIntroLucky,
		onAddIntroPlot,
		onUpdateIntroPlot,
		onRemoveIntroPlot,
		onTogglePlotIntroLucky,
		stateRows,
		onAddStateRow,
		onUpdateStateRow,
		onRemoveStateRow,
		onSubmit,
	} = props;

	return (
		<form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
			<MetadataFormSection
				sectionTitle="1. Metadata"
				name={metaName}
				onNameChange={onMetaNameChange}
				version={metaVersion}
				onVersionChange={onMetaVersionChange}
				title={metaTitle}
				onTitleChange={onMetaTitleChange}
				description={metaDescription}
				onDescriptionChange={onMetaDescriptionChange}
				authors={metaAuthors}
				onAuthorsChange={onMetaAuthorsChange}
				tags={metaTags}
				onTagsChange={onMetaTagsChange}
				namePlaceholder="unique_world_name"
				titlePlaceholder="World Title"
				descriptionPlaceholder="Brief overview of this world..."
				authorsPlaceholder="Author One, Author Two"
				tagsPlaceholder="cyberpunk, sci-fi, drama"
			/>

			<ArgumentsSection
				argsList={argsList}
				onAddArg={onAddArg}
				onUpdateArg={onUpdateArg}
				onRemoveArg={onRemoveArg}
			/>

			<VariablesSection
				varsList={varsList}
				onAddVar={onAddVar}
				onUpdateVar={onUpdateVar}
				onRemoveVar={onRemoveVar}
			/>

			<div className={styles.section}>
				<h4 className={styles.sectionTitle}>4. Content & Plot Template</h4>

				<StringListEditor
					title="Background Narratives (Supports {{ARG_NAME}} interpolation)"
					items={backgroundsList}
					luckyItems={backgroundsLucky}
					onAdd={onAddBackground}
					onUpdate={onUpdateBackground}
					onRemove={onRemoveBackground}
					onToggleLucky={onToggleBackgroundLucky}
					addButtonLabel="+ Add Background"
					placeholder="Background narrative segment..."
					rows={3}
					feelingLucky={true}
				/>

				<StringListEditor
					title="World Rules"
					items={rulesList}
					luckyItems={rulesLucky}
					onAdd={onAddRule}
					onUpdate={onUpdateRule}
					onRemove={onRemoveRule}
					onToggleLucky={onToggleRuleLucky}
					addButtonLabel="+ Add Rule"
					placeholder="Rule statement..."
					rows={2}
					feelingLucky={true}
				/>

				<StringListEditor
					title="AI Guidelines"
					items={guidelinesList}
					luckyItems={guidelinesLucky}
					onAdd={onAddGuideline}
					onUpdate={onUpdateGuideline}
					onRemove={onRemoveGuideline}
					onToggleLucky={onToggleGuidelineLucky}
					addButtonLabel="+ Add Guideline"
					placeholder="Guideline instruction..."
					rows={2}
					feelingLucky={true}
				/>

				<div className={styles.formGroup}>
					<label className={styles.label}>Plot Intro Selection Mode</label>

					<select
						className={styles.input}
						value={plotIntroMode}
						onChange={e => onPlotIntroModeChange(e.target.value as "random" | "user_select" | "dynamic")}
					>
						<option value="random">Randomly Pick One</option>
						<option value="user_select">User Selects at Creation</option>
						<option value="dynamic">Dynamic Agent Decides</option>
					</select>
				</div>

				<StringListEditor
					title="Introductory Plot Scenarios"
					items={plotIntroList}
					luckyItems={plotIntroLucky}
					onAdd={onAddIntroPlot}
					onUpdate={onUpdateIntroPlot}
					onRemove={onRemoveIntroPlot}
					onToggleLucky={onTogglePlotIntroLucky}
					addButtonLabel="+ Add Scenario"
					placeholder="Introductory starting situation..."
					rows={3}
					feelingLucky={true}
				/>
			</div>

			<div className={styles.section}>
				<StateVariableTable
					title="5. Initial World States"
					rows={stateRows}
					onAddRow={onAddStateRow}
					onUpdateRow={onUpdateStateRow}
					onRemoveRow={onRemoveStateRow}
					addButtonLabel="+ Add State Variable"
					keyPlaceholder="world.variable_name"
				/>
			</div>
		</form>
	);

}
