import React from "react";
import styles from "./TabGroup.module.css";

export interface TabItem<T extends string = string> {
	id: T;
	label: string;
}

export interface TabGroupProps<T extends string = string> {
	tabs: Array<TabItem<T>>;
	activeTab: T;
	onChange: (tabId: T) => void;
	className?: string;
}

export function TabGroup<T extends string = string>({
	tabs,
	activeTab,
	onChange,
	className,
}: TabGroupProps<T>): React.ReactElement {
	const containerClass = [styles.tabGroup, className].filter(Boolean).join(" ");

	return (
		<div className={containerClass} role="tablist">
			{tabs.map((tab) => {
				const isActive = tab.id === activeTab;
				const buttonClass = isActive
					? `${styles.tabButton} ${styles.activeTabButton}`
					: styles.tabButton;

				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						className={buttonClass}
						onClick={() => onChange(tab.id)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
