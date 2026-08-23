import type { StoredUniversefile } from "@/shared/universe/registry.ts";
import styles from "../UniverseManagerView.module.css";

export interface UniverseListProps {
	universes: StoredUniversefile[];
	selectedId: string | null;
	onSelectUniverse: (record: StoredUniversefile) => void;
}

export function UniverseList(props: Readonly<UniverseListProps>) {

	const { universes, selectedId, onSelectUniverse } = props;

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<h3 className={styles.sidebarTitle}>
					Universes (
					{universes.length}
					)
				</h3>
			</div>

			<div className={styles.itemList}>
				{universes.map(item => (
					<div
						key={item.id}
						className={`${styles.itemCard} ${selectedId === item.id ? styles.selectedCard : ""}`}
						onClick={() => onSelectUniverse(item)}
					>
						<p className={styles.cardTitle}>
							{item.universe.metadata.title || item.universe.metadata.name}
						</p>

						<p className={styles.cardSubtitle}>
							v
							{item.universe.metadata.version}
							{" • "}
							{item.universe.metadata.name}
						</p>

						<span className={styles.cardBadge}>
							{item.universe.settings.backgrounds?.length ?? 0}
							{" backgrounds • "}
							{item.universe.settings.rules.length}
							{" rules • "}
							{Object.keys(item.universe.states).length}
							{" states"}
						</span>
					</div>
				))}
			</div>
		</aside>
	);

}
