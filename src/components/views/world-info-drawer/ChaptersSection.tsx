import { Badge } from "@/components/common/Badge.tsx";
import type { Chapter } from "@/shared/world/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface ChaptersSectionProps {
	chapters?: Chapter[];
}

export function ChaptersSection({
	chapters = [],
}: Readonly<ChaptersSectionProps>) {

	return (
		<CollapsibleSection
			title={`Chapters (${chapters.length})`}
			badge={<Badge>{chapters.length}</Badge>}
			defaultOpen={true}
		>
			{chapters.length === 0 && (
				<p className={styles.hint}>No chapters recorded yet.</p>
			)}

			{chapters.length > 0 && (
				<div className={styles.cardList}>
					{chapters.map(chapter => (
						<div key={chapter.id} className={styles.itemCard}>
							<div className={styles.itemHeader}>
								<strong className={styles.itemTitle}>{chapter.title}</strong>

								<span className={styles.timestamp}>
									{new Date(chapter.createdAt).toLocaleString()}
								</span>
							</div>

							<p className={styles.itemSummary}>{chapter.summary}</p>

							{chapter.eventIds && chapter.eventIds.length > 0 && (
								<div className={styles.eventLinks}>
									<span className={styles.hint}>
										Covered events: 
										{" "}
										{chapter.eventIds.length}
									</span>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</CollapsibleSection>
	);

}
