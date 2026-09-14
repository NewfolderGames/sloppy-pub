import { Badge } from "@/components/common/Badge.tsx";
import type { SessionEvent } from "@/shared/world/types.ts";
import { CollapsibleSection } from "./CollapsibleSection.tsx";
import styles from "../WorldInfoDrawer.module.css";

interface EventLogsSectionProps {
	events?: SessionEvent[];
}

export function EventLogsSection({
	events = [],
}: Readonly<EventLogsSectionProps>) {

	return (
		<CollapsibleSection
			title={`Event Logs (${events.length})`}
			badge={<Badge>{events.length}</Badge>}
			defaultOpen={false}
		>
			{events.length === 0 && (
				<p className={styles.hint}>No event logs recorded yet.</p>
			)}

			{events.length > 0 && (
				<div className={styles.cardList}>
					{events.map(event => (
						<div key={event.id} className={styles.itemCard}>
							<div className={styles.itemHeader}>
								<Badge
									variant={
										event.type === "narrative"
											? "synchronized"
											: event.type === "character"
												? "active"
												: undefined
									}
								>
									{event.type}
								</Badge>

								<span className={styles.timestamp}>
									{new Date(event.timestamp).toLocaleString()}
								</span>
							</div>

							<p className={styles.itemSummary}>{event.summary}</p>

							{event.details && (
								<p className={styles.itemDetails}>{event.details}</p>
							)}
						</div>
					))}
				</div>
			)}
		</CollapsibleSection>
	);

}
