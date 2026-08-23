import Markdown from "react-markdown";
import type { ChatRole } from "@/shared/ai/llm/common.ts";
import { type ReactNode, useMemo } from "react";
import { parseRoleplayResponse } from "@/shared/ai/message/parser.ts";
import type { AppBlock, MessageBlock } from "@/shared/ai/message/types.ts";
import rehypeRaw from "rehype-raw";
import ChatMessageChoice from "./ChatMessageChoice.tsx";
import styles from "./ChatMessageText.module.css";

interface ChatMessageTextProps {
	role: ChatRole;
	content: string;
	onChoiceSelect?: (selection: string) => void;
	disabled?: boolean;
}

function ChatMessageText(props: Readonly<ChatMessageTextProps>) {

	const content = useMemo(() => {
		if (props.role === "tool") {
			let formatted: string;

			try {
				formatted = `\`\`\`json\n${JSON.stringify(JSON.parse(props.content), null, 2)}\n\`\`\``;
			}
			catch {
				formatted = props.content;
			}

			return {
				blocks: [
					{
						type: "app",
						hidden: false,
						content: formatted,
					} as AppBlock,
				],
			};
		}

		if (props.role !== "assistant" && props.role !== "user") return {
			blocks: [
				{
					type: "app",
					hidden: false,
					content: props.content,
				} as AppBlock,
			],
		};

		if (props.role === "user") {
			const parsed = parseRoleplayResponse(props.content);
			if (parsed.blocks.length > 0) {
				return parsed;
			}

			return {
				blocks: [
					{
						type: "app",
						hidden: false,
						content: props.content,
					} as AppBlock,
				],
			};
		}

		return parseRoleplayResponse(props.content);
	}, [props.content, props.role]);

	return (
		<div
			className={["chat-message-item", "chat-message-item-text"].join(" ")}
			data-role={props.role}
		>
			{content.blocks.map((block, i) => (
				<Block
					key={i}
					data={block}
					onChoiceSelect={props.onChoiceSelect}
					disabled={props.disabled}
				/>
			))}
		</div>
	);
}

interface BlockProps {
	data: MessageBlock;
	onChoiceSelect?: (selection: string) => void;
	disabled?: boolean;
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
				<div />
			</div>
		);
	}
	else if (props.data.type === "choice") {
		header = (
			<div className={[styles.blockHeader, "character-message-item-block-header"].join(" ")}>
				<div>CHOICE</div>
				<div />
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
				<div />
			</div>
		);
	}

	if (props.data.type === "choice") {
		return (
			<div
				className={[styles.block, "character-message-item-block"].join(" ")}
				data-type={props.data.type}
				data-hidden={props.data.hidden}
			>
				{header}
				<ChatMessageChoice
					data={props.data}
					onSelect={props.onChoiceSelect}
					disabled={props.disabled}
				/>
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
