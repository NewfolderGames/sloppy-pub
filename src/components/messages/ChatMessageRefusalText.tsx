import Markdown from "react-markdown";
import type { ChatRole } from "@/shared/ai/llm/common.ts";

interface Props {
	role: ChatRole;
	content: string;
}

function ChatMessageRefusalText(props: Readonly<Props>) {
	return (
		<div
			className={["chat-message-item", "chat-message-item-refusal"].join(" ")}
			data-role={props.role}
		>
			<Markdown>
				{props.content}
			</Markdown>
		</div>
	);
}

export default ChatMessageRefusalText;
