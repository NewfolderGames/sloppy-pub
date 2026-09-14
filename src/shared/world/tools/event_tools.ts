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
