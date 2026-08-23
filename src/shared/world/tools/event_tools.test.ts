import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getInstance } from "../instance_manager.ts";
import type { WorldInstance } from "../types.ts";
import { addSessionEvent, executeEventTool, listSessionEvents } from "./event_tools.ts";

function createTestInstance(id: string): WorldInstance {
	const now = Date.now();

	return {
		id,
		title: "Event Test",
		worldId: "event-test-world",
		universeMode: "isolated",
		injectedVars: {},
		messageTreeData: null,
		activeStates: {},
		createdAt: now,
		updatedAt: now,
	};
}

describe("Session Event Tools", () => {
	it("adds and persists a session event", () => {
		const instance = createTestInstance(`event-persistence-${Date.now()}`);

		const event = addSessionEvent(instance, {
			type: "character",
			summary: "  Mira leaves the station.  ",
			details: "  She takes the eastern route.  ",
			timestamp: 123,
		});

		assert.equal(event.summary, "Mira leaves the station.");
		assert.equal(event.details, "She takes the eastern route.");
		assert.deepEqual(getInstance(instance.id)?.events, [event]);
	});

	it("filters events by type and returns the latest limited events", () => {
		const instance = createTestInstance(`event-filter-${Date.now()}`);

		addSessionEvent(instance, { type: "system", summary: "System event", timestamp: 1 });
		addSessionEvent(instance, { type: "narrative", summary: "First narrative", timestamp: 2 });
		addSessionEvent(instance, { type: "narrative", summary: "Second narrative", timestamp: 3 });

		assert.deepEqual(
			listSessionEvents(instance, { type: "narrative", limit: 1 }).map(event => event.summary),
			["Second narrative"],
		);
	});

	it("executes event tools and rejects invalid add arguments", () => {
		const instance = createTestInstance(`event-dispatch-${Date.now()}`);

		const invalid = executeEventTool("add_session_event", {
			type: "unknown",
			summary: "Invalid",
		}, instance);

		assert.equal(invalid.status, "error");
		assert.equal(instance.events, undefined);

		const added = executeEventTool("add_session_event", {
			type: "narrative",
			summary: "A valid event",
		}, instance);

		assert.equal(added.status, "success");
		assert.equal(added.event?.summary, "A valid event");

		const listed = executeEventTool("list_session_events", { limit: 1 }, instance);

		assert.equal(listed.status, "success");
		assert.equal(listed.count, 1);
		assert.equal(listed.events?.[0].summary, "A valid event");
	});
});
