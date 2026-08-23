import type { WorldStates } from "../../world/types.ts";
import type { ChatCompletionMessageToolCall } from "../llm/common.ts";
import { chatRoles } from "../llm/common.ts";
import type { ChatCompletionChunk } from "../llm/response.ts";
import type { MessageNode } from "./types.ts";

export interface MessageMetadata {
	tokens?: number;
	durationMs?: number;
	error?: string;
}

export interface Message {
	id: string;
	isRequest?: boolean;
	isHidden?: boolean;
	finishReason: string;
	metadata?: MessageMetadata;
	data: MessageDataSystem | MessageDataUser | MessageDataAssistant | MessageDataTool;
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
	tool_calls?: ChatCompletionMessageToolCall[];
}

export interface MessageDataTool {
	role: typeof chatRoles[3];
	content: string;
	tool_call_id: string;
}

export function createMessageNode(
	message: Message,
	parentId: string | null = null,
	stateSnapshot?: WorldStates,
): MessageNode {

	return {
		id: message.id,
		parentId,
		childrenIds: [],
		message,
		...(stateSnapshot ? { stateSnapshot: { ...stateSnapshot } } : {}),
		createdAt: Date.now(),
	};

}

export function chunksToMessage(chunks: ChatCompletionChunk[]): Message {

	if (chunks.length === 0) {
		throw new Error("Cannot construct message from empty chunks array");
	}

	const role = chunks.find(c => c.choices[0]?.delta?.role)?.choices[0]?.delta?.role ?? "assistant";
	const lastChoice = chunks.at(-1)!.choices[0];
	const finishReasonChoice = chunks
		.flatMap(c => c.choices)
		.findLast(ch => ch?.finish_reason != null);

	const message: Message = {
		id: chunks[0].id,
		finishReason: finishReasonChoice?.finish_reason ?? lastChoice?.finish_reason ?? "stop",
		data: {
			role: role as any,
			content: "",
			reasoning: undefined,
			refusal: undefined,
		},
	};

	const toolCallsMap = new Map<number, ChatCompletionMessageToolCall>();

	for (const chunk of chunks) {

		if (chunk.usage) {
			const tokens = chunk.usage.total_tokens ?? chunk.usage.completion_tokens;

			if (tokens !== undefined) {
				message.metadata = {
					...(message.metadata ?? {}),
					tokens,
				};
			}
		}

		for (const choice of chunk.choices) {
			if (choice.delta.content) {
				message.data.content += choice.delta.content;
			}

			if (choice.delta.reasoning_content && message.data.role === "assistant") {
				if (!message.data.reasoning) {
					message.data.reasoning = "";
				}
				message.data.reasoning += choice.delta.reasoning_content;
			}

			if (choice.delta.tool_calls) {
				const deltas = Array.isArray(choice.delta.tool_calls)
					? choice.delta.tool_calls
					: [choice.delta.tool_calls];

				for (let index = 0; index < deltas.length; index++) {
					const delta = deltas[index];
					const callIndex = delta.index ?? index;

					if (!toolCallsMap.has(callIndex)) {
						toolCallsMap.set(callIndex, {
							id: delta.id ?? "",
							type: (delta.type as "function") ?? "function",
							function: {
								name: delta.function?.name ?? "",
								arguments: delta.function?.arguments ?? "",
							},
						});
					}
					else {
						const existing = toolCallsMap.get(callIndex)!;

						if (delta.id) {
							existing.id = delta.id;
						}
						if (delta.type) {
							existing.type = delta.type as "function";
						}
						if (delta.function?.name) {
							existing.function.name += delta.function.name;
						}
						if (delta.function?.arguments) {
							existing.function.arguments += delta.function.arguments;
						}
					}
				}
			}
		}
	}

	if (toolCallsMap.size > 0 && message.data.role === "assistant") {
		const sortedCalls = Array.from(toolCallsMap.entries())
			.sort(([a], [b]) => a - b)
			.map(([, call]) => call);

		(message.data as MessageDataAssistant).tool_calls = sortedCalls;
	}

	return message;

}

export function calculateMessageTokens(message: Message): number {

	if (message.metadata?.tokens !== undefined) {
		return message.metadata.tokens;
	}

	let textLength = 0;

	if (message.data.content) {
		textLength += message.data.content.length;
	}

	if (message.data.role === "assistant") {
		if (message.data.reasoning) {
			textLength += message.data.reasoning.length;
		}

		if (message.data.tool_calls) {
			for (const tc of message.data.tool_calls) {
				textLength += tc.function.name.length + tc.function.arguments.length;
			}
		}
	}

	return textLength > 0 ? Math.max(1, Math.ceil(textLength / 4)) : 0;

}
