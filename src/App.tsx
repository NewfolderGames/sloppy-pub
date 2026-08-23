import { useCallback, useRef, useState } from "react";
import AppHeader from "@/components/layouts/AppHeader.tsx";
import AppInput from "@/components/layouts/AppInput.tsx";
import AssistantPanel from "@/components/views/assistant/AssistantPanel.tsx";
import { CharacterManagerView } from "@/components/views/CharacterManagerView.tsx";
import ChatView from "@/components/views/ChatView.tsx";
import { LoreManagerView } from "@/components/views/LoreManagerView.tsx";
import InstanceManagerView from "@/components/views/InstanceManagerView.tsx";
import SettingsView from "@/components/views/settings/SettingsView.tsx";
import UniverseManagerView from "@/components/views/UniverseManagerView.tsx";
import WorldManagerView from "@/components/views/WorldManagerView.tsx";
import type { AssistantDiffPayload, AssistantTab } from "@/shared/ai/assistance/types.ts";
import { useChatSession } from "@/shared/ai/message/use_chat_session.ts";
import { ensureDefaultInstance, getInstance } from "@/shared/world/instance_manager.ts";
import type { AppTab, WorldInstance } from "@/shared/world/types.ts";
import styles from "./App.module.css";

function App() {

	const [activeTab, setActiveTab] = useState<AppTab>("chat");
	const [activeInstance, setActiveInstance] = useState<WorldInstance>(() => ensureDefaultInstance());
	const [isAssistantOpen, setIsAssistantOpen] = useState(false);
	const [isWorldInfoOpen, setIsWorldInfoOpen] = useState(false);

	const [worldContext, setWorldContext] = useState<{ activeId: string | null; rawToml: string; summary?: Record<string, unknown> }>({
		activeId: null,
		rawToml: "",
	});
	const [universeContext, setUniverseContext] = useState<{ activeId: string | null; rawToml: string; summary?: Record<string, unknown> }>({
		activeId: null,
		rawToml: "",
	});
	const [characterContext, setCharacterContext] = useState<{ activeId: string | null; rawToml: string; summary?: Record<string, unknown> }>({
		activeId: null,
		rawToml: "",
	});
	const [loreContext, setLoreContext] = useState<{ activeId: string | null; rawToml: string; summary?: Record<string, unknown> }>({
		activeId: null,
		rawToml: "",
	});
	const [settingsContext, setSettingsContext] = useState<{ activeId: string | null; rawToml: string; summary?: Record<string, unknown> }>({
		activeId: "prompts",
		rawToml: "",
	});

	const worldApplyDiffRef = useRef<((proposedToml: string) => void) | null>(null);
	const universeApplyDiffRef = useRef<((proposedToml: string) => void) | null>(null);
	const characterApplyDiffRef = useRef<((proposedToml: string) => void) | null>(null);
	const loreApplyDiffRef = useRef<((proposedToml: string) => void) | null>(null);
	const settingsApplyDiffRef = useRef<((payload: AssistantDiffPayload) => void) | null>(null);

	const handleApplyDiff = useCallback((payload: AssistantDiffPayload) => {
		if (payload.tab === "world-manager") {
			worldApplyDiffRef.current?.(payload.proposedText);
		}
		else if (payload.tab === "universe-manager") {
			universeApplyDiffRef.current?.(payload.proposedText);
		}
		else if (payload.tab === "character-manager") {
			characterApplyDiffRef.current?.(payload.proposedText);
		}
		else if (payload.tab === "lore") {
			loreApplyDiffRef.current?.(payload.proposedText);
		}
		else if (payload.tab === "settings") {
			settingsApplyDiffRef.current?.(payload);
		}
	}, []);

	const isAssistantSupported = activeTab === "world-manager"
		|| activeTab === "universe-manager"
		|| activeTab === "character-manager"
		|| activeTab === "lore"
		|| activeTab === "settings";

	const currentAssistantTab: AssistantTab = activeTab === "world-manager"
		? "world-manager"
		: activeTab === "universe-manager"
			? "universe-manager"
			: activeTab === "character-manager"
				? "character-manager"
				: activeTab === "lore"
					? "lore"
					: "settings";

	const currentAssistantContext = currentAssistantTab === "world-manager"
		? worldContext
		: currentAssistantTab === "universe-manager"
			? universeContext
			: currentAssistantTab === "character-manager"
				? characterContext
				: currentAssistantTab === "lore"
					? loreContext
					: settingsContext;

	const {
		session,
		messages,
		messageGeneratingMessage,
		generating,
		activeStates,
		onChoiceSelect,
		onSubmit,
		onRegenerateMessage,
		onEditMessage,
		onRetryMessage,
	} = useChatSession(activeInstance);

	const handleSelectSibling = useCallback((siblingId: string) => {
		if (generating) {
			return;
		}

		let targetNode = session.treeManager.getNode(siblingId);
		while (targetNode && targetNode.childrenIds.length > 0) {
			const lastChildId = targetNode.childrenIds[targetNode.childrenIds.length - 1];
			const child = session.treeManager.getNode(lastChildId);
			if (!child) {
				break;
			}
			targetNode = child;
		}

		const targetId = targetNode ? targetNode.id : siblingId;
		session.treeManager.setHead(targetId);
	}, [generating, session]);

	// Session Switching
	const handleSelectInstance = useCallback((instanceId: string) => {
		const targetInstance = getInstance(instanceId);
		if (!targetInstance) {
			return;
		}

		setActiveInstance(targetInstance);
		setActiveTab("chat");
	}, []);

	return (
		<div
			className={`${styles.app} ${isAssistantOpen && isAssistantSupported ? styles.appWithAssistant : ""}`.trim()}
			data-active-tab={activeTab}
		>
			<AppHeader
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				isAssistantOpen={isAssistantOpen}
				onToggleAssistant={() => setIsAssistantOpen(prev => !prev)}
			/>
			<ChatView
				data-tab="chat"
				className={styles.appView}
				messages={messages}
				messageGeneratingMessage={messageGeneratingMessage}
				generating={generating}
				onChoiceSelect={onChoiceSelect}
				instance={activeInstance}
				activeStates={activeStates}
				treeManager={session.treeManager}
				onRegenerate={onRegenerateMessage}
				onEdit={onEditMessage}
				onRetry={onRetryMessage}
				onSelectSibling={handleSelectSibling}
				isDrawerOpen={isWorldInfoOpen}
				onToggleDrawer={() => setIsWorldInfoOpen(prev => !prev)}
				onCloseDrawer={() => setIsWorldInfoOpen(false)}
			/>
			<div data-tab="world-manager" className={styles.appView}>
				<WorldManagerView
					onEditorContextChange={setWorldContext}
					applyDiffCallbackRef={worldApplyDiffRef}
				/>
			</div>
			<div data-tab="universe-manager" className={styles.appView}>
				<UniverseManagerView
					onEditorContextChange={setUniverseContext}
					applyDiffCallbackRef={universeApplyDiffRef}
				/>
			</div>
			<div data-tab="character-manager" className={styles.appView}>
				<CharacterManagerView
					onEditorContextChange={setCharacterContext}
					applyDiffCallbackRef={characterApplyDiffRef}
				/>
			</div>
			<div data-tab="lore" className={styles.appView}>
				<LoreManagerView
					onEditorContextChange={setLoreContext}
					applyDiffCallbackRef={loreApplyDiffRef}
				/>
			</div>
			<div data-tab="instances" className={styles.appView}>
				<InstanceManagerView
					activeInstanceId={activeInstance.id}
					onSelectInstance={handleSelectInstance}
					onNavigateTab={tab => setActiveTab(tab)}
				/>
			</div>
			<div data-tab="settings" className={styles.appView}>
				<SettingsView
					onEditorContextChange={setSettingsContext}
					applyDiffCallbackRef={settingsApplyDiffRef}
				/>
			</div>
			<section className={styles.appInput} data-tab="chat">
				<AppInput
					onSubmit={onSubmit}
					onOpenWorldInfo={() => setIsWorldInfoOpen(prev => !prev)}
				/>
			</section>
			<section className={styles.appLeft}></section>
			<section className={styles.appRight}></section>
			{isAssistantSupported && (
				<AssistantPanel
					className={styles.appAssistant}
					tab={currentAssistantTab}
					activeId={currentAssistantContext.activeId}
					rawToml={currentAssistantContext.rawToml}
					summary={currentAssistantContext.summary}
					onApplyDiff={handleApplyDiff}
					isOpen={isAssistantOpen}
					onClose={() => setIsAssistantOpen(false)}
				/>
			)}
		</div>
	);

}

export default App;
