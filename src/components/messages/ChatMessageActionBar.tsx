import { memo, useCallback, useState } from "react";
import type { Message } from "@/shared/ai/message/node.ts";
import { formatDuration, formatTokens } from "./action_bar_helpers.ts";
import styles from "./ChatMessageActionBar.module.css";

export interface ChatMessageActionBarProps {
	message: Message;
	isGenerating?: boolean;
	disabled?: boolean;
	siblingIndex?: number;
	totalSiblings?: number;
	onPrevSibling?: () => void;
	onNextSibling?: () => void;
	onRegenerate?: () => void;
	onEdit?: () => void;
	onRetry?: () => void;
	onCopy?: () => void;
}

function ChatMessageActionBar(props: Readonly<ChatMessageActionBarProps>) {

	const {
		message,
		isGenerating,
		disabled,
		siblingIndex,
		totalSiblings,
		onPrevSibling,
		onNextSibling,
		onRegenerate,
		onEdit,
		onRetry,
		onCopy,
	} = props;

	const [copied, setCopied] = useState(false);

	const content = typeof message.data.content === "string" ? message.data.content : "";
	const error = message.metadata?.error;
	const isAssistant = message.data.role === "assistant";
	const tokens = message.metadata?.tokens;
	const durationMs = message.metadata?.durationMs;
	const showMetrics = isAssistant && !isGenerating && (typeof tokens === "number" || typeof durationMs === "number");
	const hasSiblings = typeof totalSiblings === "number" && totalSiblings > 1;
	const currentIndex = siblingIndex ?? 0;

	const handleCopy = useCallback(async () => {

		if (!content) {
			return;
		}

		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
		catch {
			const textArea = document.createElement("textarea");
			textArea.value = content;
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand("copy");
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
			finally {
				document.body.removeChild(textArea);
			}
		}

		onCopy?.();

	}, [content, onCopy]);

	if (isGenerating) {
		return null;
	}

	const hasAnyContent = error || showMetrics || hasSiblings || content || onEdit || (isAssistant && onRegenerate);
	if (!hasAnyContent) {
		return null;
	}

	return (
		<div className={styles.container} data-role={message.data.role}>
			{error && (
				<div className={styles.errorBanner} role="alert">
					<span className={styles.errorText}>{error}</span>
					{(onRetry || onRegenerate) && (
						<button
							type="button"
							className={styles.retryButton}
							onClick={onRetry ?? onRegenerate}
							disabled={disabled}
							aria-label="Retry message"
						>
							Retry
						</button>
					)}
				</div>
			)}

			<div className={styles.contentRow}>
				<div className={styles.metaGroup}>
					{hasSiblings && (
						<div
							className={styles.siblingPager}
							role="group"
							aria-label="Message branch navigation"
						>
							<button
								type="button"
								className={styles.pagerButton}
								onClick={onPrevSibling}
								disabled={disabled || currentIndex <= 0}
								aria-label="Previous sibling message"
							>
								&lt;
							</button>
							<span className={styles.pagerCount} aria-live="polite">
								{currentIndex + 1}
								/
								{totalSiblings}
							</span>
							<button
								type="button"
								className={styles.pagerButton}
								onClick={onNextSibling}
								disabled={disabled || currentIndex >= totalSiblings - 1}
								aria-label="Next sibling message"
							>
								&gt;
							</button>
						</div>
					)}

					{showMetrics && (
						<div className={styles.metricsGroup}>
							{typeof tokens === "number" && (
								<span className={styles.metricBadge}>{formatTokens(tokens)}</span>
							)}
							{typeof durationMs === "number" && (
								<span className={styles.metricBadge}>{formatDuration(durationMs)}</span>
							)}
						</div>
					)}
				</div>

				<div className={styles.actionsGroup}>
					{content && (
						<button
							type="button"
							className={styles.actionButton}
							onClick={handleCopy}
							disabled={disabled}
							aria-label="Copy message"
						>
							{copied ? "Copied!" : "Copy"}
						</button>
					)}

					{onEdit && (
						<button
							type="button"
							className={styles.actionButton}
							onClick={onEdit}
							disabled={disabled}
							aria-label="Edit message"
						>
							Edit
						</button>
					)}

					{onRegenerate && isAssistant && (
						<button
							type="button"
							className={styles.actionButton}
							onClick={onRegenerate}
							disabled={disabled}
							aria-label="Regenerate message"
						>
							Regenerate
						</button>
					)}
				</div>
			</div>
		</div>
	);

}

export default memo(ChatMessageActionBar);
