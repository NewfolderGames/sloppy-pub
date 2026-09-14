import ChatMessageText from "@/components/messages/ChatMessageText.tsx";
import ChatMessageReasoning from "@/components/messages/ChatMessageReasoning.tsx";
import ChatMessageActionBar from "@/components/messages/ChatMessageActionBar.tsx";
import styles from "./ChatMessage.module.css";
import { memo, useCallback, useState } from "react";
import type { Message } from "@/shared/ai/message/node.ts";

interface Props {
	data: Message;
	generating?: boolean;
	onChoiceSelect?: (selection: string) => void;
	disabled?: boolean;
	siblingIndex?: number;
	totalSiblings?: number;
	prevSiblingId?: string;
	nextSiblingId?: string;
	onSelectSibling?: (siblingId: string) => void;
	onPrevSibling?: () => void;
	onNextSibling?: () => void;
	onRegenerate?: (messageId: string) => void;
	onEdit?: (messageId: string, newContent: string) => void;
	onRetry?: (messageId: string) => void;
	onCopy?: (messageId: string) => void;
}

function ChatMessage(props: Readonly<Props>) {

	const {
		data,
		generating,
		onChoiceSelect,
		disabled,
		siblingIndex,
		totalSiblings,
		prevSiblingId,
		nextSiblingId,
		onSelectSibling,
		onPrevSibling,
		onNextSibling,
		onRegenerate,
		onEdit,
		onRetry,
		onCopy,
	} = props;

	const content = data.data.content;
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(typeof content === "string" ? content : "");
	const [prevDataId, setPrevDataId] = useState(data.id);

	if (data.id !== prevDataId) {
		setPrevDataId(data.id);
		setIsEditing(false);
		setEditContent(typeof content === "string" ? content : "");
	}

	const handleStartEdit = useCallback(() => {
		setEditContent(typeof content === "string" ? content : "");
		setIsEditing(true);
	}, [content]);

	const handleCancelEdit = useCallback(() => {
		setEditContent(typeof content === "string" ? content : "");
		setIsEditing(false);
	}, [content]);

	const handleSaveEdit = useCallback(() => {
		if (disabled || editContent.trim().length === 0) {
			return;
		}

		setIsEditing(false);
		onEdit?.(data.id, editContent);
	}, [disabled, editContent, onEdit, data.id]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSaveEdit();
		}
		else if (e.key === "Escape") {
			e.preventDefault();
			handleCancelEdit();
		}
	}, [handleSaveEdit, handleCancelEdit]);

	const handleRegenerate = useCallback(() => {
		onRegenerate?.(data.id);
	}, [onRegenerate, data.id]);

	const handleRetry = useCallback(() => {
		if (onRetry) {
			onRetry(data.id);
		}
		else if (onRegenerate) {
			onRegenerate(data.id);
		}
	}, [onRetry, onRegenerate, data.id]);

	const handleCopy = useCallback(() => {
		onCopy?.(data.id);
	}, [onCopy, data.id]);

	const handlePrevSibling = useCallback(() => {
		if (onPrevSibling) {
			onPrevSibling();
		}
		else if (prevSiblingId && onSelectSibling) {
			onSelectSibling(prevSiblingId);
		}
	}, [onPrevSibling, prevSiblingId, onSelectSibling]);

	const handleNextSibling = useCallback(() => {
		if (onNextSibling) {
			onNextSibling();
		}
		else if (nextSiblingId && onSelectSibling) {
			onSelectSibling(nextSiblingId);
		}
	}, [onNextSibling, nextSiblingId, onSelectSibling]);

	let contentComponent = null;

	if (typeof content === "string") {
		contentComponent = (
			<ChatMessageText
				role={data.data.role}
				content={content}
				onChoiceSelect={onChoiceSelect}
				disabled={disabled}
				currentStates={data.metadata?.stateSnapshot}
			/>
		);
	}

	return (
		<div
			className={styles.container}
			data-role={data.data.role}
		>
			{data.data.role === "assistant" && data.data.reasoning && (
				<ChatMessageReasoning content={data.data.reasoning} />
			)}
			{data.data.role === "tool" && (
				<div className={styles.toolHeader}>
					<span>TOOL</span>
					{"tool_call_id" in data.data && data.data.tool_call_id && (
						<code>{data.data.tool_call_id}</code>
					)}
				</div>
			)}
			{isEditing
				? (
						<div className={styles.editContainer}>
							<textarea
								className={styles.editTextarea}
								value={editContent}
								onChange={e => setEditContent(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={disabled}
								aria-label="Edit message content"
								rows={3}
								autoFocus
							/>
							<div className={styles.editActions}>
								<button
									type="button"
									className={styles.cancelButton}
									onClick={handleCancelEdit}
									disabled={disabled}
									aria-label="Cancel editing"
								>
									Cancel
								</button>
								<button
									type="button"
									className={styles.saveButton}
									onClick={handleSaveEdit}
									disabled={disabled || editContent.trim().length === 0}
									aria-label="Save edited message"
								>
									Save
								</button>
							</div>
						</div>
					)
				: (
						contentComponent
					)}
			{generating && <p className={styles.generating}>Generating...</p>}
			{!generating && !isEditing && (
				<ChatMessageActionBar
					message={data}
					siblingIndex={siblingIndex}
					totalSiblings={totalSiblings}
					onPrevSibling={onPrevSibling ?? (prevSiblingId && onSelectSibling ? handlePrevSibling : undefined)}
					onNextSibling={onNextSibling ?? (nextSiblingId && onSelectSibling ? handleNextSibling : undefined)}
					onRegenerate={onRegenerate ? handleRegenerate : undefined}
					onEdit={onEdit ? handleStartEdit : undefined}
					onRetry={onRetry || onRegenerate ? handleRetry : undefined}
					onCopy={onCopy ? handleCopy : undefined}
					disabled={disabled}
					isGenerating={generating}
				/>
			)}
		</div>
	);

}

export default memo(ChatMessage);
