import { Badge } from "@/components/common/Badge.tsx";
import type { LoreEntry } from "@/shared/lore/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface ActiveLoreSectionProps {
	loreEntries: LoreEntry[];
}

export function ActiveLoreSection({
	loreEntries,
}: Readonly<ActiveLoreSectionProps>) {

	return (
		<CollapsibleSection
			title={`Active Lore (${loreEntries.length})`}
			badge={<Badge>{loreEntries.length}</Badge>}
			defaultOpen={false}
		>
			{loreEntries.length === 0 && (
				<p className={styles.hint}>No active lore entries.</p>
			)}

			{loreEntries.length > 0 && (
				<div className={styles.cardList}>
					{loreEntries.map(entry => (
						<div key={entry.id} className={styles.itemCard}>
							<div className={styles.itemHeader}>
								<strong className={styles.itemTitle}>{entry.title}</strong>

								<div className={styles.badgeGroup}>
									<Badge
										variant={
											entry.activationMode === "static"
												? "synchronized"
												: "active"
										}
									>
										{entry.activationMode}
									</Badge>

									{typeof entry.priority === "number" && (
										<Badge>
											p:
											{entry.priority}
										</Badge>
									)}
								</div>
							</div>

							{entry.keywords && entry.keywords.length > 0 && (
								<div className={styles.keywordList}>
									<span className={styles.hint}>Keywords: </span>

									<code>{entry.keywords.join(", ")}</code>
								</div>
							)}

							<p className={styles.metaText}>{entry.content}</p>
						</div>
					))}
				</div>
			)}
		</CollapsibleSection>
	);

}
