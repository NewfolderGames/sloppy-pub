import { addPrompt, deletePrompt, getSystemPromptItem, isSystemPromptId, reorderPrompt, resetPromptSettings, updatePrompt, updateSystemPrompt, updateSystemPromptRole } from "@/shared/settings/prompt_registry.ts";
import type { SystemPromptId, SystemPromptItem, UserPromptItem } from "@/shared/settings/types.ts";
import { usePromptSettings } from "@/shared/settings/use_prompt_settings.ts";
import { PromptItemCard } from "./PromptItemCard.tsx";
import styles from "./PromptsSettingsSubmenu.module.css";

export function PromptsSettingsSubmenu() {

	const settings = usePromptSettings();

	// Handlers

	const handleAddPrompt = () => {
		addPrompt();
	};

	const handleUpdateUserPrompt = (
		id: string,
		updates: Partial<Omit<UserPromptItem, "id">>,
	) => {
		updatePrompt(id, updates);
	};

	const handleToggleSystemPrompt = (id: SystemPromptId, enabled: boolean) => {
		updateSystemPrompt(id, { enabled });
	};

	const handleUpdateSystemPromptRole = (id: SystemPromptId, role: "system" | "user") => {
		updateSystemPromptRole(id, role);
	};

	const handleDeletePrompt = (id: string) => {
		deletePrompt(id);
	};

	const handleReorderPrompt = (id: string, direction: "up" | "down") => {
		reorderPrompt(id, direction);
	};

	const handleResetDefaults = () => {
		if (typeof window !== "undefined" && window.confirm) {
			const confirmed = window.confirm("Reset all prompt settings to default presets?");

			if (!confirmed) {
				return;
			}
		}

		resetPromptSettings();
	};

	// Build Ordered Prompt Items

	const promptItems: Array<UserPromptItem | SystemPromptItem> = [];

	for (const id of settings.order) {
		if (isSystemPromptId(id)) {
			const systemItem = getSystemPromptItem(id, settings);

			if (systemItem) {
				promptItems.push(systemItem);
			}

			continue;
		}

		const userItem = settings.userPrompts[id];

		if (userItem) {
			promptItems.push(userItem);
		}
	}

	// Render

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.headerInfo}>
					<h2 className={styles.title}>Prompts Configuration</h2>
					<p className={styles.description}>
						Configure custom prompts and arrange system prompts to control the LLM request sequence.
					</p>
				</div>

				<div className={styles.headerActions}>
					<button
						type="button"
						className={`${styles.button} ${styles.primaryButton}`}
						onClick={handleAddPrompt}
						title="Add a new custom prompt"
					>
						+ Add Prompt
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={handleResetDefaults}
						title="Reset all prompts to factory defaults"
					>
						Reset to Defaults
					</button>
				</div>
			</div>

			{promptItems.length === 0
				? (
						<div className={styles.emptyState}>
							No prompts configured. Click "+ Add Prompt" to create one.
						</div>
					)
				: (
						<div className={styles.promptList}>
							{promptItems.map((item, index) => (
								<PromptItemCard
									key={item.id}
									item={item}
									index={index}
									totalItems={promptItems.length}
									onUpdateUserPrompt={handleUpdateUserPrompt}
									onToggleSystemPrompt={handleToggleSystemPrompt}
									onUpdateSystemPromptRole={handleUpdateSystemPromptRole}
									onDelete={handleDeletePrompt}
									onReorder={handleReorderPrompt}
								/>
							))}
						</div>
					)}
		</div>
	);
}
