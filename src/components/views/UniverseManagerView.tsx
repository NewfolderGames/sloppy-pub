import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/common/Alert.tsx";
import { TabGroup, type TabItem } from "@/components/common/TabGroup.tsx";
import { deleteUniverse, exportUniverseAsFile, getAllUniverses, importUniverseFromToml, SAMPLE_UNIVERSEFILE, saveUniverse, type StoredUniversefile } from "@/shared/universe/registry.ts";
import { parseUniversefile, serializeUniversefile } from "@/shared/world/toml.ts";
import type { Universefile } from "@/shared/world/types.ts";
import { stateMapToRows, type StateRow, stateRowsToMap } from "./common/state_helpers.ts";
import { UniverseFormEditor } from "./universe-manager/UniverseFormEditor.tsx";
import { UniverseHeader } from "./universe-manager/UniverseHeader.tsx";
import { UniverseList } from "./universe-manager/UniverseList.tsx";
import { UniverseRawEditor } from "./universe-manager/UniverseRawEditor.tsx";
import styles from "./UniverseManagerView.module.css";

const UNIVERSE_TABS: Array<TabItem<"form" | "raw">> = [
	{ id: "form", label: "Visual Editor" },
	{ id: "raw", label: "Raw TOML" },
];

export interface UniverseManagerViewProps {
	onEditorContextChange?: (context: {
		activeId: string | null;
		rawToml: string;
		summary?: Record<string, unknown>;
	}) => void;
	applyDiffCallbackRef?: React.MutableRefObject<((proposedToml: string) => void) | null>;
}

export function UniverseManagerView(props: UniverseManagerViewProps = {}) {

	const { onEditorContextChange, applyDiffCallbackRef } = props;

	// Component State

	const [universes, setUniverses] = useState<StoredUniversefile[]>(() => getAllUniverses());

	const initialRecord = universes[0];
	const initialU = initialRecord ? initialRecord.universe : SAMPLE_UNIVERSEFILE;

	const [selectedId, setSelectedId] = useState<string | null>(initialRecord ? initialRecord.id : null);
	const [editorMode, setEditorMode] = useState<"form" | "raw">("form");

	// Alerts

	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Form State

	const [metaName, setMetaName] = useState(initialU.metadata.name || "");
	const [metaVersion, setMetaVersion] = useState(initialU.metadata.version || "1.0.0");
	const [metaTitle, setMetaTitle] = useState(initialU.metadata.title || "");
	const [metaDescription, setMetaDescription] = useState(initialU.metadata.description || "");
	const [metaAuthors, setMetaAuthors] = useState((initialU.metadata.authors || []).join(", "));
	const [metaTags, setMetaTags] = useState((initialU.metadata.tags || []).join(", "));

	const [rulesList, setRulesList] = useState<string[]>(initialU.settings?.rules || []);
	const [rulesLucky, setRulesLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialU.settings?.feeling_lucky?.rules || []);
		const len = initialU.settings?.rules?.length || 0;
		return Array.from({ length: len }, (_, i) => luckyIndices.has(i));
	});

	const [backgroundsList, setBackgroundsList] = useState<string[]>(initialU.settings?.backgrounds || []);
	const [backgroundsLucky, setBackgroundsLucky] = useState<boolean[]>(() => {
		const luckyIndices = new Set(initialU.settings?.feeling_lucky?.backgrounds || []);
		const len = initialU.settings?.backgrounds?.length || 0;
		return Array.from({ length: len }, (_, i) => luckyIndices.has(i));
	});

	const [stateRows, setStateRows] = useState<StateRow[]>(() => stateMapToRows(initialU.states));

	// Raw TOML State

	const [rawToml, setRawToml] = useState(() => {
		try {
			return serializeUniversefile(initialU);
		}
		catch {
			return "";
		}
	});

	const importFileInputRef = useRef<HTMLInputElement>(null);

	// Helpers

	const loadUniverseIntoForm = useCallback((record: StoredUniversefile) => {
		setSelectedId(record.id);
		const u = record.universe;

		setMetaName(u.metadata.name || "");
		setMetaVersion(u.metadata.version || "1.0.0");
		setMetaTitle(u.metadata.title || "");
		setMetaDescription(u.metadata.description || "");
		setMetaAuthors((u.metadata.authors || []).join(", "));
		setMetaTags((u.metadata.tags || []).join(", "));

		setRulesList(u.settings?.rules || []);
		const luckyRules = new Set(u.settings?.feeling_lucky?.rules || []);
		setRulesLucky(Array.from({ length: u.settings?.rules?.length || 0 }, (_, i) => luckyRules.has(i)));

		setBackgroundsList(u.settings?.backgrounds || []);
		const luckyBackgrounds = new Set(u.settings?.feeling_lucky?.backgrounds || []);
		setBackgroundsLucky(
			Array.from({ length: u.settings?.backgrounds?.length || 0 }, (_, i) => luckyBackgrounds.has(i)),
		);

		setStateRows(stateMapToRows(u.states));

		try {
			setRawToml(serializeUniversefile(u));
		}
		catch {
			setRawToml("");
		}

		setErrorMessage(null);
		setSuccessMessage(null);
	}, []);

	const refreshData = useCallback(() => {
		const list = getAllUniverses();
		setUniverses(list);
	}, []);

	const assembleCurrentUniverse = useCallback((): Universefile => {
		const luckyRulesIndices = rulesLucky.map((lucky, i) => (lucky ? i : -1)).filter(i => i >= 0);
		const luckyBackgroundsIndices = backgroundsLucky
			.map((lucky, i) => (lucky ? i : -1))
			.filter(i => i >= 0);
		const feelingLuckyDoc: Record<string, number[]> = {};
		if (luckyRulesIndices.length > 0) {
			feelingLuckyDoc.rules = luckyRulesIndices;
		}
		if (luckyBackgroundsIndices.length > 0) {
			feelingLuckyDoc.backgrounds = luckyBackgroundsIndices;
		}

		return {
			metadata: {
				name: metaName.trim(),
				version: metaVersion.trim(),
				title: metaTitle.trim(),
				description: metaDescription.trim(),
				authors: metaAuthors.split(",").map(s => s.trim()).filter(Boolean),
				tags: metaTags.split(",").map(s => s.trim()).filter(Boolean),
			},
			settings: {
				rules: rulesList.filter(r => r.trim().length > 0),
				backgrounds: backgroundsList.filter(b => b.trim().length > 0),
				feeling_lucky: Object.keys(feelingLuckyDoc).length > 0 ? feelingLuckyDoc : undefined,
			},
			states: stateRowsToMap(stateRows),
		};
	}, [
		metaName,
		metaVersion,
		metaTitle,
		metaDescription,
		metaAuthors,
		metaTags,
		rulesList,
		rulesLucky,
		backgroundsList,
		backgroundsLucky,
		stateRows,
	]);

	// Handlers

	const onSelectUniverse = useCallback((record: StoredUniversefile) => {
		loadUniverseIntoForm(record);
	}, [loadUniverseIntoForm]);

	const onCreateNewUniverse = useCallback(() => {
		const newRecord: StoredUniversefile = {
			id: `universe_${Date.now()}`,
			universe: {
				...SAMPLE_UNIVERSEFILE,
				metadata: {
					...SAMPLE_UNIVERSEFILE.metadata,
					name: `custom_universe_${Date.now().toString().slice(-4)}`,
					title: "New Custom Universe",
				},
				settings: {
					rules: ["Fundamental physical constants remain immutable."],
					backgrounds: ["Cosmic background radiation echoes the genesis of this reality continuum."],
				},
				states: {
					"universe.dimensional_stability": 100,
				},
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setSelectedId(null);
		loadUniverseIntoForm(newRecord);
	}, [loadUniverseIntoForm]);

	const onSaveUniverse = useCallback((e?: FormEvent) => {
		if (e) {
			e.preventDefault();
		}

		try {
			const u = assembleCurrentUniverse();

			if (!u.metadata.name) {
				setErrorMessage("Universe identifier (name) is required.");
				return;
			}

			const saved = saveUniverse(u, selectedId || undefined);
			setSelectedId(saved.id);
			setRawToml(serializeUniversefile(saved.universe));
			refreshData();
			setSuccessMessage(`Universe "${u.metadata.title || u.metadata.name}" saved.`);
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [assembleCurrentUniverse, selectedId, refreshData]);

	const onDeleteUniverse = useCallback(() => {
		if (!selectedId) {
			return;
		}

		deleteUniverse(selectedId);
		setSuccessMessage("Universe removed from registry.");
		const updated = getAllUniverses();
		setUniverses(updated);

		if (updated.length > 0) {
			loadUniverseIntoForm(updated[0]);
		}
		else {
			onCreateNewUniverse();
		}
	}, [selectedId, loadUniverseIntoForm, onCreateNewUniverse]);

	const onExportUniverse = useCallback(() => {
		if (!selectedId) {
			return;
		}

		try {
			exportUniverseAsFile(selectedId);
			setSuccessMessage("Universefile exported.");
		}
		catch (err) {
			setErrorMessage((err as Error).message);
		}
	}, [selectedId]);

	const onImportUniverseFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = String(reader.result);
				const imported = importUniverseFromToml(content);
				refreshData();
				loadUniverseIntoForm(imported);
				setSuccessMessage(`Imported Universe "${imported.universe.metadata.title}".`);
			}
			catch (err) {
				setErrorMessage(`Failed to import Universe: ${(err as Error).message}`);
			}
		};

		reader.readAsText(file);
		e.target.value = "";
	}, [refreshData, loadUniverseIntoForm]);

	const onApplyRawToml = useCallback((overrideToml?: string) => {
		const tomlToApply = typeof overrideToml === "string" ? overrideToml : rawToml;

		try {
			const parsed = parseUniversefile(tomlToApply);
			const saved = saveUniverse(parsed, selectedId || undefined);
			setSelectedId(saved.id);
			setRawToml(tomlToApply);
			loadUniverseIntoForm(saved);
			refreshData();
			setSuccessMessage("Applied and saved universefile changes.");
			setErrorMessage(null);
		}
		catch (err) {
			setErrorMessage(`TOML Parse Error: ${(err as Error).message}`);
		}
	}, [rawToml, selectedId, loadUniverseIntoForm, refreshData]);

	// Context and Diff Effects

	const summary = useMemo(() => ({
		title: metaTitle || metaName,
		name: metaName,
		rulesCount: rulesList.length,
		backgroundsCount: backgroundsList.length,
	}), [metaTitle, metaName, rulesList.length, backgroundsList.length]);

	useEffect(() => {
		onEditorContextChange?.({
			activeId: selectedId,
			rawToml,
			summary,
		});
	}, [selectedId, rawToml, summary, onEditorContextChange]);

	useEffect(() => {
		if (applyDiffCallbackRef) {
			applyDiffCallbackRef.current = (proposedToml: string) => {
				onApplyRawToml(proposedToml);
			};
		}
	});

	// Rules, Backgrounds & States Helpers

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

	const addStateRow = useCallback(() => {
		setStateRows(prev => [...prev, { key: "universe.state_key", type: "string", value: "" }]);
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

	const handleTabChange = useCallback((mode: "form" | "raw") => {
		setRawToml(serializeUniversefile(assembleCurrentUniverse()));
		setEditorMode(mode);
	}, [assembleCurrentUniverse]);

	return (
		<div className={styles.container}>
			<UniverseHeader
				fileInputRef={importFileInputRef}
				onImportFile={onImportUniverseFile}
				onCreateNew={onCreateNewUniverse}
			/>

			{errorMessage && <Alert variant="error">{errorMessage}</Alert>}
			{successMessage && <Alert variant="success">{successMessage}</Alert>}

			<div className={styles.mainLayout}>
				<UniverseList
					universes={universes}
					selectedId={selectedId}
					onSelectUniverse={onSelectUniverse}
				/>

				<main className={styles.contentPanel}>
					<div className={styles.contentHeader}>
						<TabGroup<"form" | "raw">
							tabs={UNIVERSE_TABS}
							activeTab={editorMode}
							onChange={handleTabChange}
						/>

						<div className={styles.headerActions}>
							<button
								type="button"
								className={`${styles.button} ${styles.primaryButton}`}
								onClick={() => onSaveUniverse()}
							>
								Save Universe
							</button>

							{selectedId && (
								<>
									<button
										type="button"
										className={styles.button}
										onClick={onExportUniverse}
									>
										Export TOML
									</button>

									<button
										type="button"
										className={`${styles.button} ${styles.dangerButton}`}
										onClick={onDeleteUniverse}
									>
										Delete
									</button>
								</>
							)}
						</div>
					</div>

					{editorMode === "form" && (
						<UniverseFormEditor
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
							rulesList={rulesList}
							rulesLucky={rulesLucky}
							onAddRule={addRule}
							onUpdateRule={updateRule}
							onRemoveRule={removeRule}
							onToggleRuleLucky={handleToggleRuleLucky}
							backgroundsList={backgroundsList}
							backgroundsLucky={backgroundsLucky}
							onAddBackground={addBackground}
							onUpdateBackground={updateBackground}
							onRemoveBackground={removeBackground}
							onToggleBackgroundLucky={handleToggleBackgroundLucky}
							stateRows={stateRows}
							onAddStateRow={addStateRow}
							onUpdateStateRow={updateStateRow}
							onRemoveStateRow={removeStateRow}
							onSubmit={onSaveUniverse}
						/>
					)}

					{editorMode === "raw" && (
						<UniverseRawEditor
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

export default UniverseManagerView;
