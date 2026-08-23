import ChatMessageText from "@/components/messages/ChatMessageText.tsx";
import ChatMessageReasoning from "@/components/messages/ChatMessageReasoning.tsx";
import styles from "./ChatMessage.module.css";
import { memo } from "react";
import type { Message } from "@/shared/ai/message/node.ts";

interface Props {
	data: Message;
	generating?: boolean;
}

function ChatMessage(props: Readonly<Props>) {

	const content = props.data.data.content;
	let contentComponent = null;
	if (typeof content === "string") {
		contentComponent = (
			<ChatMessageText
				role={props.data.data.role}
				content={content}
			/>
		);
	}
	// else if (Array.isArray(content)) {
	// 	contentComponent = content.map((v, index) => {
	// 		switch (v.type) {
	// 			case "text": return (
	// 				<ChatMessageText
	// 					key={props.data.id + "_" + index}
	// 					role={props.data.data.role}
	// 					content={v.text}
	// 				/>
	// 			);
	// 			case "refusal": return (
	// 				<ChatMessageRefusalText
	// 					key={props.data.id + "_" + index}
	// 					role={props.data.data.role}
	// 					content={v.refusal}
	// 				/>
	// 			);
	// 			default: return null;
	// 		}
	// 	});
	// }

	return (
		<div
			className={styles.container}
			data-role={props.data.data.role}
		>
			{props.data.data.role === "assistant" && props.data.data.reasoning && <ChatMessageReasoning content={props.data.data.reasoning} />}
			{contentComponent}
			{props.generating && <p className={styles.generating}>Generating...</p>}
		</div>
	);

}

export default memo(ChatMessage);
