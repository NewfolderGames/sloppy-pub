import React from "react";
import styles from "./Modal.module.css";

export interface ModalProps {
	isOpen: boolean;
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
	isOpen,
	title,
	onClose,
	children,
	footer,
}) => {
	if (!isOpen) {
		return null;
	}

	return (
		<div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
			<div className={styles.modalContent} onClick={event => event.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h3 className={styles.modalTitle}>{title}</h3>
					<button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
						Close
					</button>
				</div>

				<div className={styles.modalBody}>
					{children}
				</div>

				{footer && (
					<div className={styles.modalFooter}>
						{footer}
					</div>
				)}
			</div>
		</div>
	);
};
