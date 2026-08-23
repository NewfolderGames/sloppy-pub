import { useState } from "react";
import { addAssistancePrompt, deleteAssistancePrompt, reorderAssistancePrompt, resetAssistancePromptSettings, updateAssistancePrompt } from "../../../shared/settings/assistance_prompt_registry.ts";
import { useAssistancePromptSettings } from "../../../shared/settings/use_assistance_prompt_settings.ts";
import styles from "./PromptsSettingsSubmenu.module.css";
import cardStyles from "./PromptItemCard.module.css";

export function AssistancePromptsSubmenu() {

	const settings = useAssistancePromptSettings();
	const [newPromptName, setNewPromptName] = useState("");
	const [newPromptContent, setNewPromptContent] = useState("");
	const [isAdding, setIsAdding] = useState(false);

	const promptItems = settings.order
		.map(id => settings.prompts[id])
		.filter(Boolean);

	const handleAddPrompt = () => {

		if (isAdding) {
			if (newPromptName.trim() || newPromptContent.trim()) {
				addAssistancePrompt(
					newPromptName.trim() || "New Assistance Prompt",
					newPromptContent.trim(),
				);
				setNewPromptName("");
				setNewPromptContent("");
			}
			setIsAdding(false);
			return;
		}

		setIsAdding(true);

	};

	const handleCancelAdd = () => {

		setIsAdding(false);
		setNewPromptName("");
		setNewPromptContent("");

	};

	const handleReset = () => {

		if (typeof window !== "undefined" && window.confirm) {
			if (window.confirm("Reset all assistance prompts to defaults?")) {
				resetAssistancePromptSettings();
			}
			return;
		}

		resetAssistancePromptSettings();

	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.titleArea}>
					<h3 className={styles.title}>Assistance Prompts</h3>
					<p className={styles.subtitle}>
						Configure custom prompts and guidelines injected into the AI Assistant system prompt across World Manager, Universe Manager, and Settings.
					</p>
				</div>

				<div className={styles.headerActions}>
					<button
						type="button"
						className={`${styles.button} ${styles.primaryButton}`}
						onClick={handleAddPrompt}
					>
						+ Add Assistance Prompt
					</button>

					<button
						type="button"
						className={styles.button}
						onClick={handleReset}
					>
						Reset to Defaults
					</button>
				</div>
			</div>

			{isAdding && (
				<div className={cardStyles.card}>
					<div className={cardStyles.cardHeader}>
						<h4 className={cardStyles.itemTitle}>New Assistance Prompt</h4>
					</div>

					<div className={cardStyles.formGroup}>
						<label className={cardStyles.label}>Prompt Name</label>
						<input
							type="text"
							className={cardStyles.input}
							placeholder="e.g. World-building Tone, Strict Rules"
							value={newPromptName}
							onChange={e => setNewPromptName(e.target.value)}
						/>
					</div>

					<div className={cardStyles.formGroup}>
						<label className={cardStyles.label}>Instructions</label>
						<textarea
							className={cardStyles.textarea}
							placeholder="Instructions appended to the AI assistant..."
							value={newPromptContent}
							onChange={e => setNewPromptContent(e.target.value)}
						/>
					</div>

					<div className={cardStyles.actionButtons}>
						<button
							type="button"
							className={cardStyles.iconButton}
							onClick={handleCancelAdd}
						>
							Cancel
						</button>
						<button
							type="button"
							className={`${styles.button} ${styles.primaryButton}`}
							onClick={handleAddPrompt}
						>
							Save Prompt
						</button>
					</div>
				</div>
			)}

			{promptItems.length === 0 && !isAdding
				? (
						<div className={styles.emptyState}>
							No assistance prompts configured. Click "+ Add Assistance Prompt" to add instructions for the assistant.
						</div>
					)
				: (
						<div className={styles.promptList}>
							{promptItems.map((prompt, index) => {
								const isFirst = index === 0;
								const isLast = index === promptItems.length - 1;

								return (
									<div
										key={prompt.id}
										className={`${cardStyles.card} ${!prompt.enabled ? cardStyles.disabledCard : ""}`}
									>
										<div className={cardStyles.cardHeader}>
											<div className={cardStyles.headerLeft}>
												<span className={cardStyles.orderBadge}>
													#
													{index + 1}
												</span>
												<input
													type="text"
													className={cardStyles.input}
													style={{ fontWeight: "bold", maxWidth: "260px" }}
													value={prompt.name}
													onChange={e => updateAssistancePrompt(prompt.id, { name: e.target.value })}
												/>
											</div>

											<div className={cardStyles.headerRight}>
												<label className={cardStyles.enableToggle}>
													<input
														type="checkbox"
														className={cardStyles.checkbox}
														checked={prompt.enabled}
														onChange={e => updateAssistancePrompt(prompt.id, { enabled: e.target.checked })}
													/>
													<span>{prompt.enabled ? "Enabled" : "Disabled"}</span>
												</label>

												<div className={cardStyles.actionButtons}>
													<button
														type="button"
														className={cardStyles.iconButton}
														disabled={isFirst}
														onClick={() => reorderAssistancePrompt(index, index - 1)}
														title="Move up"
													>
														▲
													</button>
													<button
														type="button"
														className={cardStyles.iconButton}
														disabled={isLast}
														onClick={() => reorderAssistancePrompt(index, index + 1)}
														title="Move down"
													>
														▼
													</button>
													<button
														type="button"
														className={cardStyles.deleteButton}
														onClick={() => deleteAssistancePrompt(prompt.id)}
														title="Delete prompt"
													>
														Delete
													</button>
												</div>
											</div>
										</div>

										<div className={cardStyles.formGroup}>
											<label className={cardStyles.label}>Instructions</label>
											<textarea
												className={cardStyles.textarea}
												value={prompt.content}
												onChange={e => updateAssistancePrompt(prompt.id, { content: e.target.value })}
											/>
										</div>
									</div>
								);
							})}
						</div>
					)}
		</div>
	);

}

export default AssistancePromptsSubmenu;
