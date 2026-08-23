import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/common/Alert.tsx";
import { TabGroup, type TabItem } from "@/components/common/TabGroup.tsx";
import { deleteWorldfile, exportWorldfileAsFile, getAllWorldfiles, importWorldfileFromToml, saveWorldfile, type StoredWorldfile } from "@/shared/world/registry.ts";
import { parseWorldfile, serializeWorldfile } from "@/shared/world/toml.ts";
import type { ArgumentDefinition, VariableDefinition, Worldfile } from "@/shared/world/types.ts";
import { stateMapToRows, type StateRow } from "./common/state_helpers.ts";
import { WorldfileEditor } from "./world-manager/WorldfileEditor.tsx";
import { WorldfileList } from "./world-manager/WorldfileList.tsx";
import { WorldfileRawEditor } from "./world-manager/WorldfileRawEditor.tsx";
import { WorldHeader } from "./world-manager/WorldHeader.tsx";
import { mergeWorldfileFormState, type WorldfileFormState } from "./worldfile_form.ts";
import styles from "./WorldManagerView.module.css";

const WORLD_EDITOR_TABS: Array<TabItem<"form" | "raw">> = [
	{ id: "form", label: "Visual Editor" },
	{ id: "raw", label: "Raw TOML" },
];

const DEFAULT_NEW_WORLDFILE: Worldfile = {
	metadata: {
		name: "new_world",
		version: "1.0.0",
		title: "New World",
		description: "A newly created roleplay world.",
		authors: ["Author"],
		tags: ["custom"],
	},
	args: [
		{
			name: "SETTING_NAME",
			type: "text",
			default: "Frontier Outpost",
			description: "Primary location name.",
		},
	],
	vars: [
		{
			name: "PLAYER_NAME",
			type: "text",
			default: "Traveler",
			description: "Name of the player character.",
		},
	],
	content: {
		backgrounds: ["The story takes place in {{SETTING_NAME}}."],
		guidelines: [],
		settings: {
			rules: ["Standard laws of cause and effect apply."],
			guidelines: ["Provide descriptive and evocative responses."],
		},
	},
	states: {
		"outpost.status": "calm",
		"player.health": 100,
	},
};

export interface WorldManagerViewProps {
	onEditorContextChange?: (context: {
		activeId: string | null;
		rawToml: string;
		summary?: Record<string, unknown>;
	}) => void;
	applyDiffCallbackRef?: React.MutableRefObject<((proposedToml: string) => void) | null>;
}

export function WorldManagerView(props: WorldManagerViewProps = {}) {

	const { onEditorContextChange, applyDiffCallbackRef } = props;

	// Component State

	const [worldfiles, setWorldfiles] = useState<StoredWorldfile[]>(() => getAllWorldfiles());

	const initialRecord = worldfiles[0];
	const initialWf = initialRecord ? initialRecord.worldfile : DEFAULT_NEW_WORLDFILE;

	const [baseWorldfile, setBaseWorldfile] = useState<Worldfile>(initialWf);
	const [selectedId, setSelectedId] = useState<string | null>(initialRecord ? initialRecord.id : null);
	const [editorMode, setEditorMode] = useState<"form" | "raw">("form");

	// Alerts

	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Form Editor State

	const [metaName, setMetaName] = useState(initialWf.metadata.name || "");
	const [metaVersion, setMetaVersion] = useState(initialWf.metadata.version || "1.0.0");
	const [metaTitle, setMetaTitle] = useState(initialWf.metadata.title || "");
	const [metaDescription, setMetaDescription] = useState(initialWf.metadata.description || "");
	const [metaAuthors, setMetaAuthors] = useState((initialWf.metadata.authors || []).join(", "));
	const [metaTags, setMetaTags] = useState((initialWf.metadata.tags || []).join(", "));

	const [backgroundsList, setBackgroundsList] = useState<string[]>(() => {
		if (initialWf.content.backgrounds && initialWf.content.backgrounds.length > 0) {
			return initialWf.content.backgrounds;
		}

		if (initialWf.content.description) {
			return [initialWf.content.description];
		}

		return [];
	});
	const [backgroundsLucky, setBackgroundsLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialWf.content.feeling_lucky?.backgrounds || []);
		const len = initialWf.content.backgrounds?.length || (initialWf.content.description ? 1 : 0);
		return Array.from({ length: len }, (_, i) => luckyIndices.has(i));
	});

	const [rulesList, setRulesList] = useState<string[]>(initialWf.content.settings?.rules || []);
	const [rulesLucky, setRulesLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialWf.content.feeling_lucky?.rules || []);
		const len = initialWf.content.settings?.rules?.length || 0;
		return Array.from({ length: len }, (_, i) => luckyIndices.has(i));
	});

	const [guidelinesList, setGuidelinesList] = useState<string[]>(initialWf.content.settings?.guidelines || []);
	const [guidelinesLucky, setGuidelinesLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialWf.content.feeling_lucky?.guidelines || []);
		const len = initialWf.content.settings?.guidelines?.length || 0;
		return Array.from({ length: len }, (_, i) => luckyIndices.has(i));
	});

	const [plotIntroMode, setPlotIntroMode] = useState<"random" | "user_select" | "dynamic">(
		initialWf.content.plot?.intro?.mode || "random",
	);
	const [plotIntroList, setPlotIntroList] = useState<string[]>(
		(initialWf.content.plot?.intro?.list || []).map(item => item.value),
	);
	const [plotIntroLucky, setPlotIntroLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialWf.content.feeling_lucky?.plot_intro || []);
		return (initialWf.content.plot?.intro?.list || []).map((item, i) =>
			Boolean(item.feelingLucky || luckyIndices.has(i)),
		);
	});

	const [argsList, setArgsList] = useState<ArgumentDefinition[]>(initialWf.args || []);
	const [varsList, setVarsList] = useState<VariableDefinition[]>(initialWf.vars || []);
	const [stateRows, setStateRows] = useState<StateRow[]>(() => stateMapToRows(initialWf.states));

	// Raw TOML State

	const [rawToml, setRawToml] = useState(() => {
		try {
			return serializeWorldfile(initialWf);
		}
		catch {
			return "";
		}
	});

	const importWorldfileInputRef = useRef<HTMLInputElement>(null);

	// Helpers

	const loadWorldfileIntoForm = useCallback((record: StoredWorldfile) => {
		setSelectedId(record.id);
		const wf = record.worldfile;
		setBaseWorldfile(wf);

		setMetaName(wf.metadata.name || "");
		setMetaVersion(wf.metadata.version || "1.0.0");
		setMetaTitle(wf.metadata.title || "");
		setMetaDescription(wf.metadata.description || "");
		setMetaAuthors((wf.metadata.authors || []).join(", "));
		setMetaTags((wf.metadata.tags || []).join(", "));

		if (wf.content.backgrounds && wf.content.backgrounds.length > 0) {
			setBackgroundsList(wf.content.backgrounds);
		}
		else if (wf.content.description) {
			setBackgroundsList([wf.content.description]);
		}
		else {
			setBackgroundsList([]);
		}

		const luckyBg = new Set(wf.content.feeling_lucky?.backgrounds || []);
		const bgLen = wf.content.backgrounds?.length || (wf.content.description ? 1 : 0);
		setBackgroundsLucky(Array.from({ length: bgLen }, (_, i) => luckyBg.has(i)));

		setRulesList(wf.content.settings?.rules || []);
		const luckyRules = new Set(wf.content.feeling_lucky?.rules || []);
		const rulesLen = wf.content.settings?.rules?.length || 0;
		setRulesLucky(Array.from({ length: rulesLen }, (_, i) => luckyRules.has(i)));

		setGuidelinesList(wf.content.settings?.guidelines || []);
		const luckyGuidelines = new Set(wf.content.feeling_lucky?.guidelines || []);
		const guidelinesLen = wf.content.settings?.guidelines?.length || 0;
		setGuidelinesLucky(Array.from({ length: guidelinesLen }, (_, i) => luckyGuidelines.has(i)));

		setPlotIntroMode(wf.content.plot?.intro?.mode || "random");
		setPlotIntroList((wf.content.plot?.intro?.list || []).map(item => item.value));
		const luckyPlotIntro = new Set(wf.content.feeling_lucky?.plot_intro || []);
		setPlotIntroLucky(
			(wf.content.plot?.intro?.list || []).map((item, i) =>
				Boolean(item.feelingLucky || luckyPlotIntro.has(i)),
			),
		);

		setArgsList(wf.args || []);
		setVarsList(wf.vars || []);
		setStateRows(stateMapToRows(wf.states));

		try {
			setRawToml(serializeWorldfile(wf));
		}
		catch {
			setRawToml("");
		}

		setErrorMessage(null);
		setSuccessMessage(null);
	}, []);

	const refreshData = useCallback(() => {
		const list = getAllWorldfiles();
		setWorldfiles(list);
	}, []);

	const getFormState = useCallback((): WorldfileFormState => {
		return {
			metaName,
			metaVersion,
			metaTitle,
			metaDescription,
			metaAuthors,
			metaTags,
			backgroundsList,
			backgroundsLucky,
			rulesList,
			rulesLucky,
			guidelinesList,
			guidelinesLucky,
			plotIntroMode,
			plotIntroList,
			plotIntroLucky,
			argsList,
			varsList,
			stateRows,
		};
	}, [
		metaName,
		metaVersion,
		metaTitle,
		metaDescription,
		metaAuthors,
		metaTags,
		backgroundsList,
		backgroundsLucky,
		rulesList,
		rulesLucky,
		guidelinesList,
		guidelinesLucky,
		plotIntroMode,
		plotIntroList,
		plotIntroLucky,
		argsList,
		varsList,
		stateRows,
	]);

	const assembleCurrentWorldfile = useCallback((): Worldfile => {
		return mergeWorldfileFormState(baseWorldfile, getFormState());
	}, [baseWorldfile, getFormState]);

	// Handlers

	const onSelectWorldfile = useCallback((record: StoredWorldfile) => {
		loadWorldfileIntoForm(record);
	}, [loadWorldfileIntoForm]);

	const onCreateNewWorldfile = useCallback(() => {
		const newRecord: StoredWorldfile = {
			id: `world_${Date.now()}`,
			worldfile: {
				...DEFAULT_NEW_WORLDFILE,
				metadata: {
					...DEFAULT_NEW_WORLDFILE.metadata,
					name: `custom_world_${Date.now().toString().slice(-4)}`,
					title: "New Custom World",
				},
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setSelectedId(null);
		loadWorldfileIntoForm(newRecord);
	}, [loadWorldfileIntoForm]);

	const onSaveWorldfile = useCallback((e?: FormEvent) => {
		if (e) {
			e.preventDefault();
		}

		try {
			const wf = assembleCurrentWorldfile();

			if (!wf.metadata.name) {
				setErrorMessage("World identifier (name) is required.");
				return;
			}

			const saved = saveWorldfile(wf, selectedId || undefined);
			setSelectedId(saved.id);
			setBaseWorldfile(saved.worldfile);
			setRawToml(serializeWorldfile(saved.worldfile));
			refreshData();
			setSuccessMessage(`World "${wf.metadata.title || wf.metadata.name}" saved.`);
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [assembleCurrentWorldfile, selectedId, refreshData]);

	const onDeleteWorldfile = useCallback(() => {
		if (!selectedId) {
			return;
		}

		deleteWorldfile(selectedId);
		setSuccessMessage("Worldfile deleted.");
		const updated = getAllWorldfiles();
		setWorldfiles(updated);

		if (updated.length > 0) {
			loadWorldfileIntoForm(updated[0]);
		}
		else {
			onCreateNewWorldfile();
		}
	}, [selectedId, loadWorldfileIntoForm, onCreateNewWorldfile]);

	const onExportWorldfile = useCallback(() => {
		if (!selectedId) {
			return;
		}

		try {
			exportWorldfileAsFile(selectedId);
			setSuccessMessage("Worldfile exported.");
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [selectedId]);

	const onImportWorldfileFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = String(reader.result);
				const imported = importWorldfileFromToml(content);
				refreshData();
				loadWorldfileIntoForm(imported);
				setSuccessMessage(`Imported World "${imported.worldfile.metadata.title}".`);
			}
			catch (err) {
				setErrorMessage(`Failed to import Worldfile: ${(err as Error).message}`);
			}
		};

		reader.readAsText(file);
		e.target.value = "";
	}, [refreshData, loadWorldfileIntoForm]);

	const onApplyRawToml = useCallback((overrideToml?: string) => {
		const tomlToApply = typeof overrideToml === "string" ? overrideToml : rawToml;

		try {
			const parsed = parseWorldfile(tomlToApply);
			const saved = saveWorldfile(parsed, selectedId || undefined);
			setSelectedId(saved.id);
			setBaseWorldfile(saved.worldfile);
			setRawToml(tomlToApply);
			loadWorldfileIntoForm(saved);
			refreshData();
			setSuccessMessage("Applied and saved worldfile changes.");
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage(`TOML Parse Error: ${(err as Error).message}`);
		}
	}, [rawToml, selectedId, loadWorldfileIntoForm, refreshData]);

	const handleTabChange = useCallback((mode: "form" | "raw") => {
		setRawToml(serializeWorldfile(assembleCurrentWorldfile()));
		setEditorMode(mode);
	}, [assembleCurrentWorldfile]);

	// Arguments, Variables & Plot Helpers

	const addArg = useCallback(() => {
		setArgsList(prev => [...prev, { name: "NEW_ARG", type: "text", default: "", description: "" }]);
	}, []);

	const updateArg = useCallback((idx: number, patch: Partial<ArgumentDefinition>) => {
		setArgsList((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	}, []);

	const removeArg = useCallback((idx: number) => {
		setArgsList(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const addVar = useCallback(() => {
		setVarsList(prev => [...prev, { name: "NEW_VAR", type: "text", default: "", description: "" }]);
	}, []);

	const updateVar = useCallback((idx: number, patch: Partial<VariableDefinition>) => {
		setVarsList((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	}, []);

	const removeVar = useCallback((idx: number) => {
		setVarsList(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const addBackground = useCallback(() => {
		setBackgroundsList(prev => [...prev, ""]);
		setBackgroundsLucky(prev => [...prev, false]);
	}, []);

	const updateBackground = useCallback((idx: number, val: string) => {
		setBackgroundsList((prev) => {
			const next = [...prev];
			next[idx] = val;
			return next;
		});
	}, []);

	const removeBackground = useCallback((idx: number) => {
		setBackgroundsList(prev => prev.filter((_, i) => i !== idx));
		setBackgroundsLucky(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleToggleBackgroundLucky = useCallback((idx: number, checked: boolean) => {
		setBackgroundsLucky((prev) => {
			const next = [...prev];
			next[idx] = checked;
			return next;
		});
	}, []);

	const addRule = useCallback(() => {
		setRulesList(prev => [...prev, ""]);
		setRulesLucky(prev => [...prev, false]);
	}, []);

	const updateRule = useCallback((idx: number, val: string) => {
		setRulesList((prev) => {
			const next = [...prev];
			next[idx] = val;
			return next;
		});
	}, []);

	const removeRule = useCallback((idx: number) => {
		setRulesList(prev => prev.filter((_, i) => i !== idx));
		setRulesLucky(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleToggleRuleLucky = useCallback((idx: number, checked: boolean) => {
		setRulesLucky((prev) => {
			const next = [...prev];
			next[idx] = checked;
			return next;
		});
	}, []);

	const addGuideline = useCallback(() => {
		setGuidelinesList(prev => [...prev, ""]);
		setGuidelinesLucky(prev => [...prev, false]);
	}, []);

	const updateGuideline = useCallback((idx: number, val: string) => {
		setGuidelinesList((prev) => {
			const next = [...prev];
			next[idx] = val;
			return next;
		});
	}, []);

	const removeGuideline = useCallback((idx: number) => {
		setGuidelinesList(prev => prev.filter((_, i) => i !== idx));
		setGuidelinesLucky(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleToggleGuidelineLucky = useCallback((idx: number, checked: boolean) => {
		setGuidelinesLucky((prev) => {
			const next = [...prev];
			next[idx] = checked;
			return next;
		});
	}, []);

	const addIntroPlot = useCallback(() => {
		setPlotIntroList(prev => [...prev, ""]);
		setPlotIntroLucky(prev => [...prev, false]);
	}, []);

	const updateIntroPlot = useCallback((idx: number, val: string) => {
		setPlotIntroList((prev) => {
			const next = [...prev];
			next[idx] = val;
			return next;
		});
	}, []);

	const removeIntroPlot = useCallback((idx: number) => {
		setPlotIntroList(prev => prev.filter((_, i) => i !== idx));
		setPlotIntroLucky(prev => prev.filter((_, i) => i !== idx));
	}, []);

	const handleTogglePlotIntroLucky = useCallback((idx: number, checked: boolean) => {
		setPlotIntroLucky((prev) => {
			const next = [...prev];
			next[idx] = checked;
			return next;
		});
	}, []);

	const addStateRow = useCallback(() => {
		setStateRows(prev => [...prev, { key: "world.state_key", type: "string", value: "" }]);
	}, []);

	const updateStateRow = useCallback((idx: number, patch: Partial<StateRow>) => {
		setStateRows((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	}, []);

	const removeStateRow = useCallback((idx: number) => {
		setStateRows(prev => prev.filter((_, i) => i !== idx));
	}, []);

	// Context and Diff Effects

	const summaryPayload = useMemo(() => ({
		title: metaTitle || metaName,
		name: metaName,
		description: metaDescription,
		argsCount: argsList.length,
		varsCount: varsList.length,
	}), [metaTitle, metaName, metaDescription, argsList.length, varsList.length]);

	useEffect(() => {
		onEditorContextChange?.({
			activeId: selectedId,
			rawToml,
			summary: summaryPayload,
		});
	}, [selectedId, rawToml, summaryPayload, onEditorContextChange]);

	useEffect(() => {
		if (applyDiffCallbackRef) {
			applyDiffCallbackRef.current = (proposedToml: string) => {
				onApplyRawToml(proposedToml);
			};
		}
	});

	return (
		<div className={styles.container}>
			<WorldHeader
				fileInputRef={importWorldfileInputRef}
				onImportFile={onImportWorldfileFile}
				onCreateNew={onCreateNewWorldfile}
			/>

			{errorMessage && <Alert variant="error">{errorMessage}</Alert>}
			{successMessage && <Alert variant="success">{successMessage}</Alert>}

			<div className={styles.mainLayout}>
				<WorldfileList
					worldfiles={worldfiles}
					selectedId={selectedId}
					onSelectWorldfile={onSelectWorldfile}
				/>

				<main className={styles.contentPanel}>
					<div className={styles.contentHeader}>
						<TabGroup<"form" | "raw">
							tabs={WORLD_EDITOR_TABS}
							activeTab={editorMode}
							onChange={handleTabChange}
						/>

						<div className={styles.headerActions}>
							<button
								type="button"
								className={styles.button}
								onClick={() => onSaveWorldfile()}
							>
								Save
							</button>

							{selectedId && (
								<>
									<button
										type="button"
										className={styles.button}
										onClick={onExportWorldfile}
									>
										Export TOML
									</button>

									<button
										type="button"
										className={`${styles.button} ${styles.dangerButton}`}
										onClick={onDeleteWorldfile}
									>
										Delete
									</button>
								</>
							)}
						</div>
					</div>

					{editorMode === "form" && (
						<WorldfileEditor
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
							argsList={argsList}
							onAddArg={addArg}
							onUpdateArg={updateArg}
							onRemoveArg={removeArg}
							varsList={varsList}
							onAddVar={addVar}
							onUpdateVar={updateVar}
							onRemoveVar={removeVar}
							backgroundsList={backgroundsList}
							backgroundsLucky={backgroundsLucky}
							onAddBackground={addBackground}
							onUpdateBackground={updateBackground}
							onRemoveBackground={removeBackground}
							onToggleBackgroundLucky={handleToggleBackgroundLucky}
							rulesList={rulesList}
							rulesLucky={rulesLucky}
							onAddRule={addRule}
							onUpdateRule={updateRule}
							onRemoveRule={removeRule}
							onToggleRuleLucky={handleToggleRuleLucky}
							guidelinesList={guidelinesList}
							guidelinesLucky={guidelinesLucky}
							onAddGuideline={addGuideline}
							onUpdateGuideline={updateGuideline}
							onRemoveGuideline={removeGuideline}
							onToggleGuidelineLucky={handleToggleGuidelineLucky}
							plotIntroMode={plotIntroMode}
							onPlotIntroModeChange={setPlotIntroMode}
							plotIntroList={plotIntroList}
							plotIntroLucky={plotIntroLucky}
							onAddIntroPlot={addIntroPlot}
							onUpdateIntroPlot={updateIntroPlot}
							onRemoveIntroPlot={removeIntroPlot}
							onTogglePlotIntroLucky={handleTogglePlotIntroLucky}
							stateRows={stateRows}
							onAddStateRow={addStateRow}
							onUpdateStateRow={updateStateRow}
							onRemoveStateRow={removeStateRow}
							onSubmit={onSaveWorldfile}
						/>
					)}

					{editorMode === "raw" && (
						<WorldfileRawEditor
							rawToml={rawToml}
							onChangeToml={setRawToml}
							onApplyRawToml={() => onApplyRawToml()}
						/>
					)}
				</main>
			</div>
		</div>
	);

}

export default WorldManagerView;
