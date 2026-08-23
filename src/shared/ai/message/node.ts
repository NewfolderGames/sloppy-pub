import { chatRoles } from "@/shared/ai/llm/common.ts";
import type { ChatCompletionChunk } from "@/shared/ai/llm/response.ts";

export interface Message {
	id: string;
	isRequest?: boolean;
	isHidden?: boolean;
	finishReason: string;
	data: MessageDataSystem | MessageDataUser | MessageDataAssistant;
}

export interface MessageDataSystem {
	role: typeof chatRoles[0];
	content: string;
}

export interface MessageDataUser {
	role: typeof chatRoles[1];
	content: string;
}

export interface MessageDataAssistant {
	role: typeof chatRoles[2];
	content: string;
	reasoning?: string;
	refusal?: string | null;
}

export function chunksToMessage(chunks: ChatCompletionChunk[]): Message {

	const message: Message = {
		id: chunks[0].id,
		finishReason: chunks.at(-1)!.choices[0].finish_reason,
		data: {
			role: chunks[0].choices[0].delta.role! as any,
			content: "",
			reasoning: undefined,
			refusal: undefined,
		},
	};

	for (const chunk of chunks) {
		for (const choice of chunk.choices) {
			if (choice.delta.content) message.data.content += choice.delta.content;
			if (choice.delta.reasoning_content && message.data.role === "assistant") {
				if (!message.data.reasoning) message.data.reasoning = "";
				message.data.reasoning += choice.delta.reasoning_content;
			}
			// if (choice.delta.tool_calls) {
			// 	if ("tool_calls" in message.rawData) {
			// 		message.rawData.tool_calls!.push(choice.delta.tool_calls);
			// 	}
			// }
		}
	}

	return message;

}
