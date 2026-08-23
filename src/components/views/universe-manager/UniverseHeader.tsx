import { type ChangeEvent, type RefObject } from "react";
import styles from "../UniverseManagerView.module.css";

interface UniverseHeaderProps {
	fileInputRef: RefObject<HTMLInputElement | null>;
	onImportFile: (e: ChangeEvent<HTMLInputElement>) => void;
	onCreateNew: () => void;
}

export function UniverseHeader({
	fileInputRef,
	onImportFile,
	onCreateNew,
}: Readonly<UniverseHeaderProps>) {

	return (
		<div className={styles.topBar}>
			<h2 className={styles.title}>Universe Manager</h2>

			<div className={styles.headerActions}>
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: "none" }}
					accept=".toml,.universefile.toml"
					onChange={onImportFile}
				/>

				<button
					type="button"
					className={styles.button}
					onClick={() => fileInputRef.current?.click()}
				>
					Import .universefile.toml
				</button>

				<button
					type="button"
					className={`${styles.button} ${styles.primaryButton}`}
					onClick={onCreateNew}
				>
					+ New Universe
				</button>
			</div>
		</div>
	);

}
