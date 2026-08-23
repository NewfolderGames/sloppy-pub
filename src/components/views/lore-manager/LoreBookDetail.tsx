import type { LoreBook, LoreEntry } from "@/shared/lore/types.ts";
import styles from "../LoreManagerView.module.css";

interface LoreBookDetailProps {
	selectedBook: LoreBook;
	entryCount: number;
	staticCount: number;
	dynamicCount: number;
	onRename: () => void;
	onSave: () => void;
	onToggleRaw: () => void;
	onExport: () => void;
	onDelete: () => void;
	onAddEntry: () => void;
	onEditEntry: (entry: LoreEntry) => void;
	onRemoveEntry: (id: string) => void;
}

export function LoreBookDetail({
	selectedBook,
	entryCount,
	staticCount,
	dynamicCount,
	onRename,
	onSave,
	onToggleRaw,
	onExport,
	onDelete,
	onAddEntry,
	onEditEntry,
	onRemoveEntry,
}: Readonly<LoreBookDetailProps>) {

	return (
		<>
			<div className={styles.contentHeader}>
				<div>
					<h3 className={styles.sectionTitle}>{selectedBook.name}</h3>

					<p className={styles.cardSubtitle}>
						{entryCount}
						{" "}
						entries (
						{staticCount}
						{" "}
						static,
						{dynamicCount}
						{" "}
						dynamic)
					</p>
				</div>

				<div className={styles.headerActions}>
					<button
						type="button"
						className={styles.button}
						onClick={onRename}
					>
						Rename
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={onSave}
					>
						Save
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={onToggleRaw}
					>
						Raw TOML
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={onExport}
					>
						Export
					</button>

					<button
						type="button"
						className={`${styles.button} ${styles.dangerButton}`}
						onClick={onDelete}
					>
						Delete
					</button>
				</div>
			</div>

			<div className={styles.section}>
				<div className={styles.sidebarHeader}>
					<h4 className={styles.sectionTitle}>Entries</h4>

					<button
						type="button"
						className={styles.addButton}
						onClick={onAddEntry}
					>
						+ Add Entry
					</button>
				</div>

				{selectedBook.entries.length === 0 && (
					<p className={styles.emptyState}>
						No entries yet. Add a lore entry to start building your lore.
					</p>
				)}

				{selectedBook.entries.map((entry) => {
					return (
						<div key={entry.id} className={styles.entryCard}>
							<div className={styles.entryHeader}>
								<div>
									<p className={styles.entryTitle}>{entry.title}</p>

									<div className={styles.entryMeta}>
										<span>{entry.activationMode}</span>

										{entry.priority !== undefined && (
											<span>
												Priority:
												{entry.priority}
											</span>
										)}

										<span>{entry.enabled ? "Enabled" : "Disabled"}</span>
									</div>
								</div>

								<div className={styles.headerActions}>
									<button
										type="button"
										className={styles.button}
										onClick={() => onEditEntry(entry)}
									>
										Edit
									</button>

									<button
										type="button"
										className={styles.removeButton}
										onClick={() => onRemoveEntry(entry.id)}
									>
										Remove
									</button>
								</div>
							</div>

							{entry.keywords.length > 0 && (
								<div className={styles.keywordList}>
									{entry.keywords.map(kw => (
										<span key={kw} className={styles.keywordTag}>{kw}</span>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</>
	);

}
