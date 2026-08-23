import type { ChangeEvent } from "react";
import type { VariableDefinition, Worldfile } from "@/shared/world/types.ts";
import styles from "../InstanceManagerView.module.css";

interface WizardVariablesFormProps {
	activeWorldfile: Worldfile;
	injectedVarValues: Record<string, string | number | boolean>;
	onVarChange: (name: string, type: VariableDefinition["type"], rawVal: unknown) => void;
}

export function WizardVariablesForm({
	activeWorldfile,
	injectedVarValues,
	onVarChange,
}: Readonly<WizardVariablesFormProps>) {

	if (!activeWorldfile.vars || activeWorldfile.vars.length === 0) {
		return null;
	}

	return (
		<div className={styles.card}>
			<h3 className={styles.label}>Runtime Variables ([[vars]])</h3>

			<p className={styles.hint}>Configure session-specific parameters for this instance.</p>

			<div className={styles.formGrid}>
				{activeWorldfile.vars.map((v) => {
					const currVal = injectedVarValues[v.name] ?? v.default ?? "";

					if (v.type === "boolean") {
						return (
							<div key={v.name} className={styles.formGroup}>
								<label className={styles.checkboxLabel}>
									<input
										type="checkbox"
										checked={Boolean(currVal)}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											onVarChange(v.name, "boolean", e.target.checked)}
									/>

									<span>
										{v.name} 
										{" "}
										{v.description ? `(${v.description})` : ""}
									</span>
								</label>
							</div>
						);
					}

					if (v.type === "select" || v.type === "radio" || v.type === "checkbox") {
						return (
							<div key={v.name} className={styles.formGroup}>
								<label className={styles.label} htmlFor={`var-${v.name}`}>{v.name}</label>

								<select
									id={`var-${v.name}`}
									className={styles.select}
									value={String(currVal)}
									onChange={(e: ChangeEvent<HTMLSelectElement>) =>
										onVarChange(v.name, v.type, e.target.value)}
								>
									{(v.values || []).map(opt => (
										<option key={opt} value={opt}>
											{opt}
										</option>
									))}
								</select>

								{v.description && <p className={styles.hint}>{v.description}</p>}
							</div>
						);
					}

					return (
						<div key={v.name} className={styles.formGroup}>
							<label className={styles.label} htmlFor={`var-${v.name}`}>{v.name}</label>

							<input
								id={`var-${v.name}`}
								type={v.type === "number" ? "number" : "text"}
								className={styles.input}
								value={String(currVal)}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									onVarChange(v.name, v.type, e.target.value)}
								placeholder={`Default: ${v.default ?? ""}`}
							/>

							{v.description && <p className={styles.hint}>{v.description}</p>}
						</div>
					);
				})}
			</div>
		</div>
	);

}
