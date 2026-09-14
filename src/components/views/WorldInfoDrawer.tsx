import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { getCharacterfile } from "@/shared/character/registry.ts";
import type { Characterfile } from "@/shared/character/types.ts";
import { getMatchingLoreEntries } from "@/shared/lore/builder.ts";
import { getUniverse } from "@/shared/universe/registry.ts";
import { synthesizeInstancePrompt } from "@/shared/world/instance_manager.ts";
import { getWorldfile } from "@/shared/world/registry.ts";
import type { WorldInstance, WorldStates } from "@/shared/world/types.ts";
import { ActiveLoreSection } from "./world-info-drawer/ActiveLoreSection.tsx";
import { ChaptersSection } from "./world-info-drawer/ChaptersSection.tsx";
import { CharactersSection } from "./world-info-drawer/CharactersSection.tsx";
import { EventLogsSection } from "./world-info-drawer/EventLogsSection.tsx";
import { FullWorldPromptSection } from "./world-info-drawer/FullWorldPromptSection.tsx";
import { LiveStatesSection } from "./world-info-drawer/LiveStatesSection.tsx";
import { RuntimeVariablesSection } from "./world-info-drawer/RuntimeVariablesSection.tsx";
import { UniverseSection } from "./world-info-drawer/UniverseSection.tsx";
import { WorldMetadataSection } from "./world-info-drawer/WorldMetadataSection.tsx";
import styles from "./WorldInfoDrawer.module.css";

interface WorldInfoDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	instance?: WorldInstance;
	activeStates?: WorldStates;
	latestUserMessage?: string;
}

export function WorldInfoDrawer({
	isOpen,
	onClose,
	instance,
	activeStates,
	latestUserMessage,
}: Readonly<WorldInfoDrawerProps>) {

	const [searchQuery, setSearchQuery] = useState("");

	const worldRecord = useMemo(() => {
		if (!instance) {
			return undefined;
		}

		return getWorldfile(instance.worldId);
	}, [instance]);

	const worldfile = worldRecord?.worldfile;

	const universe = useMemo(() => {
		if (!instance?.universeId) {
			return undefined;
		}

		return getUniverse(instance.universeId);
	}, [instance]);

	const characters = useMemo(() => {
		if (!instance?.characterIds || instance.characterIds.length === 0) {
			return [];
		}

		return instance.characterIds
			.map(id => getCharacterfile(id)?.characterfile)
			.filter((c): c is Characterfile => c !== undefined);
	}, [instance]);

	const characterInstances = useMemo(() => {
		return instance?.characterInstances ?? [];
	}, [instance]);

	const effectiveLorebookIds = useMemo(() => {
		if (!instance) {
			return [];
		}

		if (instance.lorebookIds && instance.lorebookIds.length > 0) {
			return instance.lorebookIds;
		}

		if (instance.lorebookId) {
			return [instance.lorebookId];
		}

		return [];
	}, [instance]);

	const activeLoreEntries = useMemo(() => {
		if (effectiveLorebookIds.length === 0) {
			return [];
		}

		return getMatchingLoreEntries(effectiveLorebookIds, latestUserMessage);
	}, [effectiveLorebookIds, latestUserMessage]);

	const fullWorldPrompt = useMemo(() => {
		if (!instance) {
			return "";
		}

		if (instance.worldPrompt && instance.worldPrompt.trim().length > 0) {
			return instance.worldPrompt;
		}

		if (worldfile) {
			return synthesizeInstancePrompt(
				worldfile,
				instance.injectedVars ?? {},
				universe?.universe,
				effectiveLorebookIds.length > 0 ? effectiveLorebookIds : instance.lorebookId,
			);
		}

		return "";
	}, [instance, worldfile, universe, effectiveLorebookIds]);

	const displayStates = useMemo(() => {
		return activeStates ?? instance?.activeStates ?? {};
	}, [activeStates, instance?.activeStates]);

	const stateCount = Object.keys(displayStates).length;

	const filteredStateEntries = useMemo(() => {
		const entries = Object.entries(displayStates);

		if (!searchQuery.trim()) {
			return entries.sort(([a], [b]) => a.localeCompare(b));
		}

		const q = searchQuery.toLowerCase();

		return entries
			.filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q))
			.sort(([a], [b]) => a.localeCompare(b));
	}, [displayStates, searchQuery]);

	const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setSearchQuery(e.target.value);
	}, []);

	if (!isOpen) {
		return null;
	}

	return (
		<div className={styles.drawerOverlay} onClick={onClose} role="dialog" aria-modal="true">
			<aside className={styles.drawer} onClick={e => e.stopPropagation()}>
				<header className={styles.drawerHeader}>
					<h2 className={styles.drawerTitle}>World & Universe Info</h2>

					<button
						type="button"
						className={styles.closeButton}
						onClick={onClose}
						aria-label="Close drawer"
					>
						✕
					</button>
				</header>

				<div className={styles.drawerContent}>
					{instance && (
						<>
							<WorldMetadataSection
								worldfile={worldfile}
								instance={instance}
							/>

							<FullWorldPromptSection
								worldPrompt={fullWorldPrompt}
							/>

							{universe && (
								<UniverseSection
									universe={universe}
									instance={instance}
								/>
							)}

							<CharactersSection
								characters={characters}
								characterInstances={characterInstances}
							/>

							<ActiveLoreSection
								loreEntries={activeLoreEntries}
							/>

							<EventLogsSection
								events={instance.events}
							/>

							<ChaptersSection
								chapters={instance.chapters}
							/>

							<RuntimeVariablesSection
								injectedVars={instance.injectedVars}
							/>

							<LiveStatesSection
								stateCount={stateCount}
								searchQuery={searchQuery}
								onSearchChange={handleSearchChange}
								filteredStateEntries={filteredStateEntries}
								blueprints={instance.blueprints}
								displayStates={displayStates}
							/>
						</>
					)}

					{!instance && (
						<p className={styles.hint}>No active instance selected.</p>
					)}
				</div>
			</aside>
		</div>
	);

}

export default WorldInfoDrawer;
