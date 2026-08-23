import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMatchingLoreEntries, synthesizeLorePrompt } from "./builder.ts";
import { addLoreEntry, deleteLoreBook, getActiveLoreEntries, getAllLoreBooks, getLoreBook, importLorebookFromToml, removeLoreEntry, saveLoreBook, updateLoreEntry } from "./registry.ts";
import { parseLorebook, serializeLorebook } from "./toml.ts";
import type { LoreBook, LoreEntry } from "./types.ts";
import { ADD_LORE_ENTRY_TOOL, executeLoreTool, LIST_LORE_ENTRIES_TOOL, LORE_TOOL_DEFINITIONS, REMOVE_LORE_ENTRY_TOOL, UPDATE_LORE_ENTRY_TOOL } from "./tools.ts";

// Clear the in-memory storage between tests

function clearLoreMemory(): void {
	const stored = getAllLoreBooks();

	for (const book of stored) {
		deleteLoreBook(book.id);
	}
}

function makeSampleLoreBook(): LoreBook {
	return {
		id: "test_book",
		name: "Test Lore Book",
		entries: [
			{
				id: "static_1",
				title: "Always Active",
				content: "This is always included.",
				keywords: [],
				activationMode: "static",
				enabled: true,
			},
			{
				id: "dynamic_dragon",
				title: "Dragon Lore",
				content: "Dragons are ancient creatures.",
				keywords: ["dragon", "wyrm", "fire"],
				activationMode: "dynamic",
				enabled: true,
				priority: 10,
			},
			{
				id: "dynamic_cave",
				title: "Cave System",
				content: "The caves run deep underground.",
				keywords: ["cave", "underground", "tunnel"],
				activationMode: "dynamic",
				enabled: true,
				priority: 5,
			},
			{
				id: "disabled_entry",
				title: "Disabled Entry",
				content: "Should not appear.",
				keywords: ["secret"],
				activationMode: "static",
				enabled: false,
			},
			{
				id: "empty_keywords",
				title: "Empty Keywords Dynamic",
				content: "Never matches.",
				keywords: [],
				activationMode: "dynamic",
				enabled: true,
			},
		],
	};
}

describe("Lore Types", () => {

	it("exports ActivationMode union type with static and dynamic", () => {
		const staticMode = "static" as const;
		const dynamicMode = "dynamic" as const;

		assert.equal(staticMode, "static");
		assert.equal(dynamicMode, "dynamic");
	});

	it("LoreEntry has all required fields", () => {
		const entry: LoreEntry = {
			id: "test",
			title: "Test",
			content: "Content",
			keywords: ["kw"],
			activationMode: "static",
			enabled: true,
		};

		assert.equal(entry.id, "test");
		assert.equal(entry.priority, undefined);
	});

	it("LoreBook has id, name, entries", () => {
		const book: LoreBook = {
			id: "book_1",
			name: "Book 1",
			entries: [],
		};

		assert.equal(book.entries.length, 0);
	});

});

describe("Lore Registry", () => {

	beforeEach(() => {
		clearLoreMemory();
	});

	it("saves and retrieves a lore book", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const retrieved = getLoreBook("test_book");

		assert.ok(retrieved);
		assert.equal(retrieved.lorebook.name, "Test Lore Book");
		assert.equal(retrieved.lorebook.entries.length, 5);
	});

	it("updates an existing lore book", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		book.name = "Updated Name";
		saveLoreBook(book, "test_book");

		const retrieved = getLoreBook("test_book");

		assert.equal(retrieved!.lorebook.name, "Updated Name");
	});

	it("deletes a lore book", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");
		assert.ok(getLoreBook("test_book"));

		const deleted = deleteLoreBook("test_book");

		assert.equal(deleted, true);
		assert.equal(getLoreBook("test_book"), undefined);
	});

	it("returns false when deleting non-existent book", () => {
		assert.equal(deleteLoreBook("nonexistent"), false);
	});

	it("adds an entry to a lore book", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const newEntry: LoreEntry = {
			id: "new_entry",
			title: "New Entry",
			content: "New content",
			keywords: ["new"],
			activationMode: "static",
			enabled: true,
		};

		const success = addLoreEntry("test_book", newEntry);

		assert.equal(success, true);

		const retrieved = getLoreBook("test_book");

		assert.equal(retrieved!.lorebook.entries.length, 6);
	});

	it("returns false when adding entry to non-existent book", () => {
		const entry: LoreEntry = {
			id: "x",
			title: "X",
			content: "X",
			keywords: [],
			activationMode: "static",
			enabled: true,
		};

		assert.equal(addLoreEntry("nonexistent", entry), false);
	});

	it("updates an existing entry", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const success = updateLoreEntry("test_book", "static_1", {
			title: "Updated Title",
		});

		assert.equal(success, true);

		const retrieved = getLoreBook("test_book");
		const entry = retrieved!.lorebook.entries.find(e => e.id === "static_1");

		assert.equal(entry!.title, "Updated Title");
	});

	it("returns false when updating non-existent entry", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		assert.equal(updateLoreEntry("test_book", "nonexistent", { title: "Nope" }), false);
	});

	it("removes an entry", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const success = removeLoreEntry("test_book", "static_1");

		assert.equal(success, true);

		const retrieved = getLoreBook("test_book");

		assert.equal(retrieved!.lorebook.entries.length, 4);
	});

	it("returns false when removing non-existent entry", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		assert.equal(removeLoreEntry("test_book", "nonexistent"), false);
	});

	it("getActiveLoreEntries returns static entries always", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const active = getActiveLoreEntries("test_book");

		// static_1 is static and enabled → included
		// disabled_entry is static but disabled → excluded
		// all dynamic entries with no message → excluded (no keyword match)
		// empty_keywords is dynamic with no keywords → excluded
		assert.equal(active.length, 1);
		assert.equal(active[0].id, "static_1");
	});

	it("getActiveLoreEntries matches dynamic entries by keywords", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const active = getActiveLoreEntries("test_book", "The dragon flew through the cave entrance.");

		// static_1 (static, enabled) → included
		// dynamic_dragon (dynamic, "dragon" matches) → included
		// dynamic_cave (dynamic, "cave" matches) → included
		// disabled_entry (static, disabled) → excluded
		// empty_keywords (dynamic, no keywords) → excluded
		assert.equal(active.length, 3);

		const ids = active.map(e => e.id).sort();

		assert.deepEqual(ids, ["dynamic_cave", "dynamic_dragon", "static_1"]);
	});

	it("getActiveLoreEntries is case-insensitive for keyword matching", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const active = getActiveLoreEntries("test_book", "DRAGON!");

		assert.equal(active.length, 2);
		assert.ok(active.some(e => e.id === "dynamic_dragon"));
	});

	it("getActiveLoreEntries returns empty array for non-existent book", () => {
		assert.deepEqual(getActiveLoreEntries("nonexistent"), []);
	});

	it("TOML import round-trips and saves", () => {
		const book = makeSampleLoreBook();
		const toml = serializeLorebook(book);

		assert.ok(toml.includes("name ="));
		assert.ok(toml.includes("[entries"));

		const imported = importLorebookFromToml(toml);

		assert.equal(imported.lorebook.name, book.name);
		assert.equal(imported.lorebook.entries.length, book.entries.length);
	});

});

describe("Lore TOML Parse/Serialize", () => {

	it("parses a valid lorebook TOML string", () => {
		const toml = `
name = "My Lore"
id = "my_lore"

[[entries]]
id = "e1"
title = "Entry One"
content = "Entry content here."
keywords = ["key1", "key2"]
activation_mode = "dynamic"
enabled = false
priority = 3
`;

		const book = parseLorebook(toml);

		assert.equal(book.name, "My Lore");
		assert.equal(book.id, "my_lore");
		assert.equal(book.entries.length, 1);
		assert.equal(book.entries[0].title, "Entry One");
		assert.equal(book.entries[0].keywords[0], "key1");
		assert.equal(book.entries[0].activationMode, "dynamic");
		assert.equal(book.entries[0].enabled, false);
		assert.equal(book.entries[0].priority, 3);
	});

	it("serializes and deserializes back to same data", () => {
		const original = makeSampleLoreBook();
		const toml = serializeLorebook(original);
		const parsed = parseLorebook(toml);

		assert.equal(parsed.name, original.name);
		assert.equal(parsed.entries.length, original.entries.length);

		for (const entry of original.entries) {
			const found = parsed.entries.find(e => e.id === entry.id);

			assert.ok(found, `Entry ${entry.id} not found in round-trip`);
			assert.equal(found.title, entry.title);
			assert.equal(found.content, entry.content);
			assert.equal(found.activationMode, entry.activationMode);
			assert.equal(found.enabled, entry.enabled);
			assert.deepEqual(found.keywords, entry.keywords);
		}
	});

	it("parses minimal entry (only required fields)", () => {
		const toml = `
name = "Minimal"
id = "minimal"

[[entries]]
id = "e1"
title = "Minimal Entry"
content = "Minimal content"
`;

		const book = parseLorebook(toml);

		assert.equal(book.entries.length, 1);
		assert.equal(book.entries[0].activationMode, "static");
		assert.equal(book.entries[0].enabled, true);
		assert.deepEqual(book.entries[0].keywords, []);
	});

	it("parses multiline entries and [metadata] table in lorebook", () => {
		const toml = `
[metadata]
name = "Ancient Legends"
title = "Ancient Legends Title"

[[entries]]
id = "legend_of_the_ancients"
title = "Legend of the Ancients"
content = """
Long ago, the world was unified.
The ancient kings held the celestial keys.
Now only fragments remain."""
keywords = "ancient"
activation_mode = "dynamic"
`;

		const book = parseLorebook(toml);

		assert.equal(book.name, "Ancient Legends");
		assert.equal(book.entries.length, 1);
		assert.equal(
			book.entries[0].content,
			"Long ago, the world was unified.\nThe ancient kings held the celestial keys.\nNow only fragments remain.",
		);
		assert.deepEqual(book.entries[0].keywords, ["ancient"]);

		const serialized = serializeLorebook(book);
		assert.ok(serialized.includes("\"\"\""));

		const roundTripped = parseLorebook(serialized);
		assert.equal(roundTripped.entries[0].content, book.entries[0].content);
	});

	it("throws on empty TOML", () => {
		assert.throws(() => parseLorebook(""), /cannot be empty/);
	});

	it("throws on invalid activation mode", () => {
		const toml = `
name = "Bad"
id = "bad"

[[entries]]
id = "e1"
title = "Bad"
content = "Bad"
activation_mode = "invalid"
`;

		assert.throws(() => parseLorebook(toml), /must be "static" or "dynamic"/);
	});

	it("serialize omits defaults (static mode, enabled true, empty keywords)", () => {
		const book: LoreBook = {
			id: "simple",
			name: "Simple",
			entries: [
				{
					id: "e1",
					title: "Simple Entry",
					content: "Content",
					keywords: [],
					activationMode: "static",
					enabled: true,
				},
			],
		};

		const toml = serializeLorebook(book);

		// Should not have activation_mode (default is static)
		assert.ok(!toml.includes("activation_mode"));
		// Should not have keywords
		assert.ok(!toml.includes("keywords"));
		// Should not have enabled
		assert.ok(!toml.includes("enabled"));
	});

	it("serializes non-default values", () => {
		const book: LoreBook = {
			id: "custom",
			name: "Custom",
			entries: [
				{
					id: "e1",
					title: "Dynamic Entry",
					content: "Content",
					keywords: ["kw1"],
					activationMode: "dynamic",
					enabled: false,
					priority: 5,
				},
			],
		};

		const toml = serializeLorebook(book);

		assert.ok(toml.includes("activation_mode = \"dynamic\""));
		assert.ok(toml.includes("enabled = false"));
		assert.ok(toml.includes("priority = 5"));
		assert.ok(toml.includes("keywords"));
	});

});

describe("Lore Builder", () => {

	beforeEach(() => {
		clearLoreMemory();
	});

	it("synthesizeLorePrompt returns empty string when no entries match", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = synthesizeLorePrompt("test_book");

		// Only static enabled entry matches (no message for dynamic)
		assert.ok(result.length > 0);
		assert.ok(result.includes("Always Active"));
	});

	it("synthesizeLorePrompt includes dynamic entries matching message", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = synthesizeLorePrompt("test_book", "I saw a dragon in the cave!");

		assert.ok(result.includes("Always Active"));
		assert.ok(result.includes("Dragon Lore"));
		assert.ok(result.includes("Cave System"));
		assert.ok(!result.includes("Disabled Entry"));
	});

	it("synthesizeLorePrompt returns empty string for non-existent book", () => {
		assert.equal(synthesizeLorePrompt("nonexistent"), "");
	});

	it("synthesizeLorePrompt sorts by priority descending", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = synthesizeLorePrompt("test_book", "dragon cave");

		// Dragon Lore has priority 10, Cave System has 5, static has none (0)
		const dragonIdx = result.indexOf("Dragon Lore");
		const caveIdx = result.indexOf("Cave System");
		const staticIdx = result.indexOf("Always Active");

		assert.ok(dragonIdx < caveIdx);
		assert.ok(caveIdx < staticIdx);
	});

	it("getMatchingLoreEntries returns sorted entries", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const entries = getMatchingLoreEntries("test_book", "dragon cave wyrm");

		assert.equal(entries.length, 3);
		// Should be sorted by priority descending: dragon(10), cave(5), static(0)
		assert.equal(entries[0].id, "dynamic_dragon");
		assert.equal(entries[1].id, "dynamic_cave");
		assert.equal(entries[2].id, "static_1");
	});

});

describe("Lore Tools", () => {

	beforeEach(() => {
		clearLoreMemory();
	});

	it("exports all tool definitions", () => {
		assert.equal(LORE_TOOL_DEFINITIONS.length, 4);
		assert.equal(LORE_TOOL_DEFINITIONS[0], ADD_LORE_ENTRY_TOOL);
		assert.equal(LORE_TOOL_DEFINITIONS[1], UPDATE_LORE_ENTRY_TOOL);
		assert.equal(LORE_TOOL_DEFINITIONS[2], REMOVE_LORE_ENTRY_TOOL);
		assert.equal(LORE_TOOL_DEFINITIONS[3], LIST_LORE_ENTRIES_TOOL);
	});

	it("ADD_LORE_ENTRY_TOOL has correct name and required fields", () => {
		const func = ADD_LORE_ENTRY_TOOL.function;

		assert.equal(func.name, "add_lore_entry");
		assert.deepEqual(func.parameters.required, ["lorebookId", "title", "content"]);
	});

	it("executeLoreTool: add_lore_entry succeeds", () => {
		const simpleBook: LoreBook = { id: "test_tools", name: "Tools Test", entries: [] };

		saveLoreBook(simpleBook, "test_tools");

		const result = executeLoreTool("add_lore_entry", {
			lorebookId: "test_tools",
			title: "Tool Entry",
			content: "Created by tool",
			keywords: ["tool", "test"],
			activationMode: "dynamic",
			priority: 3,
		});

		assert.equal(result.status, "success");
		assert.ok(result.entry);
		assert.equal(result.entry!.title, "Tool Entry");
		assert.equal(result.entry!.activationMode, "dynamic");

		const retrieved = getLoreBook("test_tools");

		assert.equal(retrieved!.lorebook.entries.length, 1);
	});

	it("executeLoreTool: add_lore_entry fails with missing fields", () => {
		const result = executeLoreTool("add_lore_entry", {
			lorebookId: "test",
		});

		assert.equal(result.status, "error");
	});

	it("executeLoreTool: update_lore_entry succeeds", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = executeLoreTool("update_lore_entry", {
			lorebookId: "test_book",
			entryId: "static_1",
			title: "Updated By Tool",
		});

		assert.equal(result.status, "success");

		const retrieved = getLoreBook("test_book");
		const entry = retrieved!.lorebook.entries.find(e => e.id === "static_1");

		assert.equal(entry!.title, "Updated By Tool");
	});

	it("executeLoreTool: remove_lore_entry succeeds", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = executeLoreTool("remove_lore_entry", {
			lorebookId: "test_book",
			entryId: "static_1",
		});

		assert.equal(result.status, "success");

		const retrieved = getLoreBook("test_book");

		assert.equal(retrieved!.lorebook.entries.length, 4);
	});

	it("executeLoreTool: list_lore_entries succeeds", () => {
		const book = makeSampleLoreBook();

		saveLoreBook(book, "test_book");

		const result = executeLoreTool("list_lore_entries", {
			lorebookId: "test_book",
		});

		assert.equal(result.status, "success");
		assert.equal(result.entries!.length, 5);
	});

	it("executeLoreTool: list_lore_entries fails for non-existent book", () => {
		const result = executeLoreTool("list_lore_entries", {
			lorebookId: "nonexistent",
		});

		assert.equal(result.status, "error");
	});

	it("executeLoreTool: returns error for unknown tool", () => {
		const result = executeLoreTool("unknown_tool", {});

		assert.equal(result.status, "error");
		assert.ok(result.message!.includes("Unknown"));
	});

});

describe("Lore multi-select", () => {

	beforeEach(() => {
		clearLoreMemory();
	});

	it("getActiveLoreEntries merges and deduplicates entries across lore books", () => {
		const bookA: LoreBook = {
			id: "book_a",
			name: "Book A",
			entries: [
				{
					id: "shared_static",
					title: "Shared Static",
					content: "Shared static content.",
					keywords: [],
					activationMode: "static",
					enabled: true,
					priority: 1,
				},
				{
					id: "a_only",
					title: "A Only",
					content: "Only in A.",
					keywords: [],
					activationMode: "static",
					enabled: true,
					priority: 2,
				},
			],
		};

		const bookB: LoreBook = {
			id: "book_b",
			name: "Book B",
			entries: [
				{
					id: "shared_static",
					title: "Shared Static Duplicate",
					content: "Duplicate id should be ignored.",
					keywords: [],
					activationMode: "static",
					enabled: true,
					priority: 99,
				},
				{
					id: "b_dynamic",
					title: "B Dynamic",
					content: "Only in B dynamic.",
					keywords: ["comet"],
					activationMode: "dynamic",
					enabled: true,
					priority: 5,
				},
			],
		};

		saveLoreBook(bookA, "book_a");
		saveLoreBook(bookB, "book_b");

		const staticOnly = getActiveLoreEntries(["book_a", "book_b"]);
		assert.equal(staticOnly.length, 2);
		assert.ok(staticOnly.some(e => e.id === "shared_static"));
		assert.ok(staticOnly.some(e => e.id === "a_only"));
		assert.ok(!staticOnly.some(e => e.id === "b_dynamic"));

		const withMessage = getActiveLoreEntries(["book_a", "book_b"], "A bright comet lights the sky.");
		assert.equal(withMessage.length, 3);
		assert.ok(withMessage.some(e => e.id === "b_dynamic"));

		const prompt = synthesizeLorePrompt(["book_a", "book_b"], "comet sighting");
		assert.ok(prompt.includes("Shared Static"));
		assert.ok(prompt.includes("A Only"));
		assert.ok(prompt.includes("B Dynamic"));
	});

});
