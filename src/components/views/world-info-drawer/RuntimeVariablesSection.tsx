import { Badge } from "@/components/common/Badge.tsx";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface RuntimeVariablesSectionProps {
	injectedVars?: Record<string, string | number | boolean>;
}

export function RuntimeVariablesSection({
	injectedVars,
}: Readonly<RuntimeVariablesSectionProps>) {

	if (!injectedVars || Object.keys(injectedVars).length === 0) {
		return null;
	}

	const entries = Object.entries(injectedVars);

	return (
		<CollapsibleSection
			title={`Runtime Variables (${entries.length})`}
			badge={<Badge>{entries.length}</Badge>}
			defaultOpen={false}
		>
			<div className={styles.grid}>
				{entries.map(([key, val]) => (
					<div key={key} className={styles.varCard}>
						<span className={styles.varName}>{key}</span>
						<span className={styles.varValue}>{String(val)}</span>
					</div>
				))}
			</div>
		</CollapsibleSection>
	);

}
