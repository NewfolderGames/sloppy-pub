import React from "react";
import styles from "./RawTomlEditor.module.css";

export interface RawTomlEditorProps {
	rawToml: string;
	onChangeToml: (value: string) => void;
	onApplyRawToml: () => void;
	buttonLabel?: string;
}

export const RawTomlEditor: React.FC<RawTomlEditorProps> = ({
	rawToml,
	onChangeToml,
	onApplyRawToml,
	buttonLabel = "Validate & Apply TOML",
}) => {
	return (
		<div className={styles.container}>
			<textarea
				className={styles.rawEditor}
				value={rawToml}
				onChange={e => onChangeToml(e.target.value)}
				spellCheck={false}
			/>

			<div>
				<button
					type="button"
					className={styles.button}
					onClick={onApplyRawToml}
				>
					{buttonLabel}
				</button>
			</div>
		</div>
	);
};
