import { type FormEvent, useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/common/Alert.tsx";
import { TabGroup } from "@/components/common/TabGroup.tsx";
import { getAllCharacterfiles, type StoredCharacterfile } from "@/shared/character/registry.ts";
import { getAllLoreBooks } from "@/shared/lore/registry.ts";
import type { StoredLoreBook } from "@/shared/lore/types.ts";
import { getAllUniverses, getUniverse, type StoredUniversefile } from "@/shared/universe/registry.ts";
import { createWorldInstance, deleteInstance, getActiveInstanceId, getAllInstances, setActiveInstanceId } from "@/shared/world/instance_manager.ts";
import { getAllWorldfiles, getWorldfile, type StoredWorldfile } from "@/shared/world/registry.ts";
import type { VariableDefinition, WorldInstance } from "@/shared/world/types.ts";
import { InstanceCreateWizard } from "./instance-manager/InstanceCreateWizard.tsx";
import { InstanceDetail } from "./instance-manager/InstanceDetail.tsx";
import { InstanceList } from "./instance-manager/InstanceList.tsx";
import styles from "./InstanceManagerView.module.css";

interface Props {
	activeInstanceId?: string | null;
	onSelectInstance?: (instanceId: string) => void;
	onNavigateTab?: (tab: "chat" | "world-manager") => void;
}

export function InstanceManagerView(props: Readonly<Props>) {

	const { activeInstanceId: propActiveId, onSelectInstance, onNavigateTab } = props;

	// Component State

	const [instances, setInstances] = useState<WorldInstance[]>(() => getAllInstances());
	const [activeId, setActiveId] = useState<string | null>(() => propActiveId ?? getActiveInstanceId());
	const [selectedId, setSelectedId] = useState<string | null>(() => {
		const curr = propActiveId ?? getActiveInstanceId();
		if (curr && instances.some(i => i.id === curr)) {
			return curr;
		}

		return instances[0]?.id ?? null;
	});

	const [viewMode, setViewMode] = useState<"list" | "create">("list");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Wizard Creation State

	const [availableWorldfiles, setAvailableWorldfiles] = useState<StoredWorldfile[]>(() => getAllWorldfiles());
	const [availableUniverses, setAvailableUniverses] = useState<StoredUniversefile[]>(() => getAllUniverses());
	const [availableCharacters, setAvailableCharacters] = useState<StoredCharacterfile[]>(() => getAllCharacterfiles());
	const [availableLorebooks, setAvailableLorebooks] = useState<StoredLoreBook[]>(() => getAllLoreBooks());

	const [createWorldId, setCreateWorldId] = useState<string>(() => availableWorldfiles[0]?.id ?? "");
	const [createUniverseId, setCreateUniverseId] = useState<string>("");
	const [createUniverseMode, setCreateUniverseMode] = useState<"isolated" | "synchronized">("synchronized");
	const [selectedLorebookIds, setSelectedLorebookIds] = useState<string[]>([]);
	const [createTitle, setCreateTitle] = useState<string>("");
	const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
	const [injectedVarValues, setInjectedVarValues] = useState<Record<string, string | number | boolean>>({});

	// Helpers

	const refreshInstances = useCallback(() => {
		const updated = getAllInstances();
		setInstances(updated);
		const currentActive = getActiveInstanceId();
		setActiveId(currentActive);
	}, []);

	const refreshAvailableResources = useCallback(() => {
		const wfs = getAllWorldfiles();
		setAvailableWorldfiles(wfs);

		if (!createWorldId && wfs.length > 0) {
			setCreateWorldId(wfs[0].id);
		}

		setAvailableUniverses(getAllUniverses());
		setAvailableCharacters(getAllCharacterfiles());
		setAvailableLorebooks(getAllLoreBooks());
	}, [createWorldId]);

	const handleOpenCreateWizard = useCallback(() => {
		refreshAvailableResources();
		setErrorMessage(null);
		setSuccessMessage(null);
		setSelectedCharacterIds([]);
		setSelectedLorebookIds([]);

		const wfs = getAllWorldfiles();
		const targetWf = wfs.find(wf => wf.id === createWorldId) || wfs[0];

		if (targetWf) {
			setCreateWorldId(targetWf.id);
			setCreateTitle(`${targetWf.worldfile.metadata.title} Session`);

			const initialVars: Record<string, string | number | boolean> = {};
			for (const v of targetWf.worldfile.vars || []) {
				if (v.default !== undefined) {
					initialVars[v.name] = v.default;
				}
				else if (v.type === "boolean") {
					initialVars[v.name] = false;
				}
				else if (v.type === "number") {
					initialVars[v.name] = 0;
				}
				else {
					initialVars[v.name] = "";
				}
			}
			setInjectedVarValues(initialVars);
		}

		setViewMode("create");
	}, [refreshAvailableResources, createWorldId]);

	const handleSelectWorldfile = useCallback((worldId: string) => {
		setCreateWorldId(worldId);
		const targetWf = availableWorldfiles.find(wf => wf.id === worldId);

		if (targetWf) {
			setCreateTitle(`${targetWf.worldfile.metadata.title} Session`);

			const initialVars: Record<string, string | number | boolean> = {};
			for (const v of targetWf.worldfile.vars || []) {
				if (v.default !== undefined) {
					initialVars[v.name] = v.default;
				}
				else if (v.type === "boolean") {
					initialVars[v.name] = false;
				}
				else if (v.type === "number") {
					initialVars[v.name] = 0;
				}
				else {
					initialVars[v.name] = "";
				}
			}
			setInjectedVarValues(initialVars);
		}
	}, [availableWorldfiles]);

	const handleVarChange = useCallback((name: string, type: VariableDefinition["type"], rawVal: unknown) => {
		setInjectedVarValues((prev) => {
			let val: string | number | boolean;
			if (type === "number") {
				const num = Number(rawVal);
				val = Number.isNaN(num) ? 0 : num;
			}
			else if (type === "boolean") {
				val = Boolean(rawVal);
			}
			else {
				val = String(rawVal);
			}

			return {
				...prev,
				[name]: val,
			};
		});
	}, []);

	const handleToggleCharacterId = useCallback((charId: string) => {
		setSelectedCharacterIds(prev =>
			prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId],
		);
	}, []);

	const handleToggleLorebookId = useCallback((lorebookId: string) => {
		setSelectedLorebookIds(prev =>
			prev.includes(lorebookId) ? prev.filter(id => id !== lorebookId) : [...prev, lorebookId],
		);
	}, []);

	const handleCreateInstanceSubmit = useCallback(async (e: FormEvent) => {
		e.preventDefault();
		setErrorMessage(null);
		setSuccessMessage(null);

		if (!createWorldId) {
			setErrorMessage("Please select a Worldfile.");
			return;
		}

		try {
			const newInstance = await createWorldInstance({
				title: createTitle.trim() || undefined,
				worldId: createWorldId,
				universeId: createUniverseId || undefined,
				universeMode: createUniverseMode,
				lorebookIds: selectedLorebookIds,
				lorebookId: selectedLorebookIds[0],
				injectedVars: injectedVarValues,
				characterIds: selectedCharacterIds,
			});

			setActiveInstanceId(newInstance.id);
			setActiveId(newInstance.id);
			setSelectedId(newInstance.id);
			refreshInstances();

			setSuccessMessage(`Instance "${newInstance.title}" created successfully.`);
			setViewMode("list");

			if (onSelectInstance) {
				onSelectInstance(newInstance.id);
			}
		}
		catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			setErrorMessage(msg);
		}
	}, [
		createWorldId,
		createTitle,
		createUniverseId,
		createUniverseMode,
		selectedLorebookIds,
		injectedVarValues,
		selectedCharacterIds,
		refreshInstances,
		onSelectInstance,
	]);

	const handleActivateInstance = useCallback((id: string) => {
		setActiveInstanceId(id);
		setActiveId(id);
		setSelectedId(id);

		if (onSelectInstance) {
			onSelectInstance(id);
		}
	}, [onSelectInstance]);

	const handleDeleteInstance = useCallback((id: string) => {
		const inst = instances.find(i => i.id === id);
		const confirmName = inst?.title || id;

		if (window.confirm(`Delete instance "${confirmName}"? This cannot be undone.`)) {
			deleteInstance(id);
			refreshInstances();

			const next = getAllInstances();
			if (selectedId === id) {
				setSelectedId(next[0]?.id ?? null);
			}
		}
	}, [instances, selectedId, refreshInstances]);

	// Memoized Computations

	const selectedInstance = useMemo(() => {
		return instances.find(i => i.id === selectedId);
	}, [instances, selectedId]);

	const selectedWorldfile = useMemo(() => {
		if (!selectedInstance) {
			return undefined;
		}

		return getWorldfile(selectedInstance.worldId);
	}, [selectedInstance]);

	const selectedUniverse = useMemo(() => {
		if (!selectedInstance?.universeId) {
			return undefined;
		}

		return getUniverse(selectedInstance.universeId);
	}, [selectedInstance]);

	const tabs = useMemo(() => [
		{ id: "list" as const, label: `Active Instances (${instances.length})` },
		{ id: "create" as const, label: "+ Create Instance" },
	], [instances.length]);

	return (
		<div className={styles.container}>
			<header className={styles.topBar}>
				<TabGroup<"list" | "create">
					tabs={tabs}
					activeTab={viewMode}
					onChange={(mode) => {
						if (mode === "create") {
							handleOpenCreateWizard();
						}
						else {
							setViewMode("list");
						}
					}}
				/>
			</header>

			{errorMessage && <Alert variant="error">{errorMessage}</Alert>}
			{successMessage && <Alert variant="success">{successMessage}</Alert>}

			{viewMode === "list" && (
				<div className={styles.mainLayout}>
					<InstanceList
						instances={instances}
						selectedId={selectedId}
						activeId={activeId}
						onSelectInstance={setSelectedId}
						onOpenCreateWizard={handleOpenCreateWizard}
					/>

					<InstanceDetail
						selectedInstance={selectedInstance}
						activeId={activeId}
						selectedWorldfile={selectedWorldfile}
						selectedUniverse={selectedUniverse}
						onActivateInstance={handleActivateInstance}
						onDeleteInstance={handleDeleteInstance}
						onNavigateTab={onNavigateTab}
					/>
				</div>
			)}

			{viewMode === "create" && (
				<InstanceCreateWizard
					availableWorldfiles={availableWorldfiles}
					availableUniverses={availableUniverses}
					availableCharacters={availableCharacters}
					availableLorebooks={availableLorebooks}
					createWorldId={createWorldId}
					createUniverseId={createUniverseId}
					createUniverseMode={createUniverseMode}
					selectedLorebookIds={selectedLorebookIds}
					createTitle={createTitle}
					selectedCharacterIds={selectedCharacterIds}
					injectedVarValues={injectedVarValues}
					onChangeTitle={setCreateTitle}
					onSelectWorldfile={handleSelectWorldfile}
					onChangeUniverseId={setCreateUniverseId}
					onChangeUniverseMode={setCreateUniverseMode}
					onToggleLorebookId={handleToggleLorebookId}
					onToggleCharacterId={handleToggleCharacterId}
					onVarChange={handleVarChange}
					onSubmit={handleCreateInstanceSubmit}
					onCancel={() => setViewMode("list")}
					onNavigateTab={onNavigateTab}
				/>
			)}
		</div>
	);

}

export default InstanceManagerView;
