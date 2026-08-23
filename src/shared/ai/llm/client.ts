import type { ChatCompletionChunk } from "@/shared/ai/llm/response.ts";
import type { ChatCompletionRequest } from "@/shared/ai/llm/request.ts";
import type { SSEEvent } from "@/shared/ai/llm/client_event.ts";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, ChatCompletionMessageToolCall } from "@/shared/ai/llm/common.ts";

export class OpenAIClient {

	private static instance: OpenAIClient;

	private constructor() {
	}

	public static getInstance(): OpenAIClient {
		if (!OpenAIClient.instance) OpenAIClient.instance = new OpenAIClient();
		return OpenAIClient.instance;
	}

	public static chunksToMessage(chunks: ChatCompletionChunk[]): ChatCompletionMessageParam {

		if (chunks.length === 0) {
			throw new Error("Cannot construct message from empty chunks array");
		}

		const role = chunks.find(c => c.choices[0]?.delta?.role)?.choices[0]?.delta?.role ?? "assistant";
		const lastChoice = chunks.at(-1)!.choices[0];

		const toolCallsMap = new Map<number, ChatCompletionMessageToolCall>();
		let content = "";

		for (const chunk of chunks) {
			for (const choice of chunk.choices) {
				if (choice.delta.content) {
					content += choice.delta.content;
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

		const sortedToolCalls = toolCallsMap.size > 0
			? Array.from(toolCallsMap.entries()).sort(([a], [b]) => a - b).map(([, call]) => call)
			: undefined;

		if (role === "assistant") {
			const assistantMessage: ChatCompletionAssistantMessageParam = {
				role: "assistant",
				content,
				refusal: lastChoice?.delta?.refusal ?? null,
				...(sortedToolCalls ? { tool_calls: sortedToolCalls } : {}),
			};

			return assistantMessage;
		}

		return {
			role: role as any,
			content,
		};

	}

	private static async* parseSSEStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent, void, unknown> {

		let buffer = "";
		let currentEvent: Partial<SSEEvent> = {};

		for await (const textChunk of OpenAIClient.decodeStreamChunks(stream)) {

			buffer += textChunk;

			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? "";

			for (const line of lines) {

				if (line.trim() === "") {
					if (currentEvent.data !== undefined) {
						yield currentEvent as SSEEvent;
						currentEvent = {};
					}
					continue;
				}

				if (line.startsWith(":")) {
					continue;
				}

				const { field, value } = OpenAIClient.parseSSELine(line);
				switch (field) {
					case "data":
						currentEvent.data = currentEvent.data
							? `${currentEvent.data}\n${value}`
							: value;
						break;
					case "event":
						currentEvent.event = value;
						break;
					case "id":
						currentEvent.id = value;
						break;
					case "retry": {
						const retryVal = Number.parseInt(value, 10);
						if (!Number.isNaN(retryVal)) currentEvent.retry = retryVal;
						break;
					}
				}
			}
		}

		if (currentEvent.data !== undefined) {
			yield currentEvent as SSEEvent;
		}

	}

	private static async* decodeStreamChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {

		const reader = stream.getReader();
		const decoder = new TextDecoder("utf-8");

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				yield decoder.decode(value, { stream: true });
			}
		}
		finally {
			reader.releaseLock();
		}

	}

	private static parseSSELine(line: string): { field: string; value: string } {

		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) return { field: line, value: "" };

		const field = line.slice(0, colonIndex);
		let value = line.slice(colonIndex + 1);

		if (value.startsWith(" ")) {
			value = value.slice(1);
		}

		return { field, value };

	}

	public async* streamChatCompletion(endpoint: string, apiKey: string, payload: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk, void, unknown> {

		const response = await fetch(`${endpoint}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ ...payload, stream: true }),
		});

		if (!response.ok || !response.body) {
			const errorText = await response.text();
			throw new Error(`HTTP error ${response.status}: ${errorText}`);
		}

		for await (const event of OpenAIClient.parseSSEStream(response.body)) {

			if (event.data === "[DONE]") break;

			const chunk: ChatCompletionChunk = JSON.parse(event.data);
			yield chunk;

		}

	}

}
