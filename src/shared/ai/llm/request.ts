import type { ChatCompletionMessageParam } from "@/shared/ai/llm/common.ts";

export interface ChatCompletionRequest {
	messages: ChatCompletionMessageParam[];
	model: string;
	frequency_penalty?: number | null;
	max_completion_tokens?: number | null;
	presence_penalty?: number | null;
	prompt_cache_key?: string | null;
	prompt_cache_options?: {
		mode?: "implicit" | "explicit";
		ttl?: "30m";
	};
	reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	response_format?: ResponseFormat | null;
	safety_identifier?: string | null;
	stop?: string | string[];
	stream?: boolean | null;
	stream_options?: {
		include_obfuscation?: boolean;
		include_usage?: boolean;
	};
	temperature?: number | null;
	tool_choice?: ChatCompletionToolChoiceOption;
	tools?: (ChatCompletionFunctionTool | ChatCompletionCustomTool)[];
	top_logprobs?: number | null;
	top_p?: number | null;
	verbosity?: "low" | "medium" | "high";
}

export type ResponseFormat = ResponseFormatJSONSchema | ResponseFormatText | ResponseFormatJSONObject;

export interface ResponseFormatText {
	type: "text";
}

export interface ResponseFormatJSONObject {
	type: "json_object";
}

export interface ResponseFormatJSONSchema {
	type: "json_schema";
	json_schema: {
		name: string;
		description?: string;
		schema?: Record<string, any>;
		strict?: boolean | null;
	};
}

export type ChatCompletionToolChoiceOption = ToolChoiceMode | ChatCompletionAllowedToolChoice;

export type ToolChoiceMode = "none" | "auto" | "required";

export interface ChatCompletionAllowedToolChoice {
	type: "allowed_tools";
	allowed_tools: ChatCompletionAllowedTools[];
}

export interface ChatCompletionAllowedTools {
	mode: "auto" | "required";
	tools: ChatCompletionTool[];
}

export type ChatCompletionTool = ChatCompletionFunctionTool | ChatCompletionCustomTool | ChatCompletionNamedToolChoice | ChatCompletionNamedToolChoiceCustom;

export interface ChatCompletionFunctionTool {
	type: "function";
	function: FunctionDefinition;
}

export interface FunctionDefinition {
	name: string;
	description?: string;
	parameters?: Record<string, any>;
	strict?: boolean | null;
}

export interface ChatCompletionCustomTool {
	type: "custom";
	custom: {
		name: string;
		description?: string;
		format?: {
			type: "text";
		} | {
			type: "grammar";
			grammar: {
				definition: string;
				syntax: "lark" | "regex";
			};
		};
	};
}

export interface ChatCompletionNamedToolChoice {
	type: "function";
	function: {
		name: string;
	};
}

export interface ChatCompletionNamedToolChoiceCustom {
	type: "custom";
	custom: {
		name: string;
	};
}
