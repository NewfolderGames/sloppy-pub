import React from "react";
import type { StateRow } from "./state_helpers.ts";
import styles from "./StateVariableTable.module.css";

export interface StateVariableTableProps {
	rows: StateRow[];
	onAddRow: () => void;
	onUpdateRow: (idx: number, patch: Partial<StateRow>) => void;
	onRemoveRow: (idx: number) => void;
	title?: string;
	addButtonLabel?: string;
	keyPlaceholder?: string;
}

export const StateVariableTable: React.FC<StateVariableTableProps> = ({
	rows,
	onAddRow,
	onUpdateRow,
	onRemoveRow,
	title,
	addButtonLabel = "+ Add State Key",
	keyPlaceholder = "state.key_name",
}) => {
	return (
		<div className={styles.container}>
			<div className={styles.header}>
				{title && <h4 className={styles.title}>{title}</h4>}
				<button type="button" className={styles.button} onClick={onAddRow}>
					{addButtonLabel}
				</button>
			</div>

			<div className={styles.tableWrapper}>
				<table className={styles.dataTable}>
					<thead>
						<tr>
							<th>State Key (dot-notation)</th>
							<th>Type</th>
							<th>Initial Value</th>
							<th>Action</th>
						</tr>
					</thead>

					<tbody>
						{rows.map((row, index) => (
							<tr key={index}>
								<td>
									<input
										className={styles.input}
										value={row.key}
										onChange={e => onUpdateRow(index, { key: e.target.value })}
										placeholder={keyPlaceholder}
									/>
								</td>

								<td>
									<select
										className={styles.input}
										value={row.type}
										onChange={e => onUpdateRow(index, { type: e.target.value as StateRow["type"] })}
									>
										<option value="string">string</option>
										<option value="number">number</option>
										<option value="boolean">boolean</option>
										<option value="array">array</option>
									</select>
								</td>

								<td>
									<input
										className={styles.input}
										value={row.value}
										onChange={e => onUpdateRow(index, { value: e.target.value })}
										placeholder="Value..."
									/>
								</td>

								<td>
									<button
										type="button"
										className={styles.dangerButton}
										onClick={() => onRemoveRow(index)}
									>
										Remove
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
