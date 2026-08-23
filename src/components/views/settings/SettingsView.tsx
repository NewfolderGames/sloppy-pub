import { useEffect, useState } from "react";
import { addAssistancePrompt, updateAssistancePrompt } from "@/shared/settings/assistance_prompt_registry.ts";
import { addPrompt, updatePrompt } from "@/shared/settings/prompt_registry.ts";
import type { AssistantDiffPayload } from "@/shared/ai/assistance/types.ts";
import { AssistancePromptsSubmenu } from "./AssistancePromptsSubmenu.tsx";
import { PromptsSettingsSubmenu } from "./PromptsSettingsSubmenu.tsx";
import styles from "./SettingsView.module.css";

export type SettingsSubmenu = "prompts" | "assistance-prompts";

export interface SettingsViewProps {
	onEditorContextChange?: (context: { activeId: string | null; rawToml: string; summary?: Record<string, unknown> }) => void;
	applyDiffCallbackRef?: React.MutableRefObject<((payload: AssistantDiffPayload) => void) | null>;
}

interface SubmenuItem {
	id: SettingsSubmenu;
	label: string;
	description?: string;
}

const SUBMENU_ITEMS: SubmenuItem[] = [
	{
		id: "prompts",
		label: "Roleplay Prompts",
		description: "Configure system and general roleplay prompts",
	},
	{
		id: "assistance-prompts",
		label: "Assistance Prompts",
		description: "Configure user prompts for the AI Assistant",
	},
];

export function SettingsView(props: SettingsViewProps = {}) {

	const { onEditorContextChange, applyDiffCallbackRef } = props;
	const [activeSubmenu, setActiveSubmenu] = useState<SettingsSubmenu>("prompts");

	useEffect(() => {
		onEditorContextChange?.({
			activeId: activeSubmenu,
			rawToml: "",
			summary: {
				currentSection: activeSubmenu,
			},
		});
	}, [activeSubmenu, onEditorContextChange]);

	useEffect(() => {
		if (applyDiffCallbackRef) {
			applyDiffCallbackRef.current = (payload: AssistantDiffPayload) => {
				if (activeSubmenu === "assistance-prompts") {
					if (payload.targetPath) {
						updateAssistancePrompt(payload.targetPath, {
							name: payload.title,
							content: payload.proposedText,
						});
					}
					else {
						addAssistancePrompt(payload.title, payload.proposedText);
					}
				}
				else {
					if (payload.targetPath) {
						updatePrompt(payload.targetPath, {
							name: payload.title,
							content: payload.proposedText,
						});
					}
					else {
						addPrompt({
							name: payload.title,
							content: payload.proposedText,
							enabled: true,
						});
					}
				}
			};
		}
	}, [activeSubmenu, applyDiffCallbackRef]);

	// Submenu Navigation

	const handleSelectSubmenu = (submenu: SettingsSubmenu) => {
		setActiveSubmenu(submenu);
	};

	// Render

	return (
		<div className={styles.container}>
			<div className={styles.topBar}>
				<h2 className={styles.title}>Settings</h2>
			</div>

			<div className={styles.mainLayout}>
				<aside className={styles.sidebar}>
					<h3 className={styles.sidebarTitle}>Navigation</h3>
					<nav className={styles.menuList}>
						{SUBMENU_ITEMS.map((item) => {
							const isActive = activeSubmenu === item.id;
							const buttonClassName = isActive
								? `${styles.menuButton} ${styles.activeMenuButton}`
								: styles.menuButton;

							return (
								<button
									key={item.id}
									type="button"
									className={buttonClassName}
									onClick={() => handleSelectSubmenu(item.id)}
								>
									<span>{item.label}</span>
									{isActive && <span>›</span>}
								</button>
							);
						})}
					</nav>
				</aside>

				<main className={styles.contentPanel}>
					{activeSubmenu === "prompts" && <PromptsSettingsSubmenu />}
					{activeSubmenu === "assistance-prompts" && <AssistancePromptsSubmenu />}
				</main>
			</div>
		</div>
	);
}

export default SettingsView;
