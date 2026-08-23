import type { ArgumentDefinition, ArgumentType } from "@/shared/world/types.ts";
import styles from "../WorldManagerView.module.css";

interface ArgumentsSectionProps {
	argsList: ArgumentDefinition[];
	onAddArg: () => void;
	onUpdateArg: (idx: number, patch: Partial<ArgumentDefinition>) => void;
	onRemoveArg: (idx: number) => void;
}

export function ArgumentsSection({
	argsList,
	onAddArg,
	onUpdateArg,
	onRemoveArg,
}: Readonly<ArgumentsSectionProps>) {

	return (
		<div className={styles.section}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<h4 className={styles.sectionTitle}>2. Compile-Time Arguments</h4>

				<button
					type="button"
					className={styles.button}
					onClick={onAddArg}
				>
					+ Add Arg
				</button>
			</div>

			<div className={styles.cardList}>
				{argsList.map((arg, idx) => (
					<div key={idx} className={styles.defCard}>
						<div className={styles.defCardHeader}>
							<strong>
								Arg #
								{idx + 1}
								:
								{arg.name}
							</strong>

							<button
								type="button"
								className={`${styles.button} ${styles.dangerButton}`}
								onClick={() => onRemoveArg(idx)}
							>
								Remove
							</button>
						</div>

						<div className={styles.formGrid}>
							<div className={styles.formGroup}>
								<label className={styles.label}>Arg Name</label>

								<input
									className={styles.input}
									value={arg.name}
									onChange={e => onUpdateArg(idx, { name: e.target.value })}
									placeholder="ARG_NAME"
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Type</label>

								<select
									className={styles.input}
									value={arg.type}
									onChange={e => onUpdateArg(idx, { type: e.target.value as ArgumentType })}
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
									value={String(arg.default ?? "")}
									onChange={e => onUpdateArg(idx, { default: e.target.value })}
									placeholder="Default..."
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Allowed Values (comma separated)</label>

								<input
									className={styles.input}
									value={(arg.values || []).join(", ")}
									onChange={e => onUpdateArg(idx, {
										values: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
									})}
									placeholder="option1, option2"
								/>
							</div>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.label}>Description</label>

							<input
								className={styles.input}
								value={arg.description || ""}
								onChange={e => onUpdateArg(idx, { description: e.target.value })}
								placeholder="Argument purpose..."
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);

}
