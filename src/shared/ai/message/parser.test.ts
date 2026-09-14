import { describe, it } from "node:test";
import assert from "node:assert";
import {
	formatTurnInstruction,
	parseCommands,
	parseJsonSchemaResponse,
	parseRoleplayResponse,
	parseStateValue,
	stripCommandTags,
} from "./parser.ts";
import type { CharacterBlock, ChoiceBlock, SystemBlock } from "./types.ts";

describe("parseRoleplayResponse", () => {

	it("parses character dialog with id and name", () => {

		const input = `<character id="1234" name="Kittens">
Hello there. Nice to meet you! *I wonder what they want...*
</character>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");

		const block = result.blocks[0] as CharacterBlock;
		assert.strictEqual(block.id, "1234");
		assert.strictEqual(block.name, "Kittens");
		assert.strictEqual(block.hidden, false);
		assert.strictEqual(block.content, "Hello there. Nice to meet you! *I wonder what they want...*");

	});

	it("parses user-tagged and app-tagged character messages", () => {

		const userInput = `<character id="USER">
Hello from the user.
</character>`;
		const userResult = parseRoleplayResponse(userInput);
		assert.strictEqual(userResult.blocks.length, 1);
		assert.strictEqual(userResult.blocks[0].type, "character");
		const userBlock = userResult.blocks[0] as CharacterBlock;
		assert.strictEqual(userBlock.id, "USER");
		assert.strictEqual(userBlock.content, "Hello from the user.");

		const appInput = `<character id="APP">
continue the next turn
</character>`;
		const appResult = parseRoleplayResponse(appInput);
		assert.strictEqual(appResult.blocks.length, 1);
		assert.strictEqual(appResult.blocks[0].type, "character");
		const appBlock = appResult.blocks[0] as CharacterBlock;
		assert.strictEqual(appBlock.id, "APP");
		assert.strictEqual(appBlock.content, "continue the next turn");

	});

	it("parses choice selection wrapped in APP character tag", () => {

		const choiceInput = `<character id="APP">Explore the ancient ruins</character>`;
		const result = parseRoleplayResponse(choiceInput);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");

		const block = result.blocks[0] as CharacterBlock;
		assert.strictEqual(block.id, "APP");
		assert.strictEqual(block.content, "Explore the ancient ruins");

	});

	it("parses multiple character tags in user-role message", () => {

		const multiInput = `<character id="USER">
Part one of my statement.
</character>
<character id="USER">
Part two of my statement.
</character>`;
		const result = parseRoleplayResponse(multiInput);

		assert.strictEqual(result.blocks.length, 2);
		assert.strictEqual(result.blocks[0].type, "character");
		assert.strictEqual(result.blocks[1].type, "character");

		const block1 = result.blocks[0] as CharacterBlock;
		const block2 = result.blocks[1] as CharacterBlock;
		assert.strictEqual(block1.id, "USER");
		assert.strictEqual(block1.content, "Part one of my statement.");
		assert.strictEqual(block2.id, "USER");
		assert.strictEqual(block2.content, "Part two of my statement.");

	});

	it("parses hidden character dialog", () => {

		const input = `<character id="1234" name="Kittens" hidden="true">
I am speaking real quietly... *Looks away.*
</character>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");

		const block = result.blocks[0] as CharacterBlock;
		assert.strictEqual(block.id, "1234");
		assert.strictEqual(block.name, "Kittens");
		assert.strictEqual(block.hidden, true);
		assert.strictEqual(block.content, "I am speaking real quietly... *Looks away.*");

	});

	it("parses system event", () => {

		const input = `<system>
It started to rain heavily outside.
</system>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "system");

		const block = result.blocks[0] as SystemBlock;
		assert.strictEqual(block.hidden, false);
		assert.strictEqual(block.content, "It started to rain heavily outside.");

	});

	it("parses hidden system event", () => {

		const input = `<system hidden="true">
The knights arrived at the door, waiting for the right time to walk in.
</system>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "system");

		const block = result.blocks[0] as SystemBlock;
		assert.strictEqual(block.hidden, true);
		assert.strictEqual(block.content, "The knights arrived at the door, waiting for the right time to walk in.");

	});

	it("parses single-select choices", () => {

		const input = `<choices mode="single">
  <choice>Explore the ancient ruins</choice>
  <choice>Return to the village</choice>
  <choice>Camp here for the night</choice>
</choices>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "choice");

		const choiceBlock = result.blocks[0] as ChoiceBlock;
		assert.strictEqual(choiceBlock.hidden, false);
		assert.strictEqual(choiceBlock.multiple, false);
		assert.strictEqual(choiceBlock.allowCustomInput, true);
		assert.strictEqual(choiceBlock.options.length, 3);
		assert.strictEqual(choiceBlock.options[0].id, "opt-1");
		assert.strictEqual(choiceBlock.options[0].text, "Explore the ancient ruins");
		assert.strictEqual(choiceBlock.options[1].id, "opt-2");
		assert.strictEqual(choiceBlock.options[1].text, "Return to the village");
		assert.strictEqual(choiceBlock.options[2].id, "opt-3");
		assert.strictEqual(choiceBlock.options[2].text, "Camp here for the night");

	});

	it("parses multi-select choices with multiple and multi modes", () => {

		const inputMultiple = `<choices mode="multiple">
  <choice>Take the rusty sword</choice>
  <choice>Take the healing potion</choice>
  <choice>Take the gold coins</choice>
</choices>`;

		const resultMultiple = parseRoleplayResponse(inputMultiple);

		assert.strictEqual(resultMultiple.blocks.length, 1);
		const choiceBlockMultiple = resultMultiple.blocks[0] as ChoiceBlock;
		assert.strictEqual(choiceBlockMultiple.multiple, true);
		assert.strictEqual(choiceBlockMultiple.hidden, false);
		assert.strictEqual(choiceBlockMultiple.options.length, 3);

		const inputMulti = `<choices mode="multi" hidden="true">
  <choice>Secret choice</choice>
</choices>`;

		const resultMulti = parseRoleplayResponse(inputMulti);

		assert.strictEqual(resultMulti.blocks.length, 1);
		const choiceBlockMulti = resultMulti.blocks[0] as ChoiceBlock;
		assert.strictEqual(choiceBlockMulti.multiple, true);
		assert.strictEqual(choiceBlockMulti.hidden, true);
		assert.strictEqual(choiceBlockMulti.options.length, 1);
		assert.strictEqual(choiceBlockMulti.options[0].text, "Secret choice");

	});

	it("parses turn action for system and character targets", () => {

		const systemTurnInput = `<turn target="SYSTEM" />`;
		const systemResult = parseRoleplayResponse(systemTurnInput);
		assert.deepStrictEqual(systemResult.nextTurn, { type: "system" });

		const userTurnInput = `<turn target="USER" />`;
		const userResult = parseRoleplayResponse(userTurnInput);
		assert.deepStrictEqual(userResult.nextTurn, { type: "user" });

		const characterTurnInput = `<turn target="1234" name="Kittens" />`;
		const characterResult = parseRoleplayResponse(characterTurnInput);
		assert.deepStrictEqual(characterResult.nextTurn, {
			type: "character",
			id: "1234",
			name: "Kittens",
		});

		const charNoNameInput = `<turn target="5678" />`;
		const charNoNameResult = parseRoleplayResponse(charNoNameInput);
		assert.deepStrictEqual(charNoNameResult.nextTurn, {
			type: "character",
			id: "5678",
		});

	});

	it("parses combined response with character dialog, choices, and turn action", () => {

		const input = `<character id="123" name="Alice">
What would you like to do next?
</character>
<choices mode="single">
  <choice>Enter the castle</choice>
  <choice>Turn back</choice>
</choices>
<turn target="SYSTEM" />
<character id="999" name="Ignored">
Discarded text
</character>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 2);
		assert.strictEqual(result.blocks[0].type, "character");
		assert.strictEqual(result.blocks[1].type, "choice");

		const choiceBlock = result.blocks[1] as ChoiceBlock;
		assert.strictEqual(choiceBlock.options.length, 2);
		assert.strictEqual(choiceBlock.options[0].text, "Enter the castle");
		assert.strictEqual(choiceBlock.options[1].text, "Turn back");

		assert.deepStrictEqual(result.nextTurn, { type: "system" });

	});

	it("handles unclosed tags during streaming", () => {

		const streamingChar = `<character id="123" name="Kittens">Hello world in progress`;
		const charResult = parseRoleplayResponse(streamingChar);

		assert.strictEqual(charResult.blocks.length, 1);
		assert.strictEqual(charResult.blocks[0].type, "character");
		assert.strictEqual(charResult.blocks[0].content, "Hello world in progress");

		const streamingChoices = `<choices mode="single"><choice>Option A</choice><choice>Option B`;
		const choiceResult = parseRoleplayResponse(streamingChoices);

		assert.strictEqual(choiceResult.blocks.length, 1);
		const choiceBlock = choiceResult.blocks[0] as ChoiceBlock;
		assert.strictEqual(choiceBlock.options.length, 2);
		assert.strictEqual(choiceBlock.options[0].text, "Option A");
		assert.strictEqual(choiceBlock.options[1].text, "Option B");

		const streamingMultiple = `<character id="1" name="Alice">Hello<system>World`;
		const multipleResult = parseRoleplayResponse(streamingMultiple);

		assert.strictEqual(multipleResult.blocks.length, 2);
		assert.strictEqual(multipleResult.blocks[0].type, "character");
		assert.strictEqual(multipleResult.blocks[0].content, "Hello");
		assert.strictEqual(multipleResult.blocks[1].type, "system");
		assert.strictEqual(multipleResult.blocks[1].content, "World");

	});

	it("handles empty choice block and whitespace in attributes", () => {

		const emptyChoiceInput = `<choices></choices>`;
		const emptyChoiceResult = parseRoleplayResponse(emptyChoiceInput);

		assert.strictEqual(emptyChoiceResult.blocks.length, 1);
		const emptyBlock = emptyChoiceResult.blocks[0] as ChoiceBlock;
		assert.strictEqual(emptyBlock.options.length, 0);

		const whitespaceAttrInput = `<character   id = "456"   name = "Bob and Alice"   hidden = "true"  >
Hello!
</character>`;
		const whitespaceResult = parseRoleplayResponse(whitespaceAttrInput);

		assert.strictEqual(whitespaceResult.blocks.length, 1);
		const charBlock = whitespaceResult.blocks[0] as CharacterBlock;
		assert.strictEqual(charBlock.id, "456");
		assert.strictEqual(charBlock.name, "Bob and Alice");
		assert.strictEqual(charBlock.hidden, true);
		assert.strictEqual(charBlock.content, "Hello!");

	});

	it("parses multi-line and nested HTML tags inside system block", () => {

		const input = `<system>
<div class="m-doc">
  <div class="m-doc-title">Royal Decree</div>
  <div class="m-doc-content">
    Be it known to all citizens that the mountain pass remains closed.
  </div>
  <div class="m-doc-seal">Seal of the Crown</div>
</div>
</system>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "system");

		const block = result.blocks[0] as SystemBlock;
		assert.ok(block.content.includes("<div class=\"m-doc\">"));
		assert.ok(block.content.includes("<div class=\"m-doc-title\">Royal Decree</div>"));
		assert.ok(block.content.includes("<div class=\"m-doc-seal\">Seal of the Crown</div>"));

	});

	it("parses nested HTML tags and dialogue inside character block", () => {

		const input = `<character id="101" name="Archivist">
Take this transcript immediately.

<div class="m-screen">
  <div class="m-screen-header">TRANSMISSION LOG</div>
  <div class="m-screen-log">Signal detected on frequency 142.8 MHz.</div>
</div>

Do not lose it.
</character>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");

		const block = result.blocks[0] as CharacterBlock;
		assert.strictEqual(block.id, "101");
		assert.strictEqual(block.name, "Archivist");
		assert.ok(block.content.includes("Take this transcript immediately."));
		assert.ok(block.content.includes("<div class=\"m-screen\">"));
		assert.ok(block.content.includes("Do not lose it."));

	});

	it("parses deeply nested HTML tags within a single block", () => {

		const input = `<system>
<div class="m-item-card">
  <div class="m-item-header">
    <span class="m-badge m-badge-legendary">Legendary</span>
    <h3>Astral Compass</h3>
  </div>
  <div class="m-item-stats">
    <div class="m-grid-2">
      <div><span>Power</span> 95</div>
      <div><span>Resonance</span> 80</div>
    </div>
  </div>
  <div class="m-item-effects">
    <div class="m-item-effect">Reveals hidden paths in the void.</div>
  </div>
</div>
</system>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "system");

		const block = result.blocks[0] as SystemBlock;
		assert.ok(block.content.includes("<span class=\"m-badge m-badge-legendary\">Legendary</span>"));
		assert.ok(block.content.includes("<div class=\"m-grid-2\">"));
		assert.ok(block.content.includes("<div class=\"m-item-effect\">Reveals hidden paths in the void.</div>"));

	});

	it("parses mixed markdown elements inside custom HTML containers", () => {

		const input = `<character id="202" name="Merchant">
<div class="m-newspaper">
  <div class="m-newspaper-headline">**Morning Chronicle**</div>
  <div class="m-newspaper-columns">
    - First rumor: *The docks are quiet.*
    - Second rumor: *Prices rose by 20%.*
  </div>
</div>
</character>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");

		const block = result.blocks[0] as CharacterBlock;
		assert.ok(block.content.includes("<div class=\"m-newspaper\">"));
		assert.ok(block.content.includes("**Morning Chronicle**"));
		assert.ok(block.content.includes("- First rumor: *The docks are quiet.*"));

	});

	it("parses multiple consecutive visual cards across different system blocks", () => {

		const input = `<system>
<div class="m-callout m-callout-warning">Caution: Radiation leak detected.</div>
</system>
<system>
<div class="m-callout m-callout-danger">Evacuation in progress.</div>
</system>`;

		const result = parseRoleplayResponse(input);

		assert.strictEqual(result.blocks.length, 2);
		assert.strictEqual(result.blocks[0].type, "system");
		assert.strictEqual(result.blocks[1].type, "system");

		const firstBlock = result.blocks[0] as SystemBlock;
		const secondBlock = result.blocks[1] as SystemBlock;
		assert.ok(firstBlock.content.includes("m-callout-warning"));
		assert.ok(secondBlock.content.includes("m-callout-danger"));

	});

});

describe("formatTurnInstruction", () => {

	it("formats system turn instruction", () => {

		const instruction = formatTurnInstruction({ type: "system" });
		assert.strictEqual(instruction, "Speak as SYSTEM.");

	});

	it("formats user turn instruction", () => {

		const instruction = formatTurnInstruction({ type: "user" });
		assert.strictEqual(instruction, "Speak as USER.");

	});

	it("formats character turn instruction with name", () => {

		const instruction = formatTurnInstruction({
			type: "character",
			id: "1234",
			name: "Kittens",
		});
		assert.strictEqual(instruction, "Speak as character Kittens (ID: 1234).");

	});

	it("formats character turn instruction without name", () => {

		const instruction = formatTurnInstruction({
			type: "character",
			id: "5678",
		});
		assert.strictEqual(instruction, "Speak as character (ID: 5678).");

	});

	it("parses JSON Schema response", () => {
		const input = JSON.stringify({
			content: "Content",
			blocks: [{ type: "character", id: "1", name: "Name", content: "Hello" }],
			nextTurn: { type: "character", id: "1", name: "Name" },
		});
		const result = parseRoleplayResponse(input);
		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");
		assert.strictEqual((result.blocks[0] as any).id, "1");
		assert.ok(result.nextTurn);
		assert.strictEqual((result.nextTurn as any).type, "character");
	});

	it("parses fenced JSON Schema response", () => {
		const input = `
\`\`\`json
{"content":"Fenced content","blocks":[{"type":"system","content":"System notice","hidden":true}],"nextTurn":{"type":"system"}}
\`\`\`
`;

		const result = parseJsonSchemaResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "system");
		assert.strictEqual(result.blocks[0].content, "System notice");
		assert.strictEqual(result.blocks[0].hidden, true);
		assert.deepStrictEqual(result.nextTurn, { type: "system" });
	});

	it("falls back to XML parsing for malformed JSON", () => {
		const input = `<character id="legacy" name="Narrator">Legacy response</character>`;

		const result = parseJsonSchemaResponse(input);

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");
		assert.strictEqual((result.blocks[0] as CharacterBlock).id, "legacy");
		assert.strictEqual(result.blocks[0].content, "Legacy response");
	});

	it("maps content-only JSON responses to a character block", () => {
		const result = parseJsonSchemaResponse(JSON.stringify({ content: "Narrative content" }));

		assert.strictEqual(result.blocks.length, 1);
		assert.strictEqual(result.blocks[0].type, "character");
		assert.strictEqual((result.blocks[0] as CharacterBlock).id, "");
		assert.strictEqual((result.blocks[0] as CharacterBlock).name, "");
		assert.strictEqual(result.blocks[0].content, "Narrative content");
		assert.strictEqual(result.nextTurn, undefined);
	});

});

describe("XML Command Extraction and Tag Stripping", () => {

	describe("parseStateValue", () => {

		it("parses boolean values", () => {
			assert.strictEqual(parseStateValue("true"), true);
			assert.strictEqual(parseStateValue("false"), false);
		});

		it("parses numeric values", () => {
			assert.strictEqual(parseStateValue("42"), 42);
			assert.strictEqual(parseStateValue("-3.14"), -3.14);
			assert.strictEqual(parseStateValue("0"), 0);
		});

		it("parses JSON array values", () => {
			assert.deepStrictEqual(parseStateValue("[1, 2, 3]"), [1, 2, 3]);
			assert.deepStrictEqual(parseStateValue("[\"apple\", \"banana\"]"), ["apple", "banana"]);
		});

		it("parses string and quoted string values", () => {
			assert.strictEqual(parseStateValue("hello world"), "hello world");
			assert.strictEqual(parseStateValue("\"quoted value\""), "quoted value");
			assert.strictEqual(parseStateValue("'single quoted'"), "single quoted");
		});

	});

	describe("parseCommands", () => {

		it("parses standalone state tags with attributes", () => {
			const input = `<state key="district.alert" value="high" op="set" />`;
			const result = parseCommands(input);

			assert.strictEqual(result.states.length, 1);
			assert.strictEqual(result.states[0].key, "district.alert");
			assert.strictEqual(result.states[0].value, "high");
			assert.strictEqual(result.states[0].op, "set");
		});

		it("parses state delete operations", () => {
			const input = `<state key="temporary.buff" op="delete" />`;
			const result = parseCommands(input);

			assert.strictEqual(result.states.length, 1);
			assert.strictEqual(result.states[0].key, "temporary.buff");
			assert.strictEqual(result.states[0].op, "delete");
		});

		it("parses character state mutations with category and name", () => {
			const input = `<state character="Bob" category="emotion" name="fear" value="high" />`;
			const result = parseCommands(input);

			assert.strictEqual(result.states.length, 1);
			assert.strictEqual(result.states[0].character, "Bob");
			assert.strictEqual(result.states[0].category, "emotion");
			assert.strictEqual(result.states[0].name, "fear");
			assert.strictEqual(result.states[0].value, "high");
		});

		it("parses state tags with text content", () => {
			const input = `<state key="journal.entry">Discovered hidden temple</state>`;
			const result = parseCommands(input);

			assert.strictEqual(result.states.length, 1);
			assert.strictEqual(result.states[0].key, "journal.entry");
			assert.strictEqual(result.states[0].value, "Discovered hidden temple");
		});

		it("parses event tags with attributes and text content", () => {
			const input = `<event type="narrative" summary="The storm began" details="Heavy rain poured down" />
<event type="character" summary="Alice gasped">She saw the shadow move.</event>`;
			const result = parseCommands(input);

			assert.strictEqual(result.events.length, 2);
			assert.strictEqual(result.events[0].type, "narrative");
			assert.strictEqual(result.events[0].summary, "The storm began");
			assert.strictEqual(result.events[0].details, "Heavy rain poured down");

			assert.strictEqual(result.events[1].type, "character");
			assert.strictEqual(result.events[1].summary, "Alice gasped");
			assert.strictEqual(result.events[1].details, "She saw the shadow move.");
		});

		it("parses director tags with attributes and child tags", () => {
			const input = `<director thought="Player is hesitating" plan="Introduce danger" instructions="Increase tension" />`;
			const result = parseCommands(input);

			assert.ok(result.director);
			assert.strictEqual(result.director?.thought, "Player is hesitating");
			assert.strictEqual(result.director?.plan, "Introduce danger");
			assert.strictEqual(result.director?.instructions, "Increase tension");
		});

		it("merges multiple director tags", () => {
			const input = `<director thought="Initial thought" />
<director plan="New plan" />`;
			const result = parseCommands(input);

			assert.ok(result.director);
			assert.strictEqual(result.director?.thought, "Initial thought");
			assert.strictEqual(result.director?.plan, "New plan");
		});

		it("handles empty and unclosed command tags", () => {
			const input = `Dialogue text <state key="" value="" /> <state key="flag" value="true"`;
			const result = parseCommands(input);

			assert.strictEqual(result.states.length, 2);
			assert.strictEqual(result.states[0].key, "");
			assert.strictEqual(result.states[1].key, "flag");
			assert.strictEqual(result.states[1].value, true);
		});

	});

	describe("stripCommandTags", () => {

		it("strips standalone command tags on own lines without leaving blank lines", () => {
			const input = `First line.
<state key="alert" value="high" />
Second line.`;
			const result = stripCommandTags(input);
			assert.strictEqual(result, "First line.\nSecond line.");
		});

		it("strips inline command tags inside text", () => {
			const input = `Hello <state key="mood" value="happy" /> world!`;
			const result = stripCommandTags(input);
			assert.strictEqual(result, "Hello world!");
		});

		it("strips unclosed command tag at end of text", () => {
			const input = `Some narrative <state key="open" value="true"`;
			const result = stripCommandTags(input);
			assert.strictEqual(result.trim(), "Some narrative");
		});

		it("preserves non-command HTML tags", () => {
			const input = `<div class="card"><b>Warning:</b> <state key="danger" value="high" />Stay back.</div>`;
			const result = stripCommandTags(input);
			assert.strictEqual(result, `<div class="card"><b>Warning:</b> Stay back.</div>`);
		});

	});

	describe("parseRoleplayResponse integration with commands", () => {

		it("extracts state, event, and director commands and strips them from character block", () => {
			const input = `<director thought="Suspenseful moment" plan="Reveal traitor" />
<state key="weather" value="stormy" />
<character id="101" name="Detective">
The clock struck midnight.
<state character="Detective" category="thought" name="clue" value="watch stopped at 12" />
<event type="narrative" summary="Lightning flashed outside." />
Someone entered the room.
</character>`;

			const result = parseRoleplayResponse(input);

			assert.ok(result.commands);
			assert.strictEqual(result.commands?.states.length, 2);
			assert.strictEqual(result.commands?.states[0].key, "weather");
			assert.strictEqual(result.commands?.states[0].value, "stormy");
			assert.strictEqual(result.commands?.states[1].character, "Detective");
			assert.strictEqual(result.commands?.states[1].category, "thought");
			assert.strictEqual(result.commands?.states[1].value, "watch stopped at 12");

			assert.strictEqual(result.commands?.events.length, 1);
			assert.strictEqual(result.commands?.events[0].type, "narrative");
			assert.strictEqual(result.commands?.events[0].summary, "Lightning flashed outside.");

			assert.strictEqual(result.commands?.director?.thought, "Suspenseful moment");
			assert.strictEqual(result.commands?.director?.plan, "Reveal traitor");

			assert.strictEqual(result.blocks.length, 1);
			const block = result.blocks[0] as CharacterBlock;
			assert.strictEqual(block.id, "101");
			assert.strictEqual(block.name, "Detective");
			assert.strictEqual(
				block.content,
				"The clock struck midnight.\nSomeone entered the room.",
			);
		});

		it("handles mixed dialogue with multiple inline commands", () => {
			const input = `<character id="202" name="Merchant">
Welcome traveler!
<state key="merchant.greeting" value="true" />
<state key="gold" value="100" />
Take a look at my wares.
</character>`;

			const result = parseRoleplayResponse(input);

			assert.ok(result.commands);
			assert.strictEqual(result.commands?.states.length, 2);
			assert.strictEqual(result.blocks.length, 1);
			const block = result.blocks[0] as CharacterBlock;
			assert.strictEqual(
				block.content,
				"Welcome traveler!\nTake a look at my wares.",
			);
		});

		it("handles JSON schema responses containing inline command tags", () => {
			const input = JSON.stringify({
				blocks: [
					{
						type: "character",
						id: "hero",
						name: "Hero",
						content: "I made it.\n<state key=\"quest.done\" value=\"true\" />\nTime to rest.",
					},
				],
			});

			const result = parseRoleplayResponse(input);

			assert.ok(result.commands);
			assert.strictEqual(result.commands?.states.length, 1);
			assert.strictEqual(result.commands?.states[0].key, "quest.done");
			assert.strictEqual(result.commands?.states[0].value, true);

			assert.strictEqual(result.blocks.length, 1);
			assert.strictEqual(result.blocks[0].content, "I made it.\nTime to rest.");
		});

	});

});
