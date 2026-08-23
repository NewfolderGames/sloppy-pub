import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { ExampleDialog } from "@/shared/character/types.ts";
import styles from "../CharacterManagerView.module.css";

interface ExampleDialogsSectionProps {
	exampleDialogs: ExampleDialog[];
	onAdd: () => void;
	onUpdate: (index: number, patch: Partial<ExampleDialog>) => void;
	onRemove: (index: number) => void;
	characterContext?: Record<string, unknown>;
}

export function ExampleDialogsSection({
	exampleDialogs,
	onAdd,
	onUpdate,
	onRemove,
}: Readonly<ExampleDialogsSectionProps>) {

	return (
		<div className={styles.section}>
			<h4 className={styles.sectionTitle}>10. Example Dialogs</h4>

			<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
				{exampleDialogs.map((dialogItem, idx) => (
					<div key={idx} className={styles.dialogItem}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
							<input
								type="text"
								className={styles.input}
								style={{ maxWidth: "250px" }}
								placeholder="Context / Scene (e.g. In Combat)"
								value={dialogItem.name}
								onChange={e => onUpdate(idx, { name: e.target.value })}
							/>

							<button
								type="button"
								className={styles.removeButton}
								onClick={() => onRemove(idx)}
								title="Remove dialog"
							>
								✕
							</button>
						</div>

						<textarea
							className={styles.textarea}
							rows={2}
							placeholder="Sample spoken dialog quote..."
							value={dialogItem.dialog}
							onChange={e => onUpdate(idx, { dialog: e.target.value })}
						/>

						<FeelingLuckyControl
							checked={Boolean(dialogItem.feelingLucky)}
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
				+ Add Example Dialog
			</button>
		</div>
	);

}
