import type { ChangeEvent } from "react";
import styles from "./FeelingLuckyControl.module.css";

export interface FeelingLuckyControlProps {
	checked?: boolean;
	onChange?: (checked: boolean) => void;
	label?: string;
	className?: string;
	disabled?: boolean;
}

export function FeelingLuckyControl(props: Readonly<FeelingLuckyControlProps>) {

	const {
		checked = false,
		onChange,
		label = "Feeling Lucky",
		className,
		disabled = false,
	} = props;

	return (
		<div className={`${styles.container} ${className ?? ""}`.trim()}>
			<label className={styles.checkboxLabel}>
				<input
					type="checkbox"
					checked={checked}
					disabled={disabled}
					onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.checked)}
				/>
				<span>{label}</span>
			</label>
		</div>
	);

}
