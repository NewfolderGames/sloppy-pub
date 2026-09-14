import { Badge } from "@/components/common/Badge.tsx";
import type { Worldfile, WorldInstance } from "@/shared/world/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface WorldMetadataSectionProps {
	worldfile?: Worldfile;
	instance: WorldInstance;
}

export function WorldMetadataSection({
	worldfile,
	instance,
}: Readonly<WorldMetadataSectionProps>) {

	const title = worldfile?.metadata.title ?? instance.title;

	const versionBadge = (
		<Badge>
			v
			{worldfile?.metadata.version ?? "1.0.0"}
		</Badge>
	);

	return (
		<CollapsibleSection
			title={title}
			badge={versionBadge}
			defaultOpen={false}
		>
			{worldfile?.metadata.description && (
				<p className={styles.metaText}>{worldfile.metadata.description}</p>
			)}

			{worldfile?.metadata.tags && worldfile.metadata.tags.length > 0 && (
				<div className={styles.badgeGroup}>
					{worldfile.metadata.tags.map(tag => (
						<Badge key={tag}>
							#
							{tag}
						</Badge>
					))}
				</div>
			)}
		</CollapsibleSection>
	);

}
