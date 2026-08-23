import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { CharacterBackground } from "@/shared/character/types.ts";
import styles from "../CharacterManagerView.module.css";

interface BackgroundsSectionProps {
	backgrounds: CharacterBackground[];
	onAdd: () => void;
	onUpdate: (index: number, patch: Partial<CharacterBackground>) => void;
	onRemove: (index: number) => void;
	characterContext?: Record<string, unknown>;
}

export function BackgroundsSection({
	backgrounds,
	onAdd,
	onUpdate,
	onRemove,
}: Readonly<BackgroundsSectionProps>) {

	return (
		<div className={styles.section}>
			<h4 className={styles.sectionTitle}>9. Backgrounds</h4>

			<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
				{backgrounds.map((bg, idx) => (
					<div key={idx} className={styles.dialogItem}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
							<input
								type="text"
								className={styles.input}
								style={{ maxWidth: "250px" }}
								placeholder="Topic / Title (e.g. Origin, Military Career)"
								value={bg.name}
								onChange={e => onUpdate(idx, { name: e.target.value })}
							/>

							<button
								type="button"
								className={styles.removeButton}
								onClick={() => onRemove(idx)}
								title="Remove background"
							>
								✕
							</button>
						</div>

						<textarea
							className={styles.textarea}
							rows={3}
							placeholder="Detailed background history, narrative context, and character lore..."
							value={bg.content}
							onChange={e => onUpdate(idx, { content: e.target.value })}
						/>

						<FeelingLuckyControl
							checked={Boolean(bg.feelingLucky)}
							onChange={checked => onUpdate(idx, { feelingLucky: checked })}
						/>
					</div>
				))}
			</div>

			<button
				type="button"
				className={styles.addButton}
				onClick={onAdd}
			>
				+ Add Background
			</button>
		</div>
	);

}
