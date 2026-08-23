import type { AppTab } from "@/shared/world/types.ts";
import styles from "./AppHeader.module.css";

interface Props {
	activeTab: AppTab;
	onSelectTab: (tab: AppTab) => void;
	className?: string;
	isAssistantOpen?: boolean;
	onToggleAssistant?: () => void;
}

interface NavItem {
	id: AppTab;
	label: string;
}

const TABS: NavItem[] = [
	{ id: "chat", label: "Chat" },
	{ id: "world-manager", label: "World Manager" },
	{ id: "universe-manager", label: "Universe Manager" },
	{ id: "character-manager", label: "Character Manager" },
	{ id: "lore", label: "Lore" },
	{ id: "instances", label: "Instances" },
	{ id: "settings", label: "Settings" },
];

function AppHeader(props: Readonly<Props>) {

	const {
		activeTab,
		onSelectTab,
		className,
		isAssistantOpen = false,
		onToggleAssistant,
	} = props;

	const canShowAssistant = activeTab === "world-manager"
		|| activeTab === "universe-manager"
		|| activeTab === "character-manager"
		|| activeTab === "lore"
		|| activeTab === "settings";

	return (
		<header className={`${styles.appHeader} ${className ?? ""}`.trim()}>
			<nav className={styles.headerNav}>
				{TABS.map(tab => (
					<button
						key={tab.id}
						type="button"
						className={`${styles.navButton} ${activeTab === tab.id ? styles.activeNavButton : ""}`.trim()}
						onClick={() => onSelectTab(tab.id)}
					>
						{tab.label}
					</button>
				))}
				{canShowAssistant && onToggleAssistant && (
					<button
						type="button"
						className={`${styles.assistantToggle} ${isAssistantOpen ? styles.assistantToggleActive : ""}`.trim()}
						onClick={onToggleAssistant}
						title={isAssistantOpen ? "Close Wizard" : "Open Wizard"}
					>
						<span>🧙 Wizard</span>
					</button>
				)}
			</nav>
		</header>
	);

}

export default AppHeader;
