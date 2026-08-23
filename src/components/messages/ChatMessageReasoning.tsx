import Markdown from "react-markdown";
import styles from "./ChatMessageReasonging.module.css";

interface Props {
	content: string;
}

function ChatMessageReasoning(props: Readonly<Props>) {
	return (
		<div
			className={["chat-message-item", "chat-message-item-reasoning", styles.container].join(" ")}
		>
			<Markdown>{props.content}</Markdown>
		</div>
	);
}

export default ChatMessageReasoning;
