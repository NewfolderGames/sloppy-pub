import { type ChangeEvent, type RefObject } from "react";
import styles from "../CharacterManagerView.module.css";

interface CharacterHeaderProps {
	fileInputRef: RefObject<HTMLInputElement | null>;
	selectedId: string | null;
	onNewCharacter: () => void;
	onImportClick: () => void;
	onFileImport: (e: ChangeEvent<HTMLInputElement>) => void;
	onExport: () => void;
	onDelete: () => void;
}

export function CharacterHeader({
	fileInputRef,
	selectedId,
	onNewCharacter,
	onImportClick,
	onFileImport,
	onExport,
	onDelete,
}: Readonly<CharacterHeaderProps>) {

	return (
		<div className={styles.topBar}>
			<h2 className={styles.title}>Character Manager</h2>

			<div className={styles.headerActions}>
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: "none" }}
					accept=".toml,text/plain"
					onChange={onFileImport}
				/>

				<button
					type="button"
					className={styles.button}
					onClick={onNewCharacter}
				>
					+ New Character
				</button>

				<button
					type="button"
					className={styles.button}
					onClick={onImportClick}
				>
					Import TOML
				</button>

				{selectedId && (
					<>
						<button
							type="button"
							className={styles.button}
							onClick={onExport}
						>
							Export TOML
						</button>

						<button
							type="button"
							className={`${styles.button} ${styles.dangerButton}`}
							onClick={onDelete}
						>
							Delete
						</button>
					</>
				)}
			</div>
		</div>
	);

}
