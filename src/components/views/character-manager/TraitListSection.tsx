import { FeelingLuckyControl } from "@/components/common/FeelingLuckyControl.tsx";
import type { NamedTrait } from "@/shared/character/types.ts";
import styles from "../CharacterManagerView.module.css";

interface TraitListSectionProps {
	title: string;
	traits: NamedTrait[];
	onAdd: () => void;
	onUpdate: (index: number, patch: Partial<NamedTrait>) => void;
	onRemove: (index: number) => void;
	addButtonLabel: string;
	namePlaceholder: string;
	descPlaceholder: string;
	feelingLuckyField?: string;
	feelingLuckyContext?: Record<string, unknown>;
}

export function TraitListSection({
	title,
	traits,
	onAdd,
	onUpdate,
	onRemove,
	addButtonLabel,
	namePlaceholder,
	descPlaceholder,
}: Readonly<TraitListSectionProps>) {

	return (
		<div className={styles.section}>
			<h4 className={styles.sectionTitle}>{title}</h4>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				{traits.map((trait, idx) => (
					<div key={idx} className={styles.traitItem}>
						<input
							type="text"
							className={styles.input}
							placeholder={namePlaceholder}
							value={trait.name}
							onChange={e => onUpdate(idx, { name: e.target.value })}
						/>

						<input
							type="text"
							className={styles.input}
							placeholder={descPlaceholder}
							value={trait.description}
							onChange={e => onUpdate(idx, { description: e.target.value })}
							style={{ flex: 2 }}
						/>

						<button
							type="button"
							className={styles.removeButton}
							onClick={() => onRemove(idx)}
							title="Remove trait"
						>
							✕
						</button>

						<FeelingLuckyControl
							checked={Boolean(trait.feelingLucky)}
							onChange={checked => onUpdate(idx, { feelingLucky: checked })}
						/>
					</div>
				))}
			</div>

			<button
				type="button"
				className={styles.addButton}
				onClick={onAdd}
			>
				{addButtonLabel}
			</button>
		</div>
	);

}
