import type { StoredLoreBook } from "@/shared/lore/types.ts";
import styles from "../LoreManagerView.module.css";

interface LoreBookListProps {
	storedList: StoredLoreBook[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}

export function LoreBookList({
	storedList,
	selectedId,
	onSelect,
}: Readonly<LoreBookListProps>) {

	return (
		<div className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<h3 className={styles.sidebarTitle}>Lore Books</h3>
			</div>

			<div className={styles.itemList}>
				{storedList.map((record) => {
					const isSelected = selectedId === record.id;
					const cardClassName = `${styles.itemCard} ${isSelected ? styles.selectedCard : ""}`.trim();

					return (
						<button
							key={record.id}
							type="button"
							className={cardClassName}
							onClick={() => onSelect(record.id)}
						>
							<p className={styles.cardTitle}>{record.lorebook.name}</p>

							<p className={styles.cardSubtitle}>
								{record.lorebook.entries.length}
								{" "}
								entries
							</p>
						</button>
					);
				})}
			</div>
		</div>
	);

}
