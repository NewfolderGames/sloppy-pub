import type { ChangeEvent } from "react";
import { isSystemPromptId } from "@/shared/settings/prompt_registry.ts";
import type { SystemPromptId, SystemPromptItem, UserPromptItem } from "@/shared/settings/types.ts";
import styles from "./PromptItemCard.module.css";

export interface PromptItemCardProps {
	item: UserPromptItem | SystemPromptItem;
	index: number;
	totalItems: number;
	onUpdateUserPrompt?: (
		id: string,
		updates: Partial<Omit<UserPromptItem, "id">>,
	) => void;
	onToggleSystemPrompt?: (id: SystemPromptId, enabled: boolean) => void;
	onUpdateSystemPromptRole?: (id: SystemPromptId, role: "system" | "user") => void;
	onDelete?: (id: string) => void;
	onReorder: (id: string, direction: "up" | "down") => void;
}

export function PromptItemCard(props: Readonly<PromptItemCardProps>) {

	const {
		item,
		index,
		totalItems,
		onUpdateUserPrompt,
		onToggleSystemPrompt,
		onUpdateSystemPromptRole,
		onDelete,
		onReorder,
	} = props;

	const isFirst = index === 0;
	const isLast = index === totalItems - 1;

	const isSystem = isSystemPromptId(item.id);

	// Event Handlers

	const handleMoveUp = () => {
		if (isFirst) {
			return;
		}

		onReorder(item.id, "up");
	};

	const handleMoveDown = () => {
		if (isLast) {
			return;
		}

		onReorder(item.id, "down");
	};

	// System Prompt Branch

	if (isSystem) {
		const systemItem = item as SystemPromptItem;

		const canConfigureRole = systemItem.id !== "system:chat_history";

		const currentRole = systemItem.role ?? (systemItem.id === "system:world_states" ? "user" : "system");

		const handleToggleSystemEnabled = (event: ChangeEvent<HTMLInputElement>) => {
			onToggleSystemPrompt?.(systemItem.id, event.target.checked);
		};

		const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
			const selectedRole = event.target.value as "system" | "user";

			onUpdateSystemPromptRole?.(systemItem.id, selectedRole);
		};

		const systemCardClassName = systemItem.enabled
			? `${styles.card} ${styles.systemCard}`
			: `${styles.card} ${styles.systemCard} ${styles.disabledCard}`;

		return (
			<div className={systemCardClassName}>
				<div className={styles.cardHeader}>
					<div className={styles.headerLeft}>
						<span className={styles.orderBadge}>
							#
							{index + 1}
						</span>
						<span className={styles.systemBadge}>System</span>
						<h4 className={styles.itemTitle}>{systemItem.name}</h4>
					</div>

					<div className={styles.headerRight}>
						{canConfigureRole && (
							<label className={styles.roleSelector}>
								<span className={styles.roleLabel}>Role:</span>
								<select
									name="role"
									className={styles.roleSelect}
									value={currentRole}
									onChange={handleRoleChange}
									aria-label="Prompt role"
								>
									<option value="system">system</option>
									<option value="user">user</option>
								</select>
							</label>
						)}

						<label className={styles.enableToggle}>
							<input
								type="checkbox"
								className={styles.checkbox}
								checked={systemItem.enabled}
								onChange={handleToggleSystemEnabled}
							/>
							<span>Enabled</span>
						</label>

						<div className={styles.actionButtons}>
							<button
								type="button"
								className={styles.iconButton}
								onClick={handleMoveUp}
								disabled={isFirst}
								title="Move prompt up"
							>
								↑ Up
							</button>

							<button
								type="button"
								className={styles.iconButton}
								onClick={handleMoveDown}
								disabled={isLast}
								title="Move prompt down"
							>
								↓ Down
							</button>
						</div>
					</div>
				</div>

				<div className={styles.systemNotice}>
					<p className={styles.systemDescription}>{systemItem.description}</p>
					<p className={styles.systemNoticeNote}>
						This system prompt is managed by the application. Its content cannot be modified or deleted.
					</p>
				</div>
			</div>
		);
	}

	// User Prompt Branch

	const userItem = item as UserPromptItem;

	const currentRole = userItem.role ?? "user";

	const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const selectedRole = event.target.value as "system" | "user";

		onUpdateUserPrompt?.(userItem.id, { role: selectedRole });
	};

	const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
		onUpdateUserPrompt?.(userItem.id, { name: event.target.value });
	};

	const handleDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
		onUpdateUserPrompt?.(userItem.id, { description: event.target.value });
	};

	const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		onUpdateUserPrompt?.(userItem.id, { content: event.target.value });
	};

	const handleToggleUserEnabled = (event: ChangeEvent<HTMLInputElement>) => {
		onUpdateUserPrompt?.(userItem.id, { enabled: event.target.checked });
	};

	const handleDelete = () => {
		onDelete?.(userItem.id);
	};

	const userCardClassName = userItem.enabled
		? styles.card
		: `${styles.card} ${styles.disabledCard}`;

	const displayName = userItem.name.trim() !== "" ? userItem.name : "Untitled Prompt";

	return (
		<div className={userCardClassName}>
			<div className={styles.cardHeader}>
				<div className={styles.headerLeft}>
					<span className={styles.orderBadge}>
						#
						{index + 1}
					</span>
					<h4 className={styles.itemTitle}>{displayName}</h4>
				</div>

				<div className={styles.headerRight}>
					<label className={styles.roleSelector}>
						<span className={styles.roleLabel}>Role:</span>
						<select
							name="role"
							className={styles.roleSelect}
							value={currentRole}
							onChange={handleRoleChange}
							aria-label="Prompt role"
						>
							<option value="system">system</option>
							<option value="user">user</option>
						</select>
					</label>

					<label className={styles.enableToggle}>
						<input
							type="checkbox"
							className={styles.checkbox}
							checked={userItem.enabled}
							onChange={handleToggleUserEnabled}
						/>
						<span>Enabled</span>
					</label>

					<div className={styles.actionButtons}>
						<button
							type="button"
							className={styles.iconButton}
							onClick={handleMoveUp}
							disabled={isFirst}
							title="Move prompt up"
						>
							↑ Up
						</button>

						<button
							type="button"
							className={styles.iconButton}
							onClick={handleMoveDown}
							disabled={isLast}
							title="Move prompt down"
						>
							↓ Down
						</button>

						<button
							type="button"
							className={styles.deleteButton}
							onClick={handleDelete}
							title="Delete prompt"
						>
							Delete
						</button>
					</div>
				</div>
			</div>

			<div className={styles.formGrid}>
				<div className={styles.formGroup}>
					<label className={styles.label}>Name (Metadata)</label>
					<input
						type="text"
						className={styles.input}
						value={userItem.name}
						onChange={handleNameChange}
						placeholder="Prompt name..."
					/>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label}>Description (Metadata)</label>
					<input
						type="text"
						className={styles.input}
						value={userItem.description}
						onChange={handleDescriptionChange}
						placeholder="Prompt description..."
					/>
				</div>
			</div>

			<div className={styles.formGroup}>
				<label className={styles.label}>Content (Prompt Text)</label>
				<textarea
					className={styles.textarea}
					value={userItem.content}
					onChange={handleContentChange}
					placeholder="Enter prompt content here..."
					rows={6}
				/>
			</div>
		</div>
	);
}
