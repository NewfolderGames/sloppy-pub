import type { StoredCharacterfile } from "@/shared/character/types.ts";
import styles from "../CharacterManagerView.module.css";

export interface CharacterListProps {
	characters: StoredCharacterfile[];
	selectedId: string | null;
	onSelectCharacter: (record: StoredCharacterfile) => void;
}

export function CharacterList(props: Readonly<CharacterListProps>) {

	const { characters, selectedId, onSelectCharacter } = props;

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<h3 className={styles.sidebarTitle}>
					Characters (
					{characters.length}
					)
				</h3>
			</div>

			<div className={styles.itemList}>
				{characters.map(item => (
					<div
						key={item.id}
						className={`${styles.itemCard} ${selectedId === item.id ? styles.selectedCard : ""}`}
						onClick={() => onSelectCharacter(item)}
					>
						<p className={styles.cardTitle}>
							{item.characterfile.metadata.title || item.characterfile.metadata.name}
						</p>

						<p className={styles.cardSubtitle}>
							v
							{item.characterfile.metadata.version}
							{" • "}
							{item.characterfile.metadata.name}
						</p>

						<span className={styles.cardBadge}>
							{item.characterfile.physical_characteristics.length}
							{" physical • "}
							{item.characterfile.linguistic_patterns.length}
							{" linguistic • "}
							{Object.keys(item.characterfile.initial_states).length}
							{" states"}
						</span>
					</div>
				))}
			</div>
		</aside>
	);

}
