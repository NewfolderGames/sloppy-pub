import type { ChatCompletionMessageToolCall, ChatRole } from "@/shared/ai/llm/common.ts";

export interface ChatCompletion {
	id: string;
	choices: ChatCompletionChoice[];
	created: number;
	model: string;
	object: "chat.completion";
	usage?: CompletionUsage;
}

export interface ChatCompletionChoice {
	finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call";
	index: number;
	message: ChatCompletionMessage;
}

export interface ChatCompletionMessage {
	content: string | null;
	refusal: string | null;
	role: ChatRole[3];
	tool_calls: ChatCompletionMessageToolCall[];
}

export interface CompletionUsage {
	completion_tokens: number;
	prompt_tokens: number;
	total_tokens: number;
}

// Stream

export interface ChatCompletionChunkToolCallDelta {
	index?: number;
	id?: string;
	type?: "function";
	function?: {
		name?: string;
		arguments?: string;
	};
}

export interface ChatCompletionChunk {
	id: string;
	choices: ChatCompletionChoiceChunk[];
	created: number;
	model: string;
	object: "chat.completion.chunk";
	usage?: CompletionUsage;
}

export interface ChatCompletionChoiceChunk {
	delta: {
		content?: string | null;
		refusal?: string | null;
		role?: ChatRole;
		reasoning_content?: string | null;
		tool_calls?: ChatCompletionChunkToolCallDelta[] | ChatCompletionChunkToolCallDelta;
	};
	finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
	index: number;
}
