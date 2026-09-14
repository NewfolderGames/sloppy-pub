import type { ChapterCommand, ChoiceBlock, ChoiceOption, DirectorCommand, EventCommand, MessageBlock, ParsedCommands, ParsedMessage, StateCommand, TurnAction } from "@/shared/ai/message/types.ts";
import type { StateValue } from "@/shared/world/types.ts";

export function parseStateValue(raw: string): StateValue {

	const trimmed = raw.trim();

	if (trimmed === "true") {
		return true;
	}

	if (trimmed === "false") {
		return false;
	}

	if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
		return Number(trimmed);
	}

	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {

		try {

			const parsed = JSON.parse(trimmed);

			if (Array.isArray(parsed)) {
				return parsed;
			}

		}
		catch {
			// Fallback to string on parse failure
		}

	}

	if (
		(trimmed.startsWith("\"") && trimmed.endsWith("\""))
		|| (trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	return trimmed;

}

interface CommandSpan {
	tag: "state" | "event" | "director" | "chapter";
	start: number;
	end: number;
	attrs: Record<string, string>;
	content: string;
}

function extractCommandSpans(text: string): CommandSpan[] {

	const spans: CommandSpan[] = [];
	const openTagRegex = /<(state|event|director|chapter)\b([^>]*)(\/?>|$)/gi;

	let match: RegExpExecArray | null;

	while ((match = openTagRegex.exec(text)) !== null) {

		const tag = match[1].toLowerCase() as "state" | "event" | "director" | "chapter";
		const attrString = match[2];
		const closer = match[3];
		const tagStart = match.index;
		const tagContentStart = tagStart + match[0].length;
		const attrs = parseAttributes(attrString);

		let tagEnd = tagContentStart;
		let content = "";

		if (closer.startsWith("/>")) {

			tagEnd = tagContentStart;
			content = "";

		}
		else if (closer === "") {

			tagEnd = text.length;
			content = "";

		}
		else {

			const closeTagRegex = new RegExp(`</\\s*${tag}\\s*>`, "gi");
			closeTagRegex.lastIndex = tagContentStart;
			const closeMatch = closeTagRegex.exec(text);

			const nextTagRegex = /<(?:state|event|director|chapter|character|system|choices|turn)\b/gi;
			nextTagRegex.lastIndex = tagContentStart;
			const nextTagMatch = nextTagRegex.exec(text);

			if (closeMatch && (!nextTagMatch || closeMatch.index < nextTagMatch.index)) {

				content = text.slice(tagContentStart, closeMatch.index);
				tagEnd = closeMatch.index + closeMatch[0].length;

			}
			else {

				const hasSelfContainedAttrs
					= (tag === "state" && (attrs.value !== undefined || attrs.op === "delete" || attrs.operation === "delete"))
						|| (tag === "event" && attrs.summary !== undefined)
						|| (tag === "chapter" && (attrs.title !== undefined || attrs.summary !== undefined))
						|| (tag === "director" && (attrs.thought !== undefined || attrs.plan !== undefined || attrs.instructions !== undefined));

				if (hasSelfContainedAttrs) {

					tagEnd = tagContentStart;
					content = "";

				}
				else {

					tagEnd = nextTagMatch ? nextTagMatch.index : text.length;
					content = text.slice(tagContentStart, tagEnd);

				}

			}

		}

		spans.push({
			tag,
			start: tagStart,
			end: tagEnd,
			attrs,
			content,
		});

		openTagRegex.lastIndex = tagEnd;

	}

	return spans;

}

function parseStateCommand(attrs: Record<string, string>, content: string): StateCommand {

	const key = attrs.key ?? attrs.name ?? attrs.title ?? "";
	const rawOp = (attrs.op ?? attrs.operation ?? "set").toLowerCase();
	const op: "set" | "delete" = rawOp === "delete" ? "delete" : "set";

	let value: StateValue = "";

	if (attrs.value !== undefined) {
		value = parseStateValue(attrs.value);
	}
	else if (content.trim().length > 0) {
		value = parseStateValue(content.trim());
	}

	const cmd: StateCommand = {
		key,
		value,
		op,
	};

	if (attrs.character && attrs.character.trim().length > 0) {
		cmd.character = attrs.character.trim();
	}

	const rawCat = attrs.category?.toLowerCase();

	if (rawCat === "thought" || rawCat === "emotion" || rawCat === "goal" || rawCat === "state") {
		cmd.category = rawCat;
	}

	if (attrs.name && attrs.name.trim().length > 0) {
		cmd.name = attrs.name.trim();
	}
	else if (attrs.title && attrs.title.trim().length > 0) {
		cmd.name = attrs.title.trim();
	}

	return cmd;

}

function parseEventCommand(attrs: Record<string, string>, content: string): EventCommand {

	const rawType = (attrs.type ?? "narrative").toLowerCase();
	const type: "narrative" | "character" | "system"
		= rawType === "character" || rawType === "system" ? rawType : "narrative";

	let summary = attrs.summary?.trim() ?? "";
	let details = attrs.details?.trim();

	if (!summary && content.trim().length > 0) {
		summary = content.trim();
	}
	else if (summary && !details && content.trim().length > 0) {
		details = content.trim();
	}

	const cmd: EventCommand = {
		type,
		summary,
	};

	if (details) {
		cmd.details = details;
	}

	return cmd;

}

function parseDirectorCommand(attrs: Record<string, string>, content: string): DirectorCommand {

	let thought = attrs.thought?.trim();
	let plan = attrs.plan?.trim();
	let instructions = (attrs.instructions ?? attrs.steer)?.trim();

	if (content.trim().length > 0) {

		const thoughtMatch = /<thought\b[^>]*>([\s\S]*?)<\/thought>/i.exec(content);

		if (thoughtMatch && !thought) {
			thought = thoughtMatch[1].trim();
		}

		const planMatch = /<plan\b[^>]*>([\s\S]*?)<\/plan>/i.exec(content);

		if (planMatch && !plan) {
			plan = planMatch[1].trim();
		}

		const instructionsMatch = /<(?:instructions|steer)\b[^>]*>([\s\S]*?)<\/(?:instructions|steer)>/i.exec(content);

		if (instructionsMatch && !instructions) {
			instructions = instructionsMatch[1].trim();
		}

		if (!thought && !plan && !instructions) {
			thought = content.trim();
		}

	}

	const cmd: DirectorCommand = {};

	if (thought) {
		cmd.thought = thought;
	}

	if (plan) {
		cmd.plan = plan;
	}

	if (instructions) {
		cmd.instructions = instructions;
	}

	return cmd;

}

function parseChapterCommand(attrs: Record<string, string>, content: string): ChapterCommand {

	const title = attrs.title ?? attrs.name ?? "New Chapter";
	let summary = attrs.summary?.trim() ?? "";

	if (!summary && content.trim().length > 0) {
		summary = content.trim();
	}

	return {
		title: title.trim(),
		summary,
	};

}

export function parseCommands(text: string): ParsedCommands {

	const spans = extractCommandSpans(text);
	const states: StateCommand[] = [];
	const events: EventCommand[] = [];
	const chapters: ChapterCommand[] = [];
	let director: DirectorCommand | undefined;

	for (const span of spans) {

		if (span.tag === "state") {
			states.push(parseStateCommand(span.attrs, span.content));
		}
		else if (span.tag === "event") {
			events.push(parseEventCommand(span.attrs, span.content));
		}
		else if (span.tag === "chapter") {
			chapters.push(parseChapterCommand(span.attrs, span.content));
		}
		else if (span.tag === "director") {

			const dirCmd = parseDirectorCommand(span.attrs, span.content);

			if (Object.keys(dirCmd).length > 0) {

				if (!director) {
					director = {};
				}

				if (dirCmd.thought) {
					director.thought = dirCmd.thought;
				}

				if (dirCmd.plan) {
					director.plan = dirCmd.plan;
				}

				if (dirCmd.instructions) {
					director.instructions = dirCmd.instructions;
				}

			}

		}

	}

	return {
		states,
		events,
		chapters,
		...(director ? { director } : {}),
	};

}

export function stripCommandTags(text: string): string {

	const spans = extractCommandSpans(text);

	if (spans.length === 0) {
		return text;
	}

	let result = text;

	for (let i = spans.length - 1; i >= 0; i--) {

		const span = spans[i];
		let removeStart = span.start;
		let removeEnd = span.end;

		const before = result.slice(0, removeStart);
		const lastNewlineBefore = before.lastIndexOf("\n");
		const lineStartBefore = lastNewlineBefore === -1 ? 0 : lastNewlineBefore + 1;
		const isWhitespaceBefore = /^[ \t]*$/.test(result.slice(lineStartBefore, removeStart));

		const after = result.slice(removeEnd);
		const nextNewlineAfter = after.indexOf("\n");
		const lineEndAfter = nextNewlineAfter === -1 ? result.length : removeEnd + nextNewlineAfter;
		const isWhitespaceAfter = /^[ \t]*$/.test(result.slice(removeEnd, lineEndAfter));

		if (isWhitespaceBefore && isWhitespaceAfter) {

			if (lastNewlineBefore !== -1) {
				removeStart = lastNewlineBefore;
				removeEnd = lineEndAfter;
			}
			else if (nextNewlineAfter !== -1) {
				removeStart = 0;
				removeEnd = lineEndAfter + 1;
			}
			else {
				removeStart = 0;
				removeEnd = result.length;
			}

		}
		else {

			if (
				removeStart > 0
				&& removeEnd < result.length
				&& result[removeStart - 1] === " "
				&& result[removeEnd] === " "
			) {
				removeEnd += 1;
			}

		}

		result = result.slice(0, removeStart) + result.slice(removeEnd);

	}

	return result;

}

function parseAttributes(attrString: string): Record<string, string> {

	const attrs: Record<string, string> = {};
	const cleaned = attrString.replace(/\/+$/, "");
	const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

	let match: RegExpExecArray | null;

	while ((match = attrRegex.exec(cleaned)) !== null) {

		const key = match[1].toLowerCase();
		const val = match[2] ?? match[3] ?? match[4] ?? "true";

		attrs[key] = val;

	}

	return attrs;

}

function parseChoiceOptions(choiceContent: string): ChoiceOption[] {

	const options: ChoiceOption[] = [];
	const choiceTagRegex = /<choice\b[^>]*>([\s\S]*?)(?:<\/choice>|(?=<choice\b)|$)/gi;

	let match: RegExpExecArray | null;

	while ((match = choiceTagRegex.exec(choiceContent)) !== null) {

		const text = match[1].trim();

		if (text.length > 0) {

			options.push({
				id: `opt-${options.length + 1}`,
				text,
			});

		}

	}

	return options;

}

export function parseRoleplayResponse(rawText: string): ParsedMessage {

	const trimmed = rawText.trim();

	// If candidate looks like JSON or JSON markdown fence, attempt JSON schema parsing
	if (trimmed.startsWith("{") || (trimmed.startsWith("```") && trimmed.includes("{"))) {
		try {
			const candidate = trimmed.startsWith("```")
				? trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim()
				: trimmed;

			const parsed = JSON.parse(candidate);
			if (parsed && typeof parsed === "object" && ("content" in parsed || "blocks" in parsed || "nextTurn" in parsed)) {
				return parseJsonSchemaResponse(rawText);
			}
		}
		catch {
			// Not valid JSON, continue to XML parsing
		}
	}

	return parseXmlRoleplayResponse(rawText);

}

export function parseXmlRoleplayResponse(rawText: string): ParsedMessage {

	const parsedCommands = parseCommands(rawText);
	const hasCommands
		= parsedCommands.states.length > 0
			|| parsedCommands.events.length > 0
			|| parsedCommands.chapters.length > 0
			|| parsedCommands.director !== undefined;

	const blocks: MessageBlock[] = [];
	let nextTurn: ParsedMessage["nextTurn"];

	const openTagRegex = /<(character|system|choices|turn)\b([^>]*)(\/?>|$)/gi;
	const nextTopLevelTagRegex = /<(?:character|system|choices|turn)\b/gi;

	let lastIndex = 0;

	while (lastIndex < rawText.length) {

		openTagRegex.lastIndex = lastIndex;
		const openMatch = openTagRegex.exec(rawText);

		if (!openMatch) {
			break;
		}

		const tagName = openMatch[1].toLowerCase();
		const attrString = openMatch[2];
		const isSelfClosing = openMatch[3].startsWith("/>");
		const tagContentStartIndex = openMatch.index + openMatch[0].length;
		const attrs = parseAttributes(attrString);

		if (tagName === "turn") {

			const target = attrs.target;

			if (target) {

				if (target.toUpperCase() === "SYSTEM") {

					nextTurn = {
						type: "system",
					};

				}
				else if (target.toUpperCase() === "USER") {

					nextTurn = {
						type: "user",
					};

				}
				else {

					nextTurn = {
						type: "character",
						id: target,
						...(attrs.name ? { name: attrs.name } : {}),
					};

				}

			}

			break;

		}

		let content: string;
		let nextSearchIndex: number;

		if (isSelfClosing) {

			content = "";
			nextSearchIndex = tagContentStartIndex;

		}
		else {

			const closeTagRegex = new RegExp(`</\\s*${tagName}\\s*>`, "gi");
			closeTagRegex.lastIndex = tagContentStartIndex;
			const closeMatch = closeTagRegex.exec(rawText);

			if (closeMatch) {

				content = rawText.slice(tagContentStartIndex, closeMatch.index);
				nextSearchIndex = closeMatch.index + closeMatch[0].length;

			}
			else {

				nextTopLevelTagRegex.lastIndex = tagContentStartIndex;
				const nextTagMatch = nextTopLevelTagRegex.exec(rawText);

				if (nextTagMatch) {

					content = rawText.slice(tagContentStartIndex, nextTagMatch.index);
					nextSearchIndex = nextTagMatch.index;

				}
				else {

					content = rawText.slice(tagContentStartIndex);
					nextSearchIndex = rawText.length;

				}

			}

		}

		const isHidden = attrs.hidden?.toLowerCase() === "true";

		if (tagName === "character") {

			blocks.push({
				type: "character",
				id: attrs.id ?? "",
				name: attrs.name ?? "",
				hidden: isHidden,
				content: stripCommandTags(content).trim(),
			});

		}
		else if (tagName === "system") {

			blocks.push({
				type: "system",
				hidden: isHidden,
				content: stripCommandTags(content).trim(),
			});

		}
		else if (tagName === "choices") {

			const mode = attrs.mode?.toLowerCase();
			const isMultiple = mode === "multiple" || mode === "multi";
			const options = parseChoiceOptions(content);

			const choiceBlock: ChoiceBlock = {
				type: "choice",
				hidden: isHidden,
				multiple: isMultiple,
				allowCustomInput: true,
				options,
				content: stripCommandTags(content).trim(),
			};

			blocks.push(choiceBlock);

		}

		lastIndex = nextSearchIndex;

	}

	return {
		blocks,
		nextTurn,
		...(hasCommands ? { commands: parsedCommands } : {}),
	};

}

export function parseJsonSchemaResponse(jsonString: string): ParsedMessage {

	let raw = jsonString.trim();

	if (raw.startsWith("```")) {
		raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
	}

	let data: any;
	try {
		data = JSON.parse(raw);
	}
	catch {
		return parseXmlRoleplayResponse(jsonString);
	}

	if (!data || typeof data !== "object") {
		return parseXmlRoleplayResponse(jsonString);
	}

	const blocks: MessageBlock[] = [];
	const collectedStates: StateCommand[] = [];
	const collectedEvents: EventCommand[] = [];
	const collectedChapters: ChapterCommand[] = [];
	let collectedDirector: DirectorCommand | undefined;

	if (data.commands && typeof data.commands === "object") {
		if (Array.isArray(data.commands.states)) {
			collectedStates.push(...data.commands.states);
		}
		if (Array.isArray(data.commands.events)) {
			collectedEvents.push(...data.commands.events);
		}
		if (Array.isArray(data.commands.chapters)) {
			collectedChapters.push(...data.commands.chapters);
		}
		if (data.commands.director && typeof data.commands.director === "object") {
			collectedDirector = { ...data.commands.director };
		}
	}

	if (Array.isArray(data.blocks) && data.blocks.length > 0) {
		for (const item of data.blocks) {
			if (!item || typeof item !== "object") {
				continue;
			}

			const isHidden = Boolean(item.hidden);
			const rawContent = typeof item.content === "string" ? item.content : "";
			const blockCmds = parseCommands(rawContent);

			collectedStates.push(...blockCmds.states);
			collectedEvents.push(...blockCmds.events);
			collectedChapters.push(...blockCmds.chapters);
			if (blockCmds.director) {
				if (!collectedDirector) {
					collectedDirector = {};
				}
				if (blockCmds.director.thought) {
					collectedDirector.thought = blockCmds.director.thought;
				}
				if (blockCmds.director.plan) {
					collectedDirector.plan = blockCmds.director.plan;
				}
				if (blockCmds.director.instructions) {
					collectedDirector.instructions = blockCmds.director.instructions;
				}
			}

			const content = stripCommandTags(rawContent).trim();

			if (item.type === "character") {
				blocks.push({
					type: "character",
					id: typeof item.id === "string" ? item.id : "",
					name: typeof item.name === "string" ? item.name : "",
					hidden: isHidden,
					content,
				});
			}
			else if (item.type === "system") {
				blocks.push({
					type: "system",
					hidden: isHidden,
					content,
				});
			}
			else if (item.type === "choices" || item.type === "choice") {
				const isMultiple = Boolean(item.multiple);
				const options = Array.isArray(item.options)
					? item.options.map((opt: any, idx: number) => ({
							id: typeof opt === "object" && opt && opt.id ? String(opt.id) : `opt-${idx + 1}`,
							text: typeof opt === "object" && opt && opt.text ? String(opt.text) : String(opt),
						}))
					: parseChoiceOptions(content);

				blocks.push({
					type: "choice",
					hidden: isHidden,
					multiple: isMultiple,
					allowCustomInput: true,
					options,
					content,
				});
			}
			else if (item.type === "app") {
				blocks.push({
					type: "app",
					hidden: isHidden,
					content,
				});
			}
		}
	}

	if (blocks.length === 0 && typeof data.content === "string" && data.content.trim().length > 0) {
		const contentParsed = parseXmlRoleplayResponse(data.content);

		if (contentParsed.blocks.length > 0) {
			blocks.push(...contentParsed.blocks);

			if (!data.nextTurn && contentParsed.nextTurn) {
				data.nextTurn = contentParsed.nextTurn;
			}

			if (contentParsed.commands) {
				collectedStates.push(...contentParsed.commands.states);
				collectedEvents.push(...contentParsed.commands.events);
				collectedChapters.push(...contentParsed.commands.chapters);
				if (contentParsed.commands.director) {
					if (!collectedDirector) {
						collectedDirector = {};
					}
					if (contentParsed.commands.director.thought) {
						collectedDirector.thought = contentParsed.commands.director.thought;
					}
					if (contentParsed.commands.director.plan) {
						collectedDirector.plan = contentParsed.commands.director.plan;
					}
					if (contentParsed.commands.director.instructions) {
						collectedDirector.instructions = contentParsed.commands.director.instructions;
					}
				}
			}
		}
		else {
			const contentCmds = parseCommands(data.content);
			collectedStates.push(...contentCmds.states);
			collectedEvents.push(...contentCmds.events);
			collectedChapters.push(...contentCmds.chapters);
			if (contentCmds.director) {
				if (!collectedDirector) {
					collectedDirector = {};
				}
				if (contentCmds.director.thought) {
					collectedDirector.thought = contentCmds.director.thought;
				}
				if (contentCmds.director.plan) {
					collectedDirector.plan = contentCmds.director.plan;
				}
				if (contentCmds.director.instructions) {
					collectedDirector.instructions = contentCmds.director.instructions;
				}
			}

			blocks.push({
				type: "character",
				id: "",
				name: "",
				hidden: false,
				content: stripCommandTags(data.content).trim(),
			});
		}
	}

	let commands: ParsedCommands | undefined;
	if (
		collectedStates.length > 0
		|| collectedEvents.length > 0
		|| collectedChapters.length > 0
		|| collectedDirector !== undefined
	) {
		commands = {
			states: collectedStates,
			events: collectedEvents,
			chapters: collectedChapters,
			...(collectedDirector ? { director: collectedDirector } : {}),
		};
	}

	let nextTurn: ParsedMessage["nextTurn"];

	if (data.nextTurn && typeof data.nextTurn === "object") {
		const turnType = data.nextTurn.type;

		if (turnType === "system") {
			nextTurn = { type: "system" };
		}
		else if (turnType === "user") {
			nextTurn = { type: "user" };
		}
		else if (turnType === "character") {
			nextTurn = {
				type: "character",
				id: typeof data.nextTurn.id === "string" ? data.nextTurn.id : "",
				...(typeof data.nextTurn.name === "string" ? { name: data.nextTurn.name } : {}),
			};
		}
	}

	return {
		blocks,
		nextTurn,
		...(commands ? { commands } : {}),
	};

}

export function formatTurnInstruction(turn: TurnAction): string {

	if (turn.type === "system") {
		return "Speak as SYSTEM.";
	}

	if (turn.type === "user") {
		return "Speak as USER.";
	}

	if (turn.name) {
		return `Speak as character ${turn.name} (ID: ${turn.id}).`;
	}

	return `Speak as character (ID: ${turn.id}).`;

}
