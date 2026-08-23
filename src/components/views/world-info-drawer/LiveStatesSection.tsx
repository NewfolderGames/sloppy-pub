import { type ChangeEvent } from "react";
import { Badge } from "@/components/common/Badge.tsx";
import type { StateValue } from "@/shared/world/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface LiveStatesSectionProps {
	stateCount: number;
	searchQuery: string;
	onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
	filteredStateEntries: [string, StateValue][];
}

export function LiveStatesSection({
	stateCount,
	searchQuery,
	onSearchChange,
	filteredStateEntries,
}: Readonly<LiveStatesSectionProps>) {

	return (
		<CollapsibleSection
			title={`Live State Variables (${stateCount})`}
			badge={<Badge>{stateCount}</Badge>}
			defaultOpen={true}
		>
			<input
				type="text"
				className={styles.searchInput}
				placeholder="Search state keys or values..."
				value={searchQuery}
				onChange={onSearchChange}
			/>

			{filteredStateEntries.length > 0 && (
				<table className={styles.stateTable}>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>

					<tbody>
						{filteredStateEntries.map(([key, val]) => (
							<tr key={key}>
								<td>
									<code>{key}</code>
								</td>

								<td>
									{Array.isArray(val)
										? `[${val.join(", ")}]`
										: typeof val === "boolean"
											? (val ? "true" : "false")
											: String(val)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{filteredStateEntries.length === 0 && (
				<p className={styles.hint}>No matching state variables found.</p>
			)}
		</CollapsibleSection>
	);

}
