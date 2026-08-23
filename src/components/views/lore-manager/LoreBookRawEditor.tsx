import styles from "../LoreManagerView.module.css";

interface LoreBookRawEditorProps {
	rawToml: string;
	onChangeRawToml: (value: string) => void;
	onApply: () => void;
	onBack: () => void;
	onImport: () => void;
}

export function LoreBookRawEditor({
	rawToml,
	onChangeRawToml,
	onApply,
	onBack,
	onImport,
}: Readonly<LoreBookRawEditorProps>) {

	return (
		<div className={styles.section}>
			<div className={styles.contentHeader}>
				<h4 className={styles.sectionTitle}>Raw TOML</h4>

				<div className={styles.headerActions}>
					<button
						type="button"
						className={`${styles.button} ${styles.primaryButton}`}
						onClick={onApply}
					>
						Apply
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={onBack}
					>
						Back
					</button>
				</div>
			</div>

			<textarea
				className={styles.textarea}
				rows={20}
				value={rawToml}
				onChange={e => onChangeRawToml(e.target.value)}
			/>

			<div className={styles.row}>
				<button
					type="button"
					className={styles.button}
					onClick={onImport}
				>
					Import from TOML
				</button>
			</div>
		</div>
	);

}
