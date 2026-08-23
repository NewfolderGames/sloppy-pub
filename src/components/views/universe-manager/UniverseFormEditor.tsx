import type { FormEvent } from "react";
import { MetadataFormSection } from "../common/MetadataFormSection.tsx";
import type { StateRow } from "../common/state_helpers.ts";
import { StateVariableTable } from "../common/StateVariableTable.tsx";
import { StringListEditor } from "../common/StringListEditor.tsx";
import styles from "../UniverseManagerView.module.css";

export interface UniverseFormEditorProps {
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
	rulesList: string[];
	rulesLucky?: boolean[];
	onAddRule: () => void;
	onUpdateRule: (idx: number, value: string) => void;
	onRemoveRule: (idx: number) => void;
	onToggleRuleLucky?: (idx: number, checked: boolean) => void;
	backgroundsList: string[];
	backgroundsLucky?: boolean[];
	onAddBackground: () => void;
	onUpdateBackground: (idx: number, value: string) => void;
	onRemoveBackground: (idx: number) => void;
	onToggleBackgroundLucky?: (idx: number, checked: boolean) => void;
	stateRows: StateRow[];
	onAddStateRow: () => void;
	onUpdateStateRow: (idx: number, patch: Partial<StateRow>) => void;
	onRemoveStateRow: (idx: number) => void;
	onSubmit: (e?: FormEvent) => void;
}

export function UniverseFormEditor(props: Readonly<UniverseFormEditorProps>) {

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
		rulesList,
		rulesLucky,
		onAddRule,
		onUpdateRule,
		onRemoveRule,
		onToggleRuleLucky,
		backgroundsList,
		backgroundsLucky,
		onAddBackground,
		onUpdateBackground,
		onRemoveBackground,
		onToggleBackgroundLucky,
		stateRows,
		onAddStateRow,
		onUpdateStateRow,
		onRemoveStateRow,
		onSubmit,
	} = props;

	return (
		<form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
			<MetadataFormSection
				sectionTitle="1. Universe Metadata"
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
				namePlaceholder="unique_universe_name"
				titlePlaceholder="Universe Title"
				descriptionPlaceholder="Universal reality and cosmic background description..."
				authorsPlaceholder="Architect One, Architect Two"
				tagsPlaceholder="multiverse, reality, rules"
			/>

			<div className={styles.section}>
				<StringListEditor
					title="2. Universal Invariant Rules"
					items={rulesList}
					luckyItems={rulesLucky}
					onAdd={onAddRule}
					onUpdate={onUpdateRule}
					onRemove={onRemoveRule}
					onToggleLucky={onToggleRuleLucky}
					addButtonLabel="+ Add Rule"
					placeholder="Universal invariant rule statement..."
					rows={2}
					feelingLucky={true}
				/>
			</div>

			<div className={styles.section}>
				<StringListEditor
					title="3. Universal Background Story"
					items={backgroundsList}
					luckyItems={backgroundsLucky}
					onAdd={onAddBackground}
					onUpdate={onUpdateBackground}
					onRemove={onRemoveBackground}
					onToggleLucky={onToggleBackgroundLucky}
					addButtonLabel="+ Add Background"
					placeholder="Universal background story segment..."
					rows={3}
					feelingLucky={true}
				/>
			</div>

			<div className={styles.section}>
				<StateVariableTable
					title="4. Shared Universe States"
					rows={stateRows}
					onAddRow={onAddStateRow}
					onUpdateRow={onUpdateStateRow}
					onRemoveRow={onRemoveStateRow}
					addButtonLabel="+ Add State Key"
					keyPlaceholder="universe.key_name"
				/>
			</div>
		</form>
	);

}
