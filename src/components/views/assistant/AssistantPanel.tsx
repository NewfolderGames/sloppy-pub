import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import ChatMessage from "../../../components/messages/ChatMessage.tsx";
import { useAssistantSession } from "@/shared/ai/assistance/use_assistant_session.ts";
import type { AssistantDiffPayload, AssistantTab } from "@/shared/ai/assistance/types.ts";
import { AssistantDiffCard } from "./AssistantDiffCard.tsx";
import styles from "./AssistantPanel.module.css";

export interface AssistantPanelProps {
	className?: string;
	tab: AssistantTab;
	activeId: string | null;
	rawToml?: string;
	summary?: Record<string, unknown>;
	onApplyDiff?: (payload: AssistantDiffPayload) => void;
	isOpen: boolean;
	onClose: () => void;
}

const TAB_SUGGESTIONS: Record<AssistantTab, string[]> = {
	"world-manager": [
		"Draft a new protagonist with dialogue and backstory",
		"Create a hidden dungeon location with atmospheric lore",
		"Suggest a rival faction with clear motivations",
	],
	"universe-manager": [
		"Suggest a unique magical decay rule",
		"Draft background cosmology lore",
		"Add initial state variables for world factions",
	],
	"character-manager": [
		"Expand this character's psychological profile",
		"Add a structured background about their origin",
		"Draft example dialog that matches their voice",
	],
	"lore": [
		"Add a static lore entry for the capital city",
		"Create a dynamic entry triggered by dragon keywords",
		"Suggest keywords and priority for existing entries",
	],
	"settings": [
		"Draft a creative world-builder prompt",
		"Create guidelines for concise prose",
		"Suggest formatted item card templates",
	],
};

const TAB_TITLES: Record<AssistantTab, string> = {
	"world-manager": "World Wizard",
	"universe-manager": "Universe Wizard",
	"character-manager": "Character Wizard",
	"lore": "Lore Wizard",
	"settings": "Settings Wizard",
};

export function AssistantPanel(props: Readonly<AssistantPanelProps>) {

	const {
		tab,
		activeId,
		rawToml,
		summary,
		onApplyDiff,
		isOpen,
		onClose,
	} = props;

	const {
		messages,
		generating,
		messageGeneratingMessage,
		stagedMap,
		onSubmit,
		onChoiceSelect,
		onApplyDiff: handleApplyDiff,
		onRejectDiff: handleRejectDiff,
		onClearHistory,
	} = useAssistantSession({
		tab,
		activeId,
		rawToml,
		summary,
		onApplyDiff,
	});

	const [inputText, setInputText] = useState("");
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	// Auto scroll to bottom
	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, messageGeneratingMessage, isOpen]);

	const handleSend = () => {

		const trimmed = inputText.trim();
		if (!trimmed || generating) {
			return;
		}

		onSubmit(trimmed);
		setInputText("");

	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}

	};

	const suggestions = TAB_SUGGESTIONS[tab] || TAB_SUGGESTIONS["world-manager"];
	const title = TAB_TITLES[tab] || "Wizard";

	if (!isOpen) {
		return null;
	}

	return (
		<aside className={`${styles.panel} ${props.className ?? ""}`} data-testid="assistant-panel" data-tab={tab}>
			<header className={styles.header}>
				<div className={styles.headerTitleGroup}>
					<span className={styles.tabBadge}>{tab}</span>
					<h3 className={styles.headerTitle}>{title}</h3>
				</div>

				<div className={styles.headerActions}>
					<button
						type="button"
						className={styles.clearButton}
						onClick={onClearHistory}
						disabled={generating || messages.length === 0}
						title="Clear assistant chat history"
					>
						Clear
					</button>

					<button
						type="button"
						className={styles.closeButton}
						onClick={onClose}
						title="Close Wizard"
					>
						✕
					</button>
				</div>
			</header>

			<div className={styles.messageList}>
				{messages.length === 0 && !messageGeneratingMessage && (
					<div className={styles.emptyState}>
						<h4 className={styles.emptyTitle}>
							How can I help with this
							{" "}
							{tab.replace("-", " ")}
							?
						</h4>
						<p className={styles.emptyDescription}>
							Ask for ideas, rule extensions, or configuration updates. The assistant will propose visual diffs before applying changes.
						</p>

						<div className={styles.suggestionList}>
							{suggestions.map((s, idx) => (
								<button
									key={idx}
									type="button"
									className={styles.suggestionButton}
									onClick={() => onSubmit(s)}
								>
									💬
									{" "}
									{s}
								</button>
							))}
						</div>
					</div>
				)}

				{messages.map((message) => {
					if (message.data.role === "tool" && message.data.tool_call_id) {
						const staged = stagedMap.get(message.data.tool_call_id);
						if (staged) {
							return (
								<AssistantDiffCard
									key={message.id}
									payload={staged}
									onApply={() => handleApplyDiff(staged.toolCallId)}
									onReject={() => handleRejectDiff(staged.toolCallId)}
									disabled={generating}
								/>
							);
						}
					}

					return (
						<ChatMessage
							key={message.id}
							data={message}
							onChoiceSelect={onChoiceSelect}
							disabled={generating}
						/>
					);
				})}

				{messageGeneratingMessage && (
					<ChatMessage
						data={messageGeneratingMessage}
						generating={generating}
						disabled={true}
					/>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div className={styles.inputArea}>
				<textarea
					className={styles.textarea}
					placeholder={`Ask ${title}... (Enter to send, Shift+Enter for newline)`}
					value={inputText}
					onChange={e => setInputText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={generating}
				/>

				<div className={styles.inputFooter}>
					<span className={styles.inputHint}>
						{generating ? "Assistant is thinking..." : "Ready"}
					</span>

					<button
						type="button"
						className={styles.sendButton}
						onClick={handleSend}
						disabled={generating || !inputText.trim()}
					>
						{generating ? "Generating..." : "Send"}
					</button>
				</div>
			</div>
		</aside>
	);

}

export default AssistantPanel;
