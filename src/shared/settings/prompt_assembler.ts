import type { ChatCompletionMessageParam } from "../ai/llm/common.ts";
import { formatCharacterInstancesPrompt, formatCharacterPrompt } from "../character/builder.ts";
import type { Characterfile, CharacterInstance } from "../character/types.ts";
import { synthesizeLorePrompt } from "../lore/builder.ts";
import { buildDirectorPrompt, type DirectorState } from "../session/director.ts";
import type { Chapter, SemanticBlueprints, SessionEvent, WorldStates } from "../world/types.ts";
import { extractActiveDirectives } from "../world/semantic/validation_engine.ts";
import { APP_PROMPT, isSystemPromptId } from "./prompt_definitions.ts";
import {
	formatChaptersSummaryPrompt,
	formatSemanticDirectivesPrompt,
	formatSessionEventsPrompt,
	formatSessionStatesPrompt,
} from "./prompt_formatters.ts";
import { getPromptSettings } from "./prompt_registry.ts";
import type { PromptSettings } from "./types.ts";

// Chat Prompt Context Assembly

export function assembleChatPromptMessages(
	sessionMessages: ChatCompletionMessageParam[],
	settings?: PromptSettings,
	states?: WorldStates | null,
	worldPrompt?: string | null,
	characters?: Characterfile | Characterfile[] | string | null,
	characterInstances?: CharacterInstance | CharacterInstance[] | string | null,
	lorebookId?: string | string[] | null,
	currentMessage?: string | null,
	events?: SessionEvent[] | string | null,
	chapters?: Chapter[] | string | null,
	compacted?: boolean | null,
	director?: DirectorState | string | null,
	wizardPrompt?: string | null,
	semanticDirectives?: string[] | null,
	blueprints?: SemanticBlueprints | null,
): ChatCompletionMessageParam[] {

	const currentSettings = settings ?? getPromptSettings();
	const assembledMessages: ChatCompletionMessageParam[] = [];

	const lastSessionMessage = sessionMessages.length > 0 ? sessionMessages[sessionMessages.length - 1] : undefined;
	const isToolTurn = lastSessionMessage?.role === "tool";

	for (const id of currentSettings.order) {
		if (isSystemPromptId(id)) {
			const isEnabled = currentSettings.systemPrompts[id]?.enabled ?? true;

			if (!isEnabled) {
				continue;
			}

			if (id === "system:world_prompt") {
				if (worldPrompt && worldPrompt.trim().length > 0) {
					const role = currentSettings.systemPrompts[id]?.role ?? "system";

					assembledMessages.push({
						role,
						content: worldPrompt,
					});
				}

				continue;
			}

			if (id === "system:app_prompt") {
				if (APP_PROMPT.trim().length > 0) {
					const role = currentSettings.systemPrompts[id]?.role ?? "system";

					assembledMessages.push({
						role,
						content: APP_PROMPT,
					});
				}

				continue;
			}

			if (id === "system:character_prompt") {
				const formattedCharacters = formatCharacterPrompt(characters);

				if (formattedCharacters.length > 0) {
					const role = currentSettings.systemPrompts[id]?.role ?? "system";

					assembledMessages.push({
						role,
						content: formattedCharacters,
					});
				}

				continue;
			}

			if (id === "system:chapters_summary") {
				if (compacted) {
					let formattedChapters: string | null = null;

					if (typeof chapters === "string") {
						formattedChapters = chapters.trim().length > 0 ? chapters : null;
					}
					else if (Array.isArray(chapters) && chapters.length > 0) {
						formattedChapters = formatChaptersSummaryPrompt(chapters);
					}

					if (formattedChapters) {
						const role = currentSettings.systemPrompts[id]?.role ?? "system";

						assembledMessages.push({
							role,
							content: formattedChapters,
						});
					}
				}

				continue;
			}

			if (id === "system:director_prompt") {
				let formattedDirector: string | null = null;

				if (typeof director === "string") {
					formattedDirector = director.trim().length > 0 ? director : null;
				}
				else if (director && typeof director === "object" && director.enabled) {
					const prompt = buildDirectorPrompt(director);
					formattedDirector = prompt.trim().length > 0 ? prompt : null;
				}

				if (formattedDirector) {
					const role = currentSettings.systemPrompts[id]?.role ?? "user";

					assembledMessages.push({
						role,
						content: formattedDirector,
					});
				}

				continue;
			}

			if (id === "system:chat_history") {
				if (!isToolTurn) {
					assembledMessages.push(...sessionMessages);
				}
				continue;
			}

			if (id === "system:world_states") {
				const formattedStates = formatSessionStatesPrompt(states);

				if (formattedStates) {
					const role = currentSettings.systemPrompts[id]?.role ?? "user";

					assembledMessages.push({
						role,
						content: formattedStates,
					});
				}

				continue;
			}

			if (id === "system:semantic_directives") {
				let directivesList = semanticDirectives;

				if ((!directivesList || directivesList.length === 0) && blueprints && states) {
					const extracted = extractActiveDirectives(blueprints, states);
					directivesList = extracted.allDirectives;
				}

				const formattedDirectives = formatSemanticDirectivesPrompt(directivesList);

				if (formattedDirectives) {
					const role = currentSettings.systemPrompts[id]?.role ?? "system";

					assembledMessages.push({
						role,
						content: formattedDirectives,
					});
				}

				continue;
			}

			if (id === "system:character_instances") {
				const formattedInstances = formatCharacterInstancesPrompt(characterInstances);

				if (formattedInstances.length > 0) {
					const role = currentSettings.systemPrompts[id]?.role ?? "user";

					assembledMessages.push({
						role,
						content: formattedInstances,
					});
				}

				continue;
			}

			if (id === "system:lore_prompt") {
				if (lorebookId && (Array.isArray(lorebookId) ? lorebookId.length > 0 : true)) {
					let messageForLore = currentMessage;

					if (messageForLore === undefined || messageForLore === null) {
						for (let i = sessionMessages.length - 1; i >= 0; i--) {
							const msg = sessionMessages[i];

							if (msg.role === "user" && typeof msg.content === "string") {
								messageForLore = msg.content;
								break;
							}
						}
					}

					const formattedLore = synthesizeLorePrompt(lorebookId, messageForLore ?? undefined);

					if (formattedLore.length > 0) {
						const role = currentSettings.systemPrompts[id]?.role ?? "system";

						assembledMessages.push({
							role,
							content: formattedLore,
						});
					}
				}

				continue;
			}

			if (id === "system:session_events") {
				let formattedEvents: string | null = null;

				if (typeof events === "string") {
					formattedEvents = events.trim().length > 0 ? events : null;
				}
				else if (Array.isArray(events) && events.length > 0) {
					formattedEvents = formatSessionEventsPrompt(events);
				}

				if (formattedEvents) {
					const role = currentSettings.systemPrompts[id]?.role ?? "user";

					assembledMessages.push({
						role,
						content: formattedEvents,
					});
				}

				continue;
			}

			if (id === "system:wizard_prompt") {
				if (wizardPrompt && wizardPrompt.trim().length > 0) {
					const role = currentSettings.systemPrompts[id]?.role ?? "system";

					assembledMessages.push({
						role,
						content: wizardPrompt,
					});
				}

				continue;
			}

			continue;
		}

		const userPrompt = currentSettings.userPrompts[id];

		if (userPrompt && userPrompt.enabled && userPrompt.content.trim().length > 0) {
			const role = userPrompt.role ?? "user";

			assembledMessages.push({
				role,
				content: userPrompt.content,
			});
		}
	}

	if (isToolTurn) {
		assembledMessages.push(...sessionMessages);
	}

	return assembledMessages;

}
