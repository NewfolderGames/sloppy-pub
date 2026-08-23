import type { ArgumentType, VariableDefinition } from "@/shared/world/types.ts";
import styles from "../WorldManagerView.module.css";

interface VariablesSectionProps {
	varsList: VariableDefinition[];
	onAddVar: () => void;
	onUpdateVar: (idx: number, patch: Partial<VariableDefinition>) => void;
	onRemoveVar: (idx: number) => void;
}

export function VariablesSection({
	varsList,
	onAddVar,
	onUpdateVar,
	onRemoveVar,
}: Readonly<VariablesSectionProps>) {

	return (
		<div className={styles.section}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<h4 className={styles.sectionTitle}>3. Runtime Variables</h4>

				<button
					type="button"
					className={styles.button}
					onClick={onAddVar}
				>
					+ Add Var
				</button>
			</div>

			<div className={styles.cardList}>
				{varsList.map((vr, idx) => (
					<div key={idx} className={styles.defCard}>
						<div className={styles.defCardHeader}>
							<strong>
								Var #
								{idx + 1}
								:
								{vr.name}
							</strong>

							<button
								type="button"
								className={`${styles.button} ${styles.dangerButton}`}
								onClick={() => onRemoveVar(idx)}
							>
								Remove
							</button>
						</div>

						<div className={styles.formGrid}>
							<div className={styles.formGroup}>
								<label className={styles.label}>Var Name</label>

								<input
									className={styles.input}
									value={vr.name}
									onChange={e => onUpdateVar(idx, { name: e.target.value })}
									placeholder="VAR_NAME"
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Type</label>

								<select
									className={styles.input}
									value={vr.type}
									onChange={e => onUpdateVar(idx, { type: e.target.value as ArgumentType })}
								>
									<option value="text">text</option>
									<option value="number">number</option>
									<option value="boolean">boolean</option>
									<option value="select">select</option>
									<option value="radio">radio</option>
									<option value="checkbox">checkbox</option>
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Default Value</label>

								<input
									className={styles.input}
									value={String(vr.default ?? "")}
									onChange={e => onUpdateVar(idx, { default: e.target.value })}
									placeholder="Default..."
								/>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);

}
