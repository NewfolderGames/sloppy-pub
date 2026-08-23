import { Badge } from "@/components/common/Badge.tsx";
import type { StoredUniversefile } from "@/shared/universe/registry.ts";
import type { WorldInstance } from "@/shared/world/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface UniverseSectionProps {
	universe: StoredUniversefile;
	instance: WorldInstance;
}

export function UniverseSection({
	universe,
	instance,
}: Readonly<UniverseSectionProps>) {

	const modeBadge = (
		<Badge
			variant={
				instance.universeMode === "synchronized"
					? "synchronized"
					: "isolated"
			}
		>
			{instance.universeMode}
		</Badge>
	);

	return (
		<CollapsibleSection
			title={universe.universe.metadata.title}
			badge={modeBadge}
			defaultOpen={true}
		>
			<p className={styles.hint}>{universe.universe.metadata.description}</p>

			{universe.universe.settings?.backgrounds && universe.universe.settings.backgrounds.length > 0 && (
				<div>
					<strong className={styles.hint}>Universal Background Story:</strong>

					<ul className={styles.list}>
						{universe.universe.settings.backgrounds.map((bg, idx) => (
							<li key={idx}>{bg}</li>
						))}
					</ul>
				</div>
			)}

			{universe.universe.settings?.rules && universe.universe.settings.rules.length > 0 && (
				<div>
					<strong className={styles.hint}>Universal Laws:</strong>

					<ul className={styles.list}>
						{universe.universe.settings.rules.map((rule, idx) => (
							<li key={idx}>{rule}</li>
						))}
					</ul>
				</div>
			)}
		</CollapsibleSection>
	);

}
