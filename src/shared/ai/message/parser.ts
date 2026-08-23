import type { MessageBlock, ParsedMessage } from "@/shared/ai/message/types.ts";

const CHAR_REGEX = /^!!CHAR\s+(\S+)\s+(.*?)(?:\s+(hidden))?$/i;
const SYSTEM_REGEX = /^!!SYSTEM(?:\s+(hidden))?$/i;
const TURN_REGEX = /^!!TURN\s+(SYSTEM|\S+)(?:\s+(.*))?$/i;

export function parseRoleplayResponse(rawText: string): ParsedMessage {

	const lines = rawText.split(/\r?\n/);
	const blocks: MessageBlock[] = [];
	let currentBlock: (MessageBlock & { contentLines: string[] }) | null = null;
	let nextTurn: ParsedMessage["nextTurn"];

	const finalizeCurrentBlock = () => {
		if (currentBlock) {
			blocks.push({
				...currentBlock,
				content: currentBlock.contentLines.join("\n").trim(),
			});
			currentBlock = null;
		}
	};

	for (const line of lines) {

		const turnMatch = TURN_REGEX.exec(line);
		if (turnMatch) {

			finalizeCurrentBlock();
			const target = turnMatch[1];
			const characterName = turnMatch[2]?.trim();

			if (target.toUpperCase() === "SYSTEM") {
				nextTurn = {
					type: "system",
				};
			}
			else {
				nextTurn = {
					type: "character",
					id: target,
					name: characterName,
				};
			}

			break; // Stop parsing remaining text
		}

		const charMatch = CHAR_REGEX.exec(line);
		if (charMatch) {

			finalizeCurrentBlock();
			const [, id, namePart, hiddenFlag] = charMatch;
			const isHidden = hiddenFlag?.toLowerCase() === "hidden";

			currentBlock = {
				type: "character",
				id: id,
				name: namePart.trim(),
				hidden: isHidden,
				content: "",
				contentLines: [],
			};
			continue;

		}

		const sysMatch = SYSTEM_REGEX.exec(line);
		if (sysMatch) {

			finalizeCurrentBlock();
			const isHidden = sysMatch[1]?.toLowerCase() === "hidden";

			currentBlock = {
				type: "system",
				hidden: isHidden,
				content: "",
				contentLines: [],
			};
			continue;

		}

		if (currentBlock) {
			currentBlock.contentLines.push(line);
		}

	}

	finalizeCurrentBlock();
	return { blocks, nextTurn };

}
