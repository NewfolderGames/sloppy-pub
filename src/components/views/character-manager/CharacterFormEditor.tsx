import type { FormEvent } from "react";
import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { CharacterBackground, ExampleDialog, NamedTrait } from "@/shared/character/types.ts";
import { MetadataFormSection } from "../common/MetadataFormSection.tsx";
import type { StateRow } from "../common/state_helpers.ts";
import { StateVariableTable } from "../common/StateVariableTable.tsx";
import { BackgroundsSection } from "./BackgroundsSection.tsx";
import { ExampleDialogsSection } from "./ExampleDialogsSection.tsx";
import { TraitListSection } from "./TraitListSection.tsx";
import styles from "../CharacterManagerView.module.css";

export interface CharacterFormEditorProps {
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

	summary: string;
	onSummaryChange: (value: string) => void;
	summaryLucky?: boolean;
	onSummaryLuckyChange?: (checked: boolean) => void;

	physicalTraits: NamedTrait[];
	onAddPhysicalTrait: () => void;
	onUpdatePhysicalTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemovePhysicalTrait: (index: number) => void;

	linguisticTraits: NamedTrait[];
	onAddLinguisticTrait: () => void;
	onUpdateLinguisticTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemoveLinguisticTrait: (index: number) => void;

	psychologyTraits: NamedTrait[];
	onAddPsychologyTrait: () => void;
	onUpdatePsychologyTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemovePsychologyTrait: (index: number) => void;

	lifestyleTraits: NamedTrait[];
	onAddLifestyleTrait: () => void;
	onUpdateLifestyleTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemoveLifestyleTrait: (index: number) => void;

	desiresTraits: NamedTrait[];
	onAddDesireTrait: () => void;
	onUpdateDesireTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemoveDesireTrait: (index: number) => void;

	skillsTraits: NamedTrait[];
	onAddSkillTrait: () => void;
	onUpdateSkillTrait: (index: number, patch: Partial<NamedTrait>) => void;
	onRemoveSkillTrait: (index: number) => void;

	backgrounds: CharacterBackground[];
	onAddBackground: () => void;
	onUpdateBackground: (index: number, patch: Partial<CharacterBackground>) => void;
	onRemoveBackground: (index: number) => void;

	exampleDialogs: ExampleDialog[];
	onAddExampleDialog: () => void;
	onUpdateExampleDialog: (index: number, patch: Partial<ExampleDialog>) => void;
	onRemoveExampleDialog: (index: number) => void;

	stateRows: StateRow[];
	onAddStateRow: () => void;
	onUpdateStateRow: (idx: number, patch: Partial<StateRow>) => void;
	onRemoveStateRow: (idx: number) => void;

	onSubmit: (e?: FormEvent) => void;
}

export function CharacterFormEditor(props: Readonly<CharacterFormEditorProps>) {

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
		summary,
		onSummaryChange,
		summaryLucky,
		onSummaryLuckyChange,
		physicalTraits,
		onAddPhysicalTrait,
		onUpdatePhysicalTrait,
		onRemovePhysicalTrait,
		linguisticTraits,
		onAddLinguisticTrait,
		onUpdateLinguisticTrait,
		onRemoveLinguisticTrait,
		psychologyTraits,
		onAddPsychologyTrait,
		onUpdatePsychologyTrait,
		onRemovePsychologyTrait,
		lifestyleTraits,
		onAddLifestyleTrait,
		onUpdateLifestyleTrait,
		onRemoveLifestyleTrait,
		desiresTraits,
		onAddDesireTrait,
		onUpdateDesireTrait,
		onRemoveDesireTrait,
		skillsTraits,
		onAddSkillTrait,
		onUpdateSkillTrait,
		onRemoveSkillTrait,
		backgrounds,
		onAddBackground,
		onUpdateBackground,
		onRemoveBackground,
		exampleDialogs,
		onAddExampleDialog,
		onUpdateExampleDialog,
		onRemoveExampleDialog,
		stateRows,
		onAddStateRow,
		onUpdateStateRow,
		onRemoveStateRow,
		onSubmit,
	} = props;

	const characterContext = {
		name: metaName,
		title: metaTitle,
		description: metaDescription,
		summary,
	};

	return (
		<form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
			<MetadataFormSection
				sectionTitle="1. Character Metadata"
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
				namePlaceholder="character_unique_id"
				titlePlaceholder="Character Full Name"
				descriptionPlaceholder="Short character premise and role description..."
				authorsPlaceholder="Author Name"
				tagsPlaceholder="sci-fi, protagonist, investigator"
			/>

			<div className={styles.section}>
				<h4 className={styles.sectionTitle}>2. Introduction & Summary</h4>

				<textarea
					className={styles.textarea}
					rows={4}
					value={summary}
					onChange={e => onSummaryChange(e.target.value)}
					placeholder="Comprehensive summary of the character's background, identity, and context..."
				/>

				<FeelingLuckyControl
					checked={Boolean(summaryLucky)}
					onChange={onSummaryLuckyChange}
				/>
			</div>

			<TraitListSection
				title="3. Physical Characteristics"
				traits={physicalTraits}
				onAdd={onAddPhysicalTrait}
				onUpdate={onUpdatePhysicalTrait}
				onRemove={onRemovePhysicalTrait}
				addButtonLabel="+ Add Characteristic"
				namePlaceholder="Trait Name (e.g. Height, Hair, Eyes)"
				descPlaceholder="Physical description..."
				feelingLuckyField="physical_characteristics"
				feelingLuckyContext={characterContext}
			/>

			<TraitListSection
				title="4. Linguistic Patterns"
				traits={linguisticTraits}
				onAdd={onAddLinguisticTrait}
				onUpdate={onUpdateLinguisticTrait}
				onRemove={onRemoveLinguisticTrait}
				addButtonLabel="+ Add Pattern"
				namePlaceholder="Style (e.g. Tone, Vocabulary)"
				descPlaceholder="Speech habits and verbal quirks..."
				feelingLuckyField="linguistic_patterns"
				feelingLuckyContext={characterContext}
			/>

			<TraitListSection
				title="5. Psychology & Worldviews"
				traits={psychologyTraits}
				onAdd={onAddPsychologyTrait}
				onUpdate={onUpdatePsychologyTrait}
				onRemove={onRemovePsychologyTrait}
				addButtonLabel="+ Add Trait"
				namePlaceholder="Belief / Attitude (e.g. Optimism, Morality)"
				descPlaceholder="Psychological posture and philosophy..."
				feelingLuckyField="psychology_and_worldviews"
				feelingLuckyContext={characterContext}
			/>

			<TraitListSection
				title="6. Lifestyle & Preferences"
				traits={lifestyleTraits}
				onAdd={onAddLifestyleTrait}
				onUpdate={onUpdateLifestyleTrait}
				onRemove={onRemoveLifestyleTrait}
				addButtonLabel="+ Add Preference"
				namePlaceholder="Category (e.g. Hobbies, Food, Habits)"
				descPlaceholder="Likes, daily routines, quirks..."
				feelingLuckyField="lifestyle_and_preferences"
				feelingLuckyContext={characterContext}
			/>

			<TraitListSection
				title="7. Desires & Motivations"
				traits={desiresTraits}
				onAdd={onAddDesireTrait}
				onUpdate={onUpdateDesireTrait}
				onRemove={onRemoveDesireTrait}
				addButtonLabel="+ Add Motivation"
				namePlaceholder="Drive (e.g. Goal, Fear, Ambition)"
				descPlaceholder="What moves the character forward..."
				feelingLuckyField="desires"
				feelingLuckyContext={characterContext}
			/>

			<TraitListSection
				title="8. Skills & Expertise"
				traits={skillsTraits}
				onAdd={onAddSkillTrait}
				onUpdate={onUpdateSkillTrait}
				onRemove={onRemoveSkillTrait}
				addButtonLabel="+ Add Skill"
				namePlaceholder="Proficiency (e.g. Hacking, Martial Arts)"
				descPlaceholder="Mastery level and application..."
				feelingLuckyField="skills"
				feelingLuckyContext={characterContext}
			/>

			<BackgroundsSection
				backgrounds={backgrounds}
				onAdd={onAddBackground}
				onUpdate={onUpdateBackground}
				onRemove={onRemoveBackground}
				characterContext={characterContext}
			/>

			<ExampleDialogsSection
				exampleDialogs={exampleDialogs}
				onAdd={onAddExampleDialog}
				onUpdate={onUpdateExampleDialog}
				onRemove={onRemoveExampleDialog}
				characterContext={characterContext}
			/>

			<div className={styles.section}>
				<StateVariableTable
					title="11. Initial Character States"
					rows={stateRows}
					onAddRow={onAddStateRow}
					onUpdateRow={onUpdateStateRow}
					onRemoveRow={onRemoveStateRow}
					addButtonLabel="+ Add Initial State"
					keyPlaceholder="state_variable_name"
				/>
			</div>
		</form>
	);

}
