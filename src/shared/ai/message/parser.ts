import type { ChoiceBlock, ChoiceOption, MessageBlock, ParsedMessage, TurnAction } from "@/shared/ai/message/types.ts";

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
				content: content.trim(),
			});

		}
		else if (tagName === "system") {

			blocks.push({
				type: "system",
				hidden: isHidden,
				content: content.trim(),
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
				content: content.trim(),
			};

			blocks.push(choiceBlock);

		}

		lastIndex = nextSearchIndex;

	}

	return { blocks, nextTurn };

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

	if (Array.isArray(data.blocks) && data.blocks.length > 0) {
		for (const item of data.blocks) {
			if (!item || typeof item !== "object") {
				continue;
			}

			const isHidden = Boolean(item.hidden);
			const content = typeof item.content === "string" ? item.content.trim() : "";

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
		}
		else {
			blocks.push({
				type: "character",
				id: "",
				name: "",
				hidden: false,
				content: data.content.trim(),
			});
		}
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

	return { blocks, nextTurn };

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
