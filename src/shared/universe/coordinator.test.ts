import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { StateStore } from "../world/state_store.ts";
import { UniverseCoordinator } from "./coordinator.ts";

describe("UniverseCoordinator", () => {

	let coordinator: UniverseCoordinator;

	beforeEach(() => {

		coordinator = new UniverseCoordinator();

	});

	it("registers universe with initial rules and states", () => {

		coordinator.registerUniverse("neo-metropolis", {
			initialStates: {
				"world.crime_index": 45,
				"world.megacorp.war_active": false,
				"world.currency_name": "Credits",
			},
			rules: [
				"Megacorporations hold planetary sovereignty.",
				"The year is 2142.",
			],
			backgrounds: [
				"Neo Metropolis was founded after the Great Flood.",
				"Atmospheric scrubbers run at half capacity.",
			],
		});

		assert.equal(coordinator.hasUniverse("neo-metropolis"), true);
		assert.deepEqual(coordinator.getUniverseRules("neo-metropolis"), [
			"Megacorporations hold planetary sovereignty.",
			"The year is 2142.",
		]);
		assert.deepEqual(coordinator.getUniverseBackgrounds("neo-metropolis"), [
			"Neo Metropolis was founded after the Great Flood.",
			"Atmospheric scrubbers run at half capacity.",
		]);

		const states = coordinator.getUniverseStates("neo-metropolis");
		assert.equal(states["world.crime_index"], 45);
		assert.equal(states["world.megacorp.war_active"], false);
		assert.equal(states["world.currency_name"], "Credits");

	});

	it("supports isolated snapshot cloning without cross-session contamination", () => {

		coordinator.registerUniverse("cyber-universe", {
			initialStates: {
				"world.crime_index": 30,
				"world.weather": "Rain",
			},
		});

		// World Instance 1: Isolated
		const store1 = new StateStore({ "district.name": "District 9" });
		store1.attachUniverse({
			coordinator,
			universeId: "cyber-universe",
			mode: "isolated",
			instanceId: "inst-1",
		});

		// World Instance 2: Isolated
		const store2 = new StateStore({ "district.name": "District 12" });
		store2.attachUniverse({
			coordinator,
			universeId: "cyber-universe",
			mode: "isolated",
			instanceId: "inst-2",
		});

		assert.equal(store1.getState("world.crime_index"), 30);
		assert.equal(store2.getState("world.crime_index"), 30);

		// Mutate state in store 1
		store1.setState("world.crime_index", 99);

		assert.equal(store1.getState("world.crime_index"), 99);
		// store 2 and coordinator must remain unchanged
		assert.equal(store2.getState("world.crime_index"), 30);
		assert.equal(coordinator.getUniverseStates("cyber-universe")["world.crime_index"], 30);

	});

	it("propagates synchronized state updates across multiple connected instances", () => {

		coordinator.registerUniverse("shared-universe", {
			initialStates: {
				"world.threat_level": 1,
				"universe.global_peace": true,
			},
		});

		const storeA = new StateStore({ "district.id": "A" });
		storeA.attachUniverse({
			coordinator,
			universeId: "shared-universe",
			mode: "synchronized",
			instanceId: "inst-A",
		});

		const storeB = new StateStore({ "district.id": "B" });
		storeB.attachUniverse({
			coordinator,
			universeId: "shared-universe",
			mode: "synchronized",
			instanceId: "inst-B",
		});

		assert.equal(storeA.getState("world.threat_level"), 1);
		assert.equal(storeB.getState("world.threat_level"), 1);

		// Instance A updates world state
		storeA.setState("world.threat_level", 4, "War declared");

		// Instance B receives the update automatically
		assert.equal(storeB.getState("world.threat_level"), 4);
		assert.equal(coordinator.getUniverseStates("shared-universe")["world.threat_level"], 4);

		// Instance B updates universe state
		storeB.setState("universe.global_peace", false, "Ceasefire broken");

		// Instance A receives the update
		assert.equal(storeA.getState("universe.global_peace"), false);

		// Instance A updates local non-universe key (district.id)
		storeA.setState("district.alert", "Red");

		// Instance B does not receive local district key
		assert.equal(storeB.getState("district.alert"), undefined);

	});

	it("resolves Last-Write-Wins conflict resolution with sequence numbers and timestamps", () => {

		coordinator.registerUniverse("lww-universe", {
			initialStates: {
				"world.alert": 1,
			},
		});

		const initialRecord = coordinator.getStateRecord("lww-universe", "world.alert");
		assert.ok(initialRecord);
		assert.equal(initialRecord.version, 1);

		// Successive update advances version
		const update1 = coordinator.mutateState("lww-universe", "inst-1", "world.alert", 2);
		assert.equal(update1.applied, true);
		assert.equal(update1.currentRecord.version, 2);

		// Stale timestamp update is rejected / not applied
		const staleResult = coordinator.mutateState(
			"lww-universe",
			"inst-2",
			"world.alert",
			5,
			"Old update",
			undefined,
			update1.currentRecord.timestamp - 1000,
		);

		assert.equal(staleResult.applied, false);
		assert.equal(coordinator.getUniverseStates("lww-universe")["world.alert"], 2);

		// Newer timestamp succeeds
		const newerResult = coordinator.mutateState(
			"lww-universe",
			"inst-3",
			"world.alert",
			10,
			"New update",
			undefined,
			update1.currentRecord.timestamp + 1000,
		);

		assert.equal(newerResult.applied, true);
		assert.equal(coordinator.getUniverseStates("lww-universe")["world.alert"], 10);

	});

	it("executes atomic patch in coordinator with type safety", () => {

		coordinator.registerUniverse("patch-universe", {
			initialStates: {
				"world.crime_index": 20,
				"world.market_open": true,
			},
		});

		const patchResult = coordinator.mutatePatch("patch-universe", "inst-1", {
			"world.crime_index": 50,
			"world.market_open": false,
		});

		assert.equal(patchResult.appliedCount, 2);
		assert.equal(coordinator.getUniverseStates("patch-universe")["world.crime_index"], 50);
		assert.equal(coordinator.getUniverseStates("patch-universe")["world.market_open"], false);

		// Failed patch with type error does not mutate
		assert.throws(
			() =>
				coordinator.mutatePatch("patch-universe", "inst-1", {
					"world.crime_index": 80,
					"world.market_open": "not-a-boolean",
				}),
			/Type mismatch for key 'world.market_open'/,
		);

		assert.equal(coordinator.getUniverseStates("patch-universe")["world.crime_index"], 50);

	});

});
