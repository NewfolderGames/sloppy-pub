import type { FormEvent } from "react";
import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { ActivationMode, LoreEntry } from "@/shared/lore/types.ts";
import styles from "../LoreManagerView.module.css";

interface LoreEntryEditorProps {
	entry: LoreEntry;
	keywordsText: string;
	onChangeEntry: (updater: (prev: LoreEntry) => LoreEntry) => void;
	onChangeKeywordsText: (value: string) => void;
	onSave: (e: FormEvent) => void;
	onCancel: () => void;
}

export function LoreEntryEditor({
	entry,
	keywordsText,
	onChangeEntry,
	onChangeKeywordsText,
	onSave,
	onCancel,
}: Readonly<LoreEntryEditorProps>) {

	return (
		<div className={styles.section}>
			<h4 className={styles.sectionTitle}>Edit Entry</h4>

			<form onSubmit={onSave} style={{ display: "contents" }}>
				<div className={styles.row}>
					<label className={styles.label} style={{ minWidth: "80px" }}>Title</label>

					<input
						className={styles.input}
						value={entry.title}
						onChange={e => onChangeEntry(prev => ({ ...prev, title: e.target.value }))}
						required
					/>
				</div>

				<div className={styles.row}>
					<span style={{ minWidth: "80px" }} />

					<FeelingLuckyControl
						checked={Boolean(entry.feelingLucky?.title)}
						onChange={checked =>
							onChangeEntry(prev => ({
								...prev,
								feelingLucky: {
									...prev.feelingLucky,
									title: checked,
								},
							}))}
					/>
				</div>

				<div className={styles.row} style={{ alignItems: "flex-start" }}>
					<label className={styles.label} style={{ minWidth: "80px", paddingTop: "8px" }}>Content</label>

					<textarea
						className={styles.textarea}
						rows={5}
						value={entry.content}
						onChange={e => onChangeEntry(prev => ({ ...prev, content: e.target.value }))}
						required
					/>
				</div>

				<div className={styles.row}>
					<span style={{ minWidth: "80px" }} />

					<FeelingLuckyControl
						checked={Boolean(entry.feelingLucky?.content)}
						onChange={checked =>
							onChangeEntry(prev => ({
								...prev,
								feelingLucky: {
									...prev.feelingLucky,
									content: checked,
								},
							}))}
					/>
				</div>

				<div className={styles.row}>
					<label className={styles.label} style={{ minWidth: "80px" }}>Keywords</label>

					<input
						className={styles.input}
						placeholder="Comma-separated keywords..."
						value={keywordsText}
						onChange={e => onChangeKeywordsText(e.target.value)}
					/>
				</div>

				<div className={styles.row}>
					<span style={{ minWidth: "80px" }} />

					<FeelingLuckyControl
						checked={Boolean(entry.feelingLucky?.keywords)}
						onChange={checked =>
							onChangeEntry(prev => ({
								...prev,
								feelingLucky: {
									...prev.feelingLucky,
									keywords: checked,
								},
							}))}
					/>
				</div>

				<div className={styles.row}>
					<label className={styles.label} style={{ minWidth: "80px" }}>Mode</label>

					<select
						className={styles.select}
						value={entry.activationMode}
						onChange={e => onChangeEntry(prev => ({ ...prev, activationMode: e.target.value as ActivationMode }))}
					>
						<option value="static">Static (always active)</option>
						<option value="dynamic">Dynamic (keyword match)</option>
					</select>
				</div>

				<div className={styles.row}>
					<label className={styles.label} style={{ minWidth: "80px" }}>Priority</label>

					<input
						className={styles.input}
						type="number"
						style={{ width: "100px" }}
						value={entry.priority ?? ""}
						placeholder="0"
						onChange={e => onChangeEntry(prev => ({
							...prev,
							priority: e.target.value === "" ? undefined : Number(e.target.value),
						}))}
					/>
				</div>

				<div className={styles.row}>
					<label className={styles.label} style={{ minWidth: "80px" }}>Enabled</label>

					<input
						type="checkbox"
						className={styles.checkbox}
						checked={entry.enabled}
						onChange={e => onChangeEntry(prev => ({ ...prev, enabled: e.target.checked }))}
					/>
				</div>

				<div className={styles.row}>
					<button
						type="submit"
						className={`${styles.button} ${styles.primaryButton}`}
					>
						Save Entry
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={onCancel}
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);

}
