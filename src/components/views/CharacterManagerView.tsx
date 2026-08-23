import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/common/Alert.tsx";
import { TabGroup, type TabItem } from "@/components/common/TabGroup.tsx";
import { deleteCharacterfile, exportCharacterfileAsFile, getAllCharacterfiles, importCharacterfileFromToml, SAMPLE_CHARACTERFILE, saveCharacterfile } from "@/shared/character/registry.ts";
import { parseCharacterfile, serializeCharacterfile } from "@/shared/character/toml.ts";
import type { CharacterBackground, Characterfile, ExampleDialog, NamedTrait, StoredCharacterfile } from "@/shared/character/types.ts";
import { CharacterFormEditor } from "./character-manager/CharacterFormEditor.tsx";
import { CharacterHeader } from "./character-manager/CharacterHeader.tsx";
import { CharacterList } from "./character-manager/CharacterList.tsx";
import { CharacterRawEditor } from "./character-manager/CharacterRawEditor.tsx";
import { stateMapToRows, type StateRow, stateRowsToMap } from "./common/state_helpers.ts";
import styles from "./CharacterManagerView.module.css";

const CHARACTER_TABS: Array<TabItem<"form" | "raw">> = [
	{ id: "form", label: "Visual Editor" },
	{ id: "raw", label: "Raw TOML" },
];

export interface CharacterManagerViewProps {
	onEditorContextChange?: (context: {
		activeId: string | null;
		rawToml: string;
		summary?: Record<string, unknown>;
	}) => void;
	applyDiffCallbackRef?: React.MutableRefObject<((proposedToml: string) => void) | null>;
}

export function CharacterManagerView(props: CharacterManagerViewProps = {}) {

	const { onEditorContextChange, applyDiffCallbackRef } = props;

	// Component State

	const [characters, setCharacters] = useState<StoredCharacterfile[]>(() =>
		getAllCharacterfiles(),
	);

	const initialRecord = characters[0];
	const initialC = initialRecord ? initialRecord.characterfile : SAMPLE_CHARACTERFILE;

	const [selectedId, setSelectedId] = useState<string | null>(
		initialRecord ? initialRecord.id : null,
	);
	const [editorMode, setEditorMode] = useState<"form" | "raw">("form");

	// Alerts

	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Form State

	const [metaName, setMetaName] = useState(initialC.metadata.name || "");
	const [metaVersion, setMetaVersion] = useState(initialC.metadata.version || "1.0.0");
	const [metaTitle, setMetaTitle] = useState(initialC.metadata.title || "");
	const [metaDescription, setMetaDescription] = useState(initialC.metadata.description || "");
	const [metaAuthors, setMetaAuthors] = useState((initialC.metadata.authors || []).join(", "));
	const [metaTags, setMetaTags] = useState((initialC.metadata.tags || []).join(", "));
	const [summary, setSummary] = useState(initialC.summary || "");
	const [summaryLucky, setSummaryLucky] = useState(Boolean(initialC.summary_lucky));

	const [physicalTraits, setPhysicalTraits] = useState<NamedTrait[]>(
		initialC.physical_characteristics || [],
	);
	const [linguisticTraits, setLinguisticTraits] = useState<NamedTrait[]>(
		initialC.linguistic_patterns || [],
	);
	const [psychologyTraits, setPsychologyTraits] = useState<NamedTrait[]>(
		initialC.psychology_and_worldviews || [],
	);
	const [lifestyleTraits, setLifestyleTraits] = useState<NamedTrait[]>(
		initialC.lifestyle_and_preferences || [],
	);
	const [desiresTraits, setDesiresTraits] = useState<NamedTrait[]>(
		initialC.desires || [],
	);
	const [skillsTraits, setSkillsTraits] = useState<NamedTrait[]>(
		initialC.skills || [],
	);
	const [backgrounds, setBackgrounds] = useState<CharacterBackground[]>(
		initialC.backgrounds || [],
	);
	const [exampleDialogs, setExampleDialogs] = useState<ExampleDialog[]>(
		initialC.example_dialogs || [],
	);
	const [stateRows, setStateRows] = useState<StateRow[]>(() =>
		stateMapToRows(initialC.initial_states),
	);

	// Raw TOML State

	const [rawToml, setRawToml] = useState(() => {
		try {
			return serializeCharacterfile(initialC);
		}
		catch {
			return "";
		}
	});

	const importFileInputRef = useRef<HTMLInputElement>(null);

	// Helpers

	const loadCharacterIntoForm = useCallback((record: StoredCharacterfile) => {
		setSelectedId(record.id);
		const c = record.characterfile;

		setMetaName(c.metadata.name || "");
		setMetaVersion(c.metadata.version || "1.0.0");
		setMetaTitle(c.metadata.title || "");
		setMetaDescription(c.metadata.description || "");
		setMetaAuthors((c.metadata.authors || []).join(", "));
		setMetaTags((c.metadata.tags || []).join(", "));
		setSummary(c.summary || "");
		setSummaryLucky(Boolean(c.summary_lucky));

		setPhysicalTraits(c.physical_characteristics || []);
		setLinguisticTraits(c.linguistic_patterns || []);
		setPsychologyTraits(c.psychology_and_worldviews || []);
		setLifestyleTraits(c.lifestyle_and_preferences || []);
		setDesiresTraits(c.desires || []);
		setSkillsTraits(c.skills || []);
		setBackgrounds(c.backgrounds || []);
		setExampleDialogs(c.example_dialogs || []);
		setStateRows(stateMapToRows(c.initial_states));

		try {
			setRawToml(serializeCharacterfile(c));
		}
		catch {
			setRawToml("");
		}

		setErrorMessage(null);
		setSuccessMessage(null);
	}, []);

	const assembleCurrentCharacter = useCallback((): Characterfile => {
		return {
			metadata: {
				name: metaName.trim(),
				version: metaVersion.trim(),
				title: metaTitle.trim(),
				description: metaDescription.trim(),
				authors: metaAuthors.split(",").map(s => s.trim()).filter(Boolean),
				tags: metaTags.split(",").map(s => s.trim()).filter(Boolean),
			},
			summary: summary.trim(),
			...(summaryLucky ? { summary_lucky: true } : {}),
			physical_characteristics: physicalTraits.filter(t => t.name.trim()),
			linguistic_patterns: linguisticTraits.filter(t => t.name.trim()),
			psychology_and_worldviews: psychologyTraits.filter(t => t.name.trim()),
			lifestyle_and_preferences: lifestyleTraits.filter(t => t.name.trim()),
			desires: desiresTraits.filter(t => t.name.trim()),
			skills: skillsTraits.filter(t => t.name.trim()),
			backgrounds: backgrounds.filter(b => b.name.trim() || b.content.trim()),
			example_dialogs: exampleDialogs.filter(d => d.name.trim() || d.dialog.trim()),
			initial_states: stateRowsToMap(stateRows),
		};
	}, [
		metaName,
		metaVersion,
		metaTitle,
		metaDescription,
		metaAuthors,
		metaTags,
		summary,
		summaryLucky,
		physicalTraits,
		linguisticTraits,
		psychologyTraits,
		lifestyleTraits,
		desiresTraits,
		skillsTraits,
		backgrounds,
		exampleDialogs,
		stateRows,
	]);

	const refreshData = useCallback(() => {
		const list = getAllCharacterfiles();
		setCharacters(list);
	}, []);

	// Handlers

	const handleSelectCharacter = useCallback((record: StoredCharacterfile) => {
		loadCharacterIntoForm(record);
	}, [loadCharacterIntoForm]);

	const handleNewCharacter = useCallback(() => {
		const newRecord: StoredCharacterfile = {
			id: `char_${Date.now()}`,
			characterfile: {
				...SAMPLE_CHARACTERFILE,
				metadata: {
					...SAMPLE_CHARACTERFILE.metadata,
					name: `custom_char_${Date.now().toString().slice(-4)}`,
					title: "New Custom Character",
				},
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setSelectedId(null);
		loadCharacterIntoForm(newRecord);
	}, [loadCharacterIntoForm]);

	const handleSaveForm = useCallback((e?: FormEvent) => {
		if (e) {
			e.preventDefault();
		}

		try {
			const c = assembleCurrentCharacter();

			if (!c.metadata.name) {
				setErrorMessage("Character identifier (name) is required.");
				return;
			}

			const saved = saveCharacterfile(c, selectedId || undefined);
			setSelectedId(saved.id);
			setRawToml(serializeCharacterfile(saved.characterfile));
			refreshData();
			setSuccessMessage(`Character "${c.metadata.title || c.metadata.name}" saved.`);
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [assembleCurrentCharacter, selectedId, refreshData]);

	const handleSaveRaw = useCallback((overrideToml?: string) => {
		const tomlToParse = typeof overrideToml === "string" ? overrideToml : rawToml;

		try {
			const parsed = parseCharacterfile(tomlToParse);
			const saved = saveCharacterfile(parsed, selectedId || undefined);
			setSelectedId(saved.id);
			setRawToml(tomlToParse);
			loadCharacterIntoForm(saved);
			refreshData();
			setSuccessMessage(`Raw TOML applied and saved for "${parsed.metadata.title}".`);
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage(`TOML Parse Error: ${(err as Error).message}`);
		}
	}, [rawToml, selectedId, loadCharacterIntoForm, refreshData]);

	const handleDelete = useCallback(() => {
		if (!selectedId) {
			return;
		}

		deleteCharacterfile(selectedId);
		setSuccessMessage("Character removed from registry.");
		const updated = getAllCharacterfiles();
		setCharacters(updated);

		if (updated.length > 0) {
			loadCharacterIntoForm(updated[0]);
		}
		else {
			handleNewCharacter();
		}
	}, [selectedId, loadCharacterIntoForm, handleNewCharacter]);

	const handleExport = useCallback(() => {
		if (!selectedId) {
			return;
		}

		try {
			exportCharacterfileAsFile(selectedId);
			setSuccessMessage("Characterfile exported.");
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [selectedId]);

	const handleImportClick = useCallback(() => {
		importFileInputRef.current?.click();
	}, []);

	const handleFileImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = String(reader.result);
				const imported = importCharacterfileFromToml(content);
				refreshData();
				loadCharacterIntoForm(imported);
				setSuccessMessage(`Imported Character "${imported.characterfile.metadata.title}".`);
			}
			catch (err) {
				setErrorMessage(`Failed to import Character: ${(err as Error).message}`);
			}
		};

		reader.readAsText(file);
		e.target.value = "";
	}, [refreshData, loadCharacterIntoForm]);

	const handleTabChange = useCallback((nextMode: "form" | "raw") => {
		if (nextMode === "raw" && editorMode === "form") {
			try {
				const c = assembleCurrentCharacter();
				setRawToml(serializeCharacterfile(c));
			}
			catch (err) {
				setErrorMessage(`Failed to serialize current form to TOML: ${(err as Error).message}`);
			}
		}

		setEditorMode(nextMode);
	}, [editorMode, assembleCurrentCharacter]);

	// Trait Callbacks

	const handleAddPhysicalTrait = useCallback(() => {
		setPhysicalTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdatePhysicalTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setPhysicalTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemovePhysicalTrait = useCallback((idx: number) => {
		setPhysicalTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddLinguisticTrait = useCallback(() => {
		setLinguisticTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdateLinguisticTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setLinguisticTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveLinguisticTrait = useCallback((idx: number) => {
		setLinguisticTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddPsychologyTrait = useCallback(() => {
		setPsychologyTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdatePsychologyTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setPsychologyTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemovePsychologyTrait = useCallback((idx: number) => {
		setPsychologyTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddLifestyleTrait = useCallback(() => {
		setLifestyleTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdateLifestyleTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setLifestyleTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveLifestyleTrait = useCallback((idx: number) => {
		setLifestyleTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddDesireTrait = useCallback(() => {
		setDesiresTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdateDesireTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setDesiresTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveDesireTrait = useCallback((idx: number) => {
		setDesiresTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddSkillTrait = useCallback(() => {
		setSkillsTraits(prev => [...prev, { name: "", description: "" }]);
	}, []);

	const handleUpdateSkillTrait = useCallback((idx: number, patch: Partial<NamedTrait>) => {
		setSkillsTraits(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveSkillTrait = useCallback((idx: number) => {
		setSkillsTraits(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddBackground = useCallback(() => {
		setBackgrounds(prev => [...prev, { name: "", content: "" }]);
	}, []);

	const handleUpdateBackground = useCallback((idx: number, patch: Partial<CharacterBackground>) => {
		setBackgrounds(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveBackground = useCallback((idx: number) => {
		setBackgrounds(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddExampleDialog = useCallback(() => {
		setExampleDialogs(prev => [...prev, { name: "", dialog: "" }]);
	}, []);

	const handleUpdateExampleDialog = useCallback((idx: number, patch: Partial<ExampleDialog>) => {
		setExampleDialogs(prev =>
			prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
		);
	}, []);

	const handleRemoveExampleDialog = useCallback((idx: number) => {
		setExampleDialogs(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleAddStateRow = useCallback(() => {
		setStateRows(prev => [...prev, { key: "", type: "string", value: "" }]);
	}, []);

	const handleUpdateStateRow = useCallback((idx: number, patch: Partial<StateRow>) => {
		setStateRows(prev =>
			prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
		);
	}, []);

	const handleRemoveStateRow = useCallback((idx: number) => {
		setStateRows(prev => prev.filter((_, i) => i !== idx));
	}, []);

	// Context and Diff Effects

	const summaryPayload = useMemo(() => ({
		name: metaName,
		title: metaTitle,
		version: metaVersion,
	}), [metaName, metaTitle, metaVersion]);

	useEffect(() => {
		onEditorContextChange?.({
			activeId: selectedId,
			rawToml,
			summary: summaryPayload,
		});
	}, [onEditorContextChange, selectedId, rawToml, summaryPayload]);

	useEffect(() => {
		if (applyDiffCallbackRef) {
			applyDiffCallbackRef.current = (proposedToml: string) => {
				setRawToml(proposedToml);
				handleSaveRaw(proposedToml);
			};
		}
	});

	return (
		<div className={styles.container}>
			<CharacterHeader
				fileInputRef={importFileInputRef}
				selectedId={selectedId}
				onNewCharacter={handleNewCharacter}
				onImportClick={handleImportClick}
				onFileImport={handleFileImport}
				onExport={handleExport}
				onDelete={handleDelete}
			/>

			{errorMessage && <Alert variant="error">{errorMessage}</Alert>}
			{successMessage && <Alert variant="success">{successMessage}</Alert>}

			<div className={styles.mainLayout}>
				<CharacterList
					characters={characters}
					selectedId={selectedId}
					onSelectCharacter={handleSelectCharacter}
				/>

				<main className={styles.contentPanel}>
					<div className={styles.contentHeader}>
						<TabGroup<"form" | "raw">
							tabs={CHARACTER_TABS}
							activeTab={editorMode}
							onChange={handleTabChange}
						/>

						<div className={styles.headerActions}>
							<button
								type="button"
								className={`${styles.button} ${styles.primaryButton}`}
								onClick={handleSaveForm}
							>
								Save Character
							</button>
						</div>
					</div>

					{editorMode === "form" && (
						<CharacterFormEditor
							metaName={metaName}
							onMetaNameChange={setMetaName}
							metaVersion={metaVersion}
							onMetaVersionChange={setMetaVersion}
							metaTitle={metaTitle}
							onMetaTitleChange={setMetaTitle}
							metaDescription={metaDescription}
							onMetaDescriptionChange={setMetaDescription}
							metaAuthors={metaAuthors}
							onMetaAuthorsChange={setMetaAuthors}
							metaTags={metaTags}
							onMetaTagsChange={setMetaTags}
							summary={summary}
							onSummaryChange={setSummary}
							summaryLucky={summaryLucky}
							onSummaryLuckyChange={setSummaryLucky}
							physicalTraits={physicalTraits}
							onAddPhysicalTrait={handleAddPhysicalTrait}
							onUpdatePhysicalTrait={handleUpdatePhysicalTrait}
							onRemovePhysicalTrait={handleRemovePhysicalTrait}
							linguisticTraits={linguisticTraits}
							onAddLinguisticTrait={handleAddLinguisticTrait}
							onUpdateLinguisticTrait={handleUpdateLinguisticTrait}
							onRemoveLinguisticTrait={handleRemoveLinguisticTrait}
							psychologyTraits={psychologyTraits}
							onAddPsychologyTrait={handleAddPsychologyTrait}
							onUpdatePsychologyTrait={handleUpdatePsychologyTrait}
							onRemovePsychologyTrait={handleRemovePsychologyTrait}
							lifestyleTraits={lifestyleTraits}
							onAddLifestyleTrait={handleAddLifestyleTrait}
							onUpdateLifestyleTrait={handleUpdateLifestyleTrait}
							onRemoveLifestyleTrait={handleRemoveLifestyleTrait}
							desiresTraits={desiresTraits}
							onAddDesireTrait={handleAddDesireTrait}
							onUpdateDesireTrait={handleUpdateDesireTrait}
							onRemoveDesireTrait={handleRemoveDesireTrait}
							skillsTraits={skillsTraits}
							onAddSkillTrait={handleAddSkillTrait}
							onUpdateSkillTrait={handleUpdateSkillTrait}
							onRemoveSkillTrait={handleRemoveSkillTrait}
							backgrounds={backgrounds}
							onAddBackground={handleAddBackground}
							onUpdateBackground={handleUpdateBackground}
							onRemoveBackground={handleRemoveBackground}
							exampleDialogs={exampleDialogs}
							onAddExampleDialog={handleAddExampleDialog}
							onUpdateExampleDialog={handleUpdateExampleDialog}
							onRemoveExampleDialog={handleRemoveExampleDialog}
							stateRows={stateRows}
							onAddStateRow={handleAddStateRow}
							onUpdateStateRow={handleUpdateStateRow}
							onRemoveStateRow={handleRemoveStateRow}
							onSubmit={handleSaveForm}
						/>
					)}

					{editorMode === "raw" && (
						<CharacterRawEditor
							rawToml={rawToml}
							onChangeToml={setRawToml}
							onApplyRawToml={handleSaveRaw}
						/>
					)}
				</main>
			</div>
		</div>
	);

}
