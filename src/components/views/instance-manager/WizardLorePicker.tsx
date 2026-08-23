import type { StoredLoreBook } from "@/shared/lore/types.ts";
import styles from "../InstanceManagerView.module.css";

interface WizardLorePickerProps {
	availableLorebooks?: StoredLoreBook[];
	selectedLorebookIds: string[];
	onToggleLorebookId?: (lorebookId: string) => void;
}

export function WizardLorePicker({
	availableLorebooks,
	selectedLorebookIds,
	onToggleLorebookId,
}: Readonly<WizardLorePickerProps>) {

	return (
		<div className={`${styles.formGroup} ${styles.fullWidth}`}>
			<span className={styles.label}>Attach Lore Books (Optional)</span>

			<p className={styles.hint}>
				Select one or more lore books to inject static and dynamic world lore into this session.
			</p>

			{availableLorebooks && availableLorebooks.length > 0
				? (
						<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
							{availableLorebooks.map((lb) => {
								const isSelected = selectedLorebookIds.includes(lb.id);

								return (
									<label
										key={lb.id}
										className={styles.checkboxLabel}
										style={{
											padding: "8px 12px",
											border: "1px solid #ccc",
											backgroundColor: isSelected ? "#eef4ff" : "#fafafa",
											cursor: "pointer",
											display: "flex",
											alignItems: "flex-start",
											gap: "10px",
										}}
									>
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() => onToggleLorebookId?.(lb.id)}
											style={{ marginTop: "3px" }}
										/>

										<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
											<strong>{lb.lorebook.name}</strong>

											<span className={styles.hint}>
												ID: 
												{" "}
												{lb.id}
												{" "}
												• 
												{" "}
												{lb.lorebook.entries.length}
												{" "}
												entries (
												{lb.lorebook.entries.filter(e => e.activationMode === "static").length}
												{" "}
												static,
												{lb.lorebook.entries.filter(e => e.activationMode === "dynamic").length}
												{" "}
												dynamic)
											</span>
										</div>
									</label>
								);
							})}
						</div>
					)
				: (
						<p className={styles.hint}>No lore books found in registry.</p>
					)}
		</div>
	);

}
