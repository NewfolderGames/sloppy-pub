import Markdown from "react-markdown";
import type { ChatRole } from "@/shared/ai/llm/common.ts";
import { type ReactNode, useMemo } from "react";
import { parseRoleplayResponse } from "@/shared/ai/message/parser.ts";
import type { AppBlock, MessageBlock } from "@/shared/ai/message/types.ts";
import rehypeRaw from "rehype-raw";
import styles from "./ChatMessageText.module.css";

interface ChatMessageTextProps {
	role: ChatRole;
	content: string;
}

function ChatMessageText(props: Readonly<ChatMessageTextProps>) {

	const content = useMemo(() => {
		if (props.role !== "assistant") return {
			blocks: [
				{
					type: "app",
					hidden: false,
					content: props.content,
				} as AppBlock,
			],
		};
		return parseRoleplayResponse(props.content);
	}, [props.content, props.role]);

	return (
		<div
			className={["chat-message-item", "chat-message-item-text"].join(" ")}
			data-role={props.role}
		>
			{content.blocks.map((block, i) => <Block key={i} data={block} />)}
		</div>
	);
}

interface BlockProps {
	data: MessageBlock;
}

function Block(props: Readonly<BlockProps>) {

	let header: ReactNode;
	if (props.data.type === "character") {
		header = (
			<div className={[styles.blockHeader, "character-message-item-block-header"].join(" ")}>
				<div>{props.data.name}</div>
				<div>{props.data.id}</div>
			</div>
		);
	}
	else if (props.data.type === "system") {
		header = (
			<div className={[styles.blockHeader, "character-message-item-block-header"].join(" ")}>
				<div>SYSTEM</div>
			</div>
		);
	}
	else if (props.data.type === "app") {
		header = null;
	}
	else {
		header = (
			<div className={[styles.blockHeader, "character-message-item-block-header"].join(" ")}>
				<div>UNKNOWN</div>
			</div>
		);
	}

	return (

		<div
			className={[styles.block, "character-message-item-block"].join(" ")}
			data-type={props.data.type}
			data-hidden={props.data.hidden}
		>
			{header}
			<Markdown rehypePlugins={[rehypeRaw]}>
				{props.data.content}
			</Markdown>
		</div>
	);

}

export default ChatMessageText;
