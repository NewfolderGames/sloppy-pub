import { Badge } from "@/components/common/Badge.tsx";
import { EmptyState } from "@/components/common/EmptyState.tsx";
import { getWorldfile } from "@/shared/world/registry.ts";
import type { WorldInstance } from "@/shared/world/types.ts";
import styles from "../InstanceManagerView.module.css";

export interface InstanceListProps {
	instances: WorldInstance[];
	selectedId: string | null;
	activeId: string | null;
	onSelectInstance: (id: string) => void;
	onOpenCreateWizard: () => void;
	onActivateInstance?: (id: string) => void;
	onDeleteInstance?: (id: string) => void;
}

export function InstanceList(props: Readonly<InstanceListProps>) {

	const {
		instances,
		selectedId,
		activeId,
		onSelectInstance,
		onOpenCreateWizard,
	} = props;

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<h3 className={styles.sidebarTitle}>Instances</h3>
			</div>

			<div className={styles.itemList}>
				{instances.map((inst) => {
					const isSelected = inst.id === selectedId;
					const isActive = inst.id === activeId;
					const worldRec = getWorldfile(inst.worldId);

					return (
						<div
							key={inst.id}
							role="button"
							tabIndex={0}
							className={`${styles.itemCard} ${isSelected ? styles.selectedCard : ""}`}
							onClick={() => onSelectInstance(inst.id)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									onSelectInstance(inst.id);
								}
							}}
						>
							<span className={styles.cardTitle}>{inst.title}</span>
							<span className={styles.cardSubtitle}>
								{worldRec?.worldfile.metadata.title || inst.worldId}
							</span>
							<div className={styles.badgeGroup}>
								{isActive && <Badge variant="active">Active Session</Badge>}
								{inst.universeId
									? (
											<Badge
												variant={
													inst.universeMode === "synchronized"
														? "synchronized"
														: "isolated"
												}
											>
												{inst.universeId}
												{" "}
												(
												{inst.universeMode}
												)
											</Badge>
										)
									: (
											<Badge>Standalone</Badge>
										)}
							</div>
						</div>
					);
				})}

				{instances.length === 0 && (
					<EmptyState
						message="No roleplay instances found."
						actionLabel="Create Your First Instance"
						onAction={onOpenCreateWizard}
					/>
				)}
			</div>
		</aside>
	);

}
