import type { StoredCharacterfile } from "@/shared/character/types.ts";
import styles from "../InstanceManagerView.module.css";

interface WizardCharacterPickerProps {
	availableCharacters?: StoredCharacterfile[];
	selectedCharacterIds: string[];
	onToggleCharacterId?: (characterId: string) => void;
}

export function WizardCharacterPicker({
	availableCharacters,
	selectedCharacterIds,
	onToggleCharacterId,
}: Readonly<WizardCharacterPickerProps>) {

	return (
		<div className={`${styles.formGroup} ${styles.fullWidth}`}>
			<span className={styles.label}>Select Characters (Optional)</span>

			<p className={styles.hint}>
				Selected characters will generate dynamic character instances in this session.
			</p>

			{availableCharacters && availableCharacters.length > 0
				? (
						<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
							{availableCharacters.map((char) => {
								const isSelected = selectedCharacterIds.includes(char.id);

								return (
									<label
										key={char.id}
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
											onChange={() => onToggleCharacterId?.(char.id)}
											style={{ marginTop: "3px" }}
										/>

										<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
											<strong>
												{char.characterfile.metadata.title || char.characterfile.metadata.name}
											</strong>

											<span className={styles.hint}>
												{char.characterfile.metadata.name}
												{" • "}
												{char.characterfile.physical_characteristics.length}
												{" physical • "}
												{char.characterfile.linguistic_patterns.length}
												{" linguistic"}
											</span>

											{char.characterfile.summary && (
												<p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#555" }}>
													{char.characterfile.summary}
												</p>
											)}
										</div>
									</label>
								);
							})}
						</div>
					)
				: (
						<p className={styles.hint}>No character files found in registry.</p>
					)}
		</div>
	);

}
