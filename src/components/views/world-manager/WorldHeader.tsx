import { type ChangeEvent, type RefObject } from "react";
import styles from "../WorldManagerView.module.css";

interface WorldHeaderProps {
	fileInputRef: RefObject<HTMLInputElement | null>;
	onImportFile: (e: ChangeEvent<HTMLInputElement>) => void;
	onCreateNew: () => void;
}

export function WorldHeader({
	fileInputRef,
	onImportFile,
	onCreateNew,
}: Readonly<WorldHeaderProps>) {

	return (
		<div className={styles.topBar}>
			<h2 className={styles.title}>Worldfile Manager</h2>

			<div className={styles.headerActions}>
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: "none" }}
					accept=".toml,.worldfile.toml"
					onChange={onImportFile}
				/>

				<button
					type="button"
					className={styles.button}
					onClick={() => fileInputRef.current?.click()}
				>
					Import .worldfile.toml
				</button>

				<button
					type="button"
					className={`${styles.button} ${styles.primaryButton}`}
					onClick={onCreateNew}
				>
					+ New Worldfile
				</button>
			</div>
		</div>
	);

}
