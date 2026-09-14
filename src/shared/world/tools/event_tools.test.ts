import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getInstance } from "../instance_manager.ts";
import type { WorldInstance } from "../types.ts";
import { addSessionEvent, listSessionEvents } from "./event_tools.ts";

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
});
