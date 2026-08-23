import { type ReactNode, useState } from "react";
import styles from "../WorldInfoDrawer.module.css";

interface CollapsibleSectionProps {
	title: string;
	badge?: ReactNode;
	defaultOpen?: boolean;
	children: ReactNode;
	className?: string;
}

export function CollapsibleSection({
	title,
	badge,
	defaultOpen = true,
	children,
	className,
}: Readonly<CollapsibleSectionProps>) {

	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<section className={`${styles.section} ${className || ""}`.trim()}>
			<button
				type="button"
				className={styles.collapsibleHeader}
				onClick={() => setIsOpen(prev => !prev)}
				aria-expanded={isOpen}
			>
				<div className={styles.collapsibleTitleGroup}>
					<span className={styles.collapseIcon} aria-hidden="true">
						{isOpen ? "▼" : "▶"}
					</span>

					<h3 className={styles.sectionTitle}>{title}</h3>
				</div>

				{badge && <div className={styles.collapsibleBadge}>{badge}</div>}
			</button>

			{isOpen && <div className={styles.collapsibleBody}>{children}</div>}
		</section>
	);

}
