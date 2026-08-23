import React from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
	message: string;
	actionLabel?: string;
	onAction?: () => void;
	children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	message,
	actionLabel,
	onAction,
	children,
}) => {
	return (
		<div className={styles.emptyState}>
			<p className={styles.message}>{message}</p>

			{actionLabel && onAction && (
				<button type="button" className={styles.actionButton} onClick={onAction}>
					{actionLabel}
				</button>
			)}

			{children}
		</div>
	);
};
