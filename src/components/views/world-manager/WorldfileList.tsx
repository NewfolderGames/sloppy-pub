import type { StoredWorldfile } from "@/shared/world/registry.ts";
import styles from "../WorldManagerView.module.css";

export interface WorldfileListProps {
	worldfiles: StoredWorldfile[];
	selectedId: string | null;
	onSelectWorldfile: (record: StoredWorldfile) => void;
}

export function WorldfileList(props: Readonly<WorldfileListProps>) {

	const { worldfiles, selectedId, onSelectWorldfile } = props;

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<h3 className={styles.sidebarTitle}>Worldfiles</h3>
			</div>

			<div className={styles.itemList}>
				{worldfiles.map(item => (
					<div
						key={item.id}
						role="button"
						tabIndex={0}
						className={`${styles.itemCard} ${selectedId === item.id ? styles.selectedCard : ""}`}
						onClick={() => onSelectWorldfile(item)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								onSelectWorldfile(item);
							}
						}}
					>
						<p className={styles.cardTitle}>
							{item.worldfile.metadata.title || item.worldfile.metadata.name}
						</p>

						<p className={styles.cardSubtitle}>
							v
							{item.worldfile.metadata.version}
							{" "}
							•
							{" "}
							{item.worldfile.metadata.name}
						</p>

						<span className={styles.cardBadge}>
							{item.worldfile.args?.length ?? 0}
							{" "}
							args •
							{item.worldfile.vars?.length ?? 0}
							{" "}
							vars
						</span>
					</div>
				))}
			</div>
		</aside>
	);

}
