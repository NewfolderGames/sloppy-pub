import type { SessionEvent, WorldInstance } from "../types.ts";
import { saveInstance } from "../instance_manager.ts";

export interface AddSessionEventArgs {
	type: "narrative" | "character" | "system";
	summary: string;
	details?: string;
	timestamp?: number;
}

export interface ListSessionEventsArgs {
	type?: "narrative" | "character" | "system";
	limit?: number;
}

export interface EventToolResult {
	status: "success" | "error";
	message?: string;
	event?: SessionEvent;
	events?: SessionEvent[];
	count?: number;
}

export const ADD_SESSION_EVENT_TOOL = {
	type: "function",
	function: {
		name: "add_session_event",
		description: "Adds a key narrative, character, or system event to the session event log.",
		parameters: {
			type: "object",
			properties: {
				type: {
					type: "string",
					enum: ["narrative", "character", "system"],
					description: "The category of the event: narrative, character, or system.",
				},
				summary: {
					type: "string",
					description: "A concise summary of what occurred in the story or world.",
				},
				details: {
					type: "string",
					description: "Optional additional details or context about the event.",
				},
			},
			required: ["type", "summary"],
		},
	},
} as const;

export const LIST_SESSION_EVENTS_TOOL = {
	type: "function",
	function: {
		name: "list_session_events",
		description: "Lists recorded session events, optionally filtered by type.",
		parameters: {
			type: "object",
			properties: {
				type: {
					type: "string",
					enum: ["narrative", "character", "system"],
					description: "Optional category filter: narrative, character, or system.",
				},
				limit: {
					type: "number",
					description: "Optional maximum number of most recent events to retrieve.",
				},
			},
		},
	},
} as const;

export const EVENT_TOOL_DEFINITIONS = [
	ADD_SESSION_EVENT_TOOL,
	LIST_SESSION_EVENTS_TOOL,
] as const;

export const EVENT_TOOL_NAMES = new Set([
	"add_session_event",
	"list_session_events",
]);

// Helper Functions

export function addSessionEvent(
	instance: WorldInstance,
	input: AddSessionEventArgs,
): SessionEvent {

	if (!instance.events) {
		instance.events = [];
	}

	const event: SessionEvent = {
		id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		timestamp: input.timestamp ?? Date.now(),
		type: input.type,
		summary: input.summary.trim(),
		details: input.details?.trim(),
	};

	instance.events.push(event);
	saveInstance(instance);

	return event;

}

export function listSessionEvents(
	instance: WorldInstance,
	filter?: ListSessionEventsArgs,
): SessionEvent[] {

	let events = [...(instance.events || [])];

	if (filter?.type) {
		events = events.filter(e => e.type === filter.type);
	}

	if (typeof filter?.limit === "number" && filter.limit > 0) {
		events = events.slice(-filter.limit);
	}

	return events;

}

// Tool Execution

export function executeEventTool(
	toolName: string,
	args: unknown,
	instance: WorldInstance,
): EventToolResult {

	if (typeof args !== "object" || args === null) {
		return {
			status: "error",
			message: "Invalid arguments: expected an object.",
		};
	}

	const parsedArgs = args as Record<string, unknown>;

	if (toolName === "add_session_event") {
		const type = parsedArgs.type as string;
		if (type !== "narrative" && type !== "character" && type !== "system") {
			return {
				status: "error",
				message: `Invalid event type: "${type}". Must be "narrative", "character", or "system".`,
			};
		}

		const summary = parsedArgs.summary;
		if (typeof summary !== "string" || summary.trim().length === 0) {
			return {
				status: "error",
				message: "Event summary is required and cannot be empty.",
			};
		}

		const details = typeof parsedArgs.details === "string" ? parsedArgs.details : undefined;

		const event = addSessionEvent(instance, {
			type,
			summary,
			details,
		});

		return {
			status: "success",
			event,
			message: `Event added: ${event.summary}`,
		};
	}

	if (toolName === "list_session_events") {
		let typeFilter: "narrative" | "character" | "system" | undefined;
		if (typeof parsedArgs.type === "string") {
			if (parsedArgs.type === "narrative" || parsedArgs.type === "character" || parsedArgs.type === "system") {
				typeFilter = parsedArgs.type;
			}
		}

		const limit = typeof parsedArgs.limit === "number" ? parsedArgs.limit : undefined;

		const events = listSessionEvents(instance, {
			type: typeFilter,
			limit,
		});

		return {
			status: "success",
			events,
			count: events.length,
		};
	}

	return {
		status: "error",
		message: `Unknown event tool: "${toolName}".`,
	};

}
