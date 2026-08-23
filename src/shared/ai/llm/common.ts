// Part

export type ChatCompletionContentPart = ChatCompletionContentPartText | ChatCompletionContentPartAudio | ChatCompletionContentPartInputAudio | FileContentPart;

export interface ChatCompletionContentPartText {
	type: "text";
	text: string;
}

export interface ChatCompletionContentPartAudio {
	type: "image_url";
	image_url: {
		url: string;
		detail: "auto" | "low" | "high";
	};
}

export interface ChatCompletionContentPartInputAudio {
	type: "input_audio";
	input_audio: {
		data: string;
		format: "wav" | "mp3";
	};
}

export interface FileContentPart {
	type: "file";
	input_audio: {
		file_data?: string;
		file_id?: string;
		file_name?: string;
	};
}

export interface ChatCompletionContentPartRefusal {
	type: "refusal";
	refusal: string;
}

// Message

export const chatRoles = ["system", "user", "assistant", "tool", "function"] as const;
export type ChatRole = typeof chatRoles[number];

export type ChatCompletionMessageParam = ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam | ChatCompletionToolMessageParam | ChatCompletionFunctionMessageParam;

export interface ChatCompletionSystemMessageParam {
	role: typeof chatRoles[0];
	content: string | ChatCompletionContentPartText[];
	name?: string;
}

export interface ChatCompletionUserMessageParam {
	role: typeof chatRoles[1];
	content: string | ChatCompletionContentPart[];
	name?: string;
}

export interface ChatCompletionAssistantMessageParam {
	role: typeof chatRoles[2];
	content?: string | (ChatCompletionContentPartText | ChatCompletionContentPartRefusal)[];
	name?: string;
	refusal?: string | null;
	tool_calls?: (ChatCompletionMessageToolCall | ChatCompletionMessageCustomToolCall)[];
}

export interface ChatCompletionToolMessageParam {
	role: typeof chatRoles[3];
	content: string | ChatCompletionContentPartText[];
	tool_call_id: string;
}

export interface ChatCompletionFunctionMessageParam {
	role: typeof chatRoles[4];
	content: string | null;
	name: string;
}

export interface ChatCompletionMessageToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface ChatCompletionMessageCustomToolCall {
	id: string;
	type: "custom";
	function: {
		name: string;
		input: string;
	};
}
