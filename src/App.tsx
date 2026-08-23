import { type SubmitEvent, useCallback, useMemo, useRef, useState } from "react";
import type { ChatCompletionChunk } from "@/shared/ai/llm/response.ts";
import { type ChatCompletionMessageParam } from "@/shared/ai/llm/common.ts";
import { OpenAIClient } from "@/shared/ai/llm/client.ts";
import ChatMessage from "@/components/messages/ChatMessage.tsx";
import AppInput from "@/components/layouts/AppInput.tsx";
import styles from "./App.module.css";
import { chunksToMessage, type Message } from "@/shared/ai/message/node.ts";
import prompt_05 from "@/assets/prompts/05_response.md?raw";

function App() {

	const [messageGenerated, setMessageGenerated] = useState<Message[]>([]);
	const [messageGenerating, setMessageGenerating] = useState<ChatCompletionChunk[] | null>(null);
	const messageRef = useRef<Map<string, ChatCompletionMessageParam>>(new Map());

	const onSubmit = useCallback(async (e: SubmitEvent<HTMLFormElement>) => {

		e.preventDefault();

		const formData = new FormData(e.target);
		const sendMessage = formData.get("content")?.toString() ?? "";
		const sendRole = formData.get("role")?.toString() ?? "";
		const sendType = (e.nativeEvent.submitter as any).value!;
		if (!sendMessage || !sendRole) return;

		if (sendType === "attach") {
			const id = crypto.randomUUID();
			setMessageGenerated(v => [...v, {
				id: id,
				isRequest: true,
				finishReason: "app",
				data: {
					role: sendRole as any,
					content: sendMessage,
				},
			}]);
			messageRef.current.set(id, {
				role: sendRole as any,
				content: sendMessage,
			});
			return;
		}

		const id = crypto.randomUUID();
		const sendMessageParam = {
			role: sendRole as any,
			content: sendMessage,
		};

		if (sendType == "continue") {
			sendMessageParam.role = "system";
			sendMessageParam.content = "continue the next turn";
		}

		setMessageGenerating([]);
		setMessageGenerated(v => [...v, {
			id: id,
			isRequest: true,
			finishReason: "app",
			data: {
				role: sendRole as any,
				content: sendMessage,
			},
		}]);

		const params = messageGenerated.map(v => messageRef.current.get(v.id)!);
		params.push(sendMessageParam, {
			role: "system",
			content: prompt_05,
		});
		messageRef.current.set(id, {
			role: sendRole as any,
			content: sendMessage,
		});

		const api = OpenAIClient.getInstance().streamChatCompletion(
			"http://localhost:8080",
			import.meta.env.VITE_API_KEY,
			{
				frequency_penalty: undefined,
				max_completion_tokens: undefined,
				messages: params,
				model: "",
				presence_penalty: undefined,
				prompt_cache_key: undefined,
				prompt_cache_options: {},
				reasoning_effort: undefined,
				response_format: undefined,
				safety_identifier: undefined,
				stop: undefined,
				stream: true,
				stream_options: {},
				temperature: undefined,
				tool_choice: undefined,
				tools: [],
				top_logprobs: undefined,
				top_p: undefined,
				verbosity: undefined,
			});

		const chunks: ChatCompletionChunk[] = [];
		for await (const chunk of api) {
			chunks.push(chunk);
			setMessageGenerating(v => !v ? [chunk] : [...v, chunk]);
		}

		if (chunks.length === 0) {
			setMessageGenerating(null);
			return;
		}

		const chunk = chunksToMessage(chunks);
		setMessageGenerating(null);
		setMessageGenerated(v => [...v, chunk]);
		messageRef.current.set(chunk.id, {
			role: sendRole as any,
			content: chunk.data.content,
		});

	}, [messageGenerated]);

	const messageGeneratingMessage: Message | null = useMemo(() => {
		if (!messageGenerating || messageGenerating.length === 0) return null;
		return chunksToMessage(messageGenerating);
	}, [messageGenerating]);

	return (
		<div className={styles.app}>
			<header className={styles.appHeader}></header>
			<main className={styles.appChat}>
				{messageGenerated.map(message => <ChatMessage key={message.id} data={message} />)}
				{messageGeneratingMessage && <ChatMessage data={messageGeneratingMessage} generating={!!messageGenerating} />}
			</main>
			<section className={styles.appInput}>
				<AppInput onSubmit={onSubmit} />
			</section>
			<section className={styles.appLeft}></section>
			<section className={styles.appRight}></section>
		</div>
	);

}

export default App;
