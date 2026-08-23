import { type HTMLAttributes, useMemo, useState } from "react";
import ChatMessage from "@/components/messages/ChatMessage.tsx";
import { WorldInfoDrawer } from "@/components/views/WorldInfoDrawer.tsx";
import type { Message } from "@/shared/ai/message/node.ts";
import type { MessageTreeManager } from "@/shared/ai/message/tree_manager.ts";
import type { WorldInstance, WorldStates } from "@/shared/world/types.ts";
import styles from "./ChatView.module.css";

interface Props extends Omit<HTMLAttributes<HTMLElement>, "onCopy"> {
	messages: Message[];
	messageGeneratingMessage: Message | null;
	generating?: boolean;
	onChoiceSelect?: (selection: string) => void;
	instance?: WorldInstance | null;
	activeStates?: WorldStates;
	treeManager?: MessageTreeManager;
	onRegenerate?: (messageId: string) => void | Promise<void>;
	onEdit?: (messageId: string, newContent: string) => void | Promise<void>;
	onRetry?: (messageId: string) => void | Promise<void>;
	onCopy?: (messageId: string) => void;
	onSelectSibling?: (siblingId: string) => void;
	isDrawerOpen?: boolean;
	onToggleDrawer?: () => void;
	onCloseDrawer?: () => void;
}

function ChatView(props: Readonly<Props>) {

	const {
		messages,
		messageGeneratingMessage,
		generating,
		onChoiceSelect,
		instance,
		activeStates,
		treeManager,
		onRegenerate,
		onEdit,
		onRetry,
		onCopy,
		onSelectSibling,
		isDrawerOpen: controlledDrawerOpen,
		onCloseDrawer,
		className,
		...rest
	} = props;

	const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
	const drawerOpen = controlledDrawerOpen ?? internalDrawerOpen;
	const handleCloseDrawer = onCloseDrawer ?? (() => setInternalDrawerOpen(false));

	const containerClassName = className ? `${styles.container} ${className}` : styles.container;

	const latestUserMessage = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			const m = messages[i];
			if (m.data?.role === "user" && typeof m.data.content === "string") {
				return m.data.content;
			}
		}
		return undefined;
	}, [messages]);

	return (
		<main className={containerClassName} {...rest}>
			{instance && (
				<header className={styles.chatHeader}>
					<div className={styles.sessionInfo}>
						<span className={styles.sessionTitle}>{instance.title}</span>
						<span className={styles.sessionMeta}>
							{instance.universeId
								? `Universe: ${instance.universeId} (${instance.universeMode})`
								: "Standalone World"}
						</span>
					</div>

				</header>
			)}

			{messages.map((message) => {
				const siblings = treeManager ? treeManager.getSiblings(message.id) : [];
				const siblingIndex = siblings.findIndex(s => s.id === message.id);
				const totalSiblings = siblings.length;
				const prevSiblingId = totalSiblings > 1 && siblingIndex > 0 ? siblings[siblingIndex - 1].id : undefined;
				const nextSiblingId = totalSiblings > 1 && siblingIndex < totalSiblings - 1 ? siblings[siblingIndex + 1].id : undefined;

				return (
					<ChatMessage
						key={message.id}
						data={message}
						onChoiceSelect={onChoiceSelect}
						disabled={generating}
						siblingIndex={siblingIndex >= 0 ? siblingIndex : 0}
						totalSiblings={totalSiblings}
						prevSiblingId={prevSiblingId}
						nextSiblingId={nextSiblingId}
						onSelectSibling={onSelectSibling}
						onRegenerate={onRegenerate}
						onEdit={onEdit}
						onRetry={onRetry ?? onRegenerate}
						onCopy={onCopy}
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
			<WorldInfoDrawer
				isOpen={drawerOpen}
				onClose={handleCloseDrawer}
				instance={instance ?? undefined}
				activeStates={activeStates}
				latestUserMessage={latestUserMessage}
			/>
		</main>
	);

}

export default ChatView;
