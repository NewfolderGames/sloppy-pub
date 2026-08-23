import { useEffect, useState } from "react";
import type { Message } from "./node.ts";
import { MessageTreeManager } from "./tree_manager.ts";
import type { MessageNode } from "./types.ts";

export interface UseMessageTreeResult {
	manager: MessageTreeManager;
	headId: string | null;
	head: MessageNode | null;
	path: MessageNode[];
	messages: Message[];
}

export function useMessageTree(
	manager: MessageTreeManager = MessageTreeManager.getInstance(),
): UseMessageTreeResult {

	const [state, setState] = useState(() => {
		return {
			headId: manager.getHeadId(),
			head: manager.getHead(),
			path: manager.getPath(),
			messages: manager.getMessages(),
		};
	});

	const [prevManager, setPrevManager] = useState(manager);

	if (prevManager !== manager) {
		setPrevManager(manager);
		setState({
			headId: manager.getHeadId(),
			head: manager.getHead(),
			path: manager.getPath(),
			messages: manager.getMessages(),
		});
	}

	useEffect(() => {

		const updateState = () => {
			setState({
				headId: manager.getHeadId(),
				head: manager.getHead(),
				path: manager.getPath(),
				messages: manager.getMessages(),
			});
		};

		updateState();

		const unsubscribe = manager.subscribe(updateState);

		return () => {
			unsubscribe();
		};

	}, [manager]);

	return {
		manager,
		headId: state.headId,
		head: state.head,
		path: state.path,
		messages: state.messages,
	};

}
