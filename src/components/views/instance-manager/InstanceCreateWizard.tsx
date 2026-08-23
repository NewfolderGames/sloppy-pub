import type { ChangeEvent, FormEvent } from "react";
import type { StoredCharacterfile } from "@/shared/character/types.ts";
import type { StoredLoreBook } from "@/shared/lore/types.ts";
import type { StoredUniversefile } from "@/shared/universe/registry.ts";
import type { StoredWorldfile } from "@/shared/world/registry.ts";
import type { VariableDefinition } from "@/shared/world/types.ts";
import { WizardCharacterPicker } from "./WizardCharacterPicker.tsx";
import { WizardLorePicker } from "./WizardLorePicker.tsx";
import { WizardVariablesForm } from "./WizardVariablesForm.tsx";
import styles from "../InstanceManagerView.module.css";

export interface InstanceCreateWizardProps {
	availableWorldfiles: StoredWorldfile[];
	availableUniverses: StoredUniversefile[];
	availableCharacters?: StoredCharacterfile[];
	availableLorebooks?: StoredLoreBook[];
	createWorldId: string;
	createUniverseId: string;
	createUniverseMode: "isolated" | "synchronized";
	selectedLorebookIds?: string[];
	createTitle: string;
	selectedCharacterIds?: string[];
	injectedVarValues: Record<string, string | number | boolean>;
	onChangeTitle: (title: string) => void;
	onSelectWorldfile: (worldId: string) => void;
	onChangeUniverseId: (universeId: string) => void;
	onChangeUniverseMode: (mode: "isolated" | "synchronized") => void;
	onToggleLorebookId?: (lorebookId: string) => void;
	onToggleCharacterId?: (characterId: string) => void;
	onVarChange: (name: string, type: VariableDefinition["type"], rawVal: unknown) => void;
	onSubmit: (e: FormEvent) => void;
	onCancel: () => void;
	onNavigateTab?: (tab: "chat" | "world-manager") => void;
}

export function InstanceCreateWizard(props: Readonly<InstanceCreateWizardProps>) {

	const {
		availableWorldfiles,
		availableUniverses,
		availableCharacters,
		availableLorebooks,
		createWorldId,
		createUniverseId,
		createUniverseMode,
		selectedLorebookIds = [],
		createTitle,
		selectedCharacterIds = [],
		injectedVarValues,
		onChangeTitle,
		onSelectWorldfile,
		onChangeUniverseId,
		onChangeUniverseMode,
		onToggleLorebookId,
		onToggleCharacterId,
		onVarChange,
		onSubmit,
		onCancel,
		onNavigateTab,
	} = props;

	const activeWorldfileRecord = availableWorldfiles.find(wf => wf.id === createWorldId);
	const activeWorldfile = activeWorldfileRecord?.worldfile;

	return (
		<form onSubmit={onSubmit} className={styles.card}>
			<h2 className={styles.sectionTitle}>Create New World Instance</h2>

			<div className={styles.formGrid}>
				<div className={`${styles.formGroup} ${styles.fullWidth}`}>
					<label className={styles.label} htmlFor="inst-title">Instance Session Title</label>

					<input
						id="inst-title"
						type="text"
						className={styles.input}
						value={createTitle}
						onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeTitle(e.target.value)}
						placeholder="Session title..."
						required
					/>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label} htmlFor="inst-world">Select Worldfile</label>

					{availableWorldfiles.length > 0
						? (
								<select
									id="inst-world"
									className={styles.select}
									value={createWorldId}
									onChange={(e: ChangeEvent<HTMLSelectElement>) => onSelectWorldfile(e.target.value)}
									required
								>
									{availableWorldfiles.map(wf => (
										<option key={wf.id} value={wf.id}>
											{wf.worldfile.metadata.title}
											{" "}
											(
											{wf.id}
											)
										</option>
									))}
								</select>
							)
						: (
								<div>
									<p className={styles.hint}>No Worldfiles available.</p>

									<button
										type="button"
										className={styles.secondaryButton}
										onClick={() => onNavigateTab?.("world-manager")}
									>
										Go to World Manager to Create a Worldfile
									</button>
								</div>
							)}
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label} htmlFor="inst-universe">Attach Universe (Optional)</label>

					<select
						id="inst-universe"
						className={styles.select}
						value={createUniverseId}
						onChange={(e: ChangeEvent<HTMLSelectElement>) => onChangeUniverseId(e.target.value)}
					>
						<option value="">None (Standalone Instance)</option>
						{availableUniverses.map(u => (
							<option key={u.id} value={u.id}>
								{u.universe.metadata.title}
								{" "}
								(
								{u.id}
								)
							</option>
						))}
					</select>
				</div>

				<WizardLorePicker
					availableLorebooks={availableLorebooks}
					selectedLorebookIds={selectedLorebookIds}
					onToggleLorebookId={onToggleLorebookId}
				/>

				{createUniverseId && (
					<div className={`${styles.formGroup} ${styles.fullWidth}`}>
						<span className={styles.label}>Universe Synchronization Mode</span>

						<div className={styles.radioGroup}>
							<label className={styles.radioOption}>
								<input
									type="radio"
									name="universeMode"
									value="synchronized"
									checked={createUniverseMode === "synchronized"}
									onChange={() => onChangeUniverseMode("synchronized")}
								/>

								<div>
									<strong>Synchronized (Live Shared State)</strong>
									<p className={styles.hint}>
										Mutations to universe state propagate live across all connected sessions.
									</p>
								</div>
							</label>

							<label className={styles.radioOption}>
								<input
									type="radio"
									name="universeMode"
									value="isolated"
									checked={createUniverseMode === "isolated"}
									onChange={() => onChangeUniverseMode("isolated")}
								/>

								<div>
									<strong>Isolated (Snapshot Copy)</strong>
									<p className={styles.hint}>
										Takes a static clone of universe initial states without receiving remote updates.
									</p>
								</div>
							</label>
						</div>
					</div>
				)}

				<WizardCharacterPicker
					availableCharacters={availableCharacters}
					selectedCharacterIds={selectedCharacterIds}
					onToggleCharacterId={onToggleCharacterId}
				/>
			</div>

			{activeWorldfile && (
				<WizardVariablesForm
					activeWorldfile={activeWorldfile}
					injectedVarValues={injectedVarValues}
					onVarChange={onVarChange}
				/>
			)}

			<div className={styles.actions}>
				<button
					type="submit"
					className={styles.primaryButton}
					disabled={!createWorldId}
				>
					Create Instance
				</button>

				<button
					type="button"
					className={styles.secondaryButton}
					onClick={onCancel}
				>
					Cancel
				</button>
			</div>
		</form>
	);

}
