import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatTokens } from "./action_bar_helpers.ts";
import type { Message } from "@/shared/ai/message/node.ts";

describe("ChatMessageActionBar formatting and helpers", () => {

	test("formats token counts properly", () => {

		assert.strictEqual(formatTokens(0), "0 tokens");
		assert.strictEqual(formatTokens(1), "1 token");
		assert.strictEqual(formatTokens(42), "42 tokens");
		assert.strictEqual(formatTokens(1024), "1024 tokens");

	});

	test("formats durations for short and long generation times", () => {

		assert.strictEqual(formatDuration(0), "0.00s");
		assert.strictEqual(formatDuration(45), "0.04s");
		assert.strictEqual(formatDuration(350), "0.35s");
		assert.strictEqual(formatDuration(1250), "1.25s");
		assert.strictEqual(formatDuration(9990), "9.99s");
		assert.strictEqual(formatDuration(10500), "10.5s");
		assert.strictEqual(formatDuration(60000), "60.0s");

	});

	test("message metadata structures match expected contract", () => {

		const assistantMessage: Message = {
			id: "msg-1",
			finishReason: "stop",
			data: {
				role: "assistant",
				content: "Hello world",
			},
			metadata: {
				tokens: 15,
				durationMs: 400,
			},
		};

		assert.strictEqual(assistantMessage.data.role, "assistant");
		assert.strictEqual(assistantMessage.metadata?.tokens, 15);
		assert.strictEqual(assistantMessage.metadata?.durationMs, 400);

		const errorMessage: Message = {
			id: "msg-err",
			finishReason: "error",
			data: {
				role: "assistant",
				content: "",
			},
			metadata: {
				durationMs: 150,
				error: "Failed to connect to LLM server",
			},
		};

		assert.strictEqual(errorMessage.metadata?.error, "Failed to connect to LLM server");

	});

	test("calculates sibling navigation indices and boundary states", () => {

		const siblingIds = ["msg-v1", "msg-v2", "msg-v3"];

		const calculatePagerState = (activeId: string) => {
			const index = siblingIds.indexOf(activeId);
			const total = siblingIds.length;
			const hasPrev = index > 0;
			const hasNext = index < total - 1;
			const prevId = hasPrev ? siblingIds[index - 1] : undefined;
			const nextId = hasNext ? siblingIds[index + 1] : undefined;

			return {
				currentIndex: index,
				totalSiblings: total,
				hasPrev,
				hasNext,
				prevId,
				nextId,
			};
		};

		const first = calculatePagerState("msg-v1");
		assert.strictEqual(first.currentIndex, 0);
		assert.strictEqual(first.totalSiblings, 3);
		assert.strictEqual(first.hasPrev, false);
		assert.strictEqual(first.hasNext, true);
		assert.strictEqual(first.prevId, undefined);
		assert.strictEqual(first.nextId, "msg-v2");

		const mid = calculatePagerState("msg-v2");
		assert.strictEqual(mid.currentIndex, 1);
		assert.strictEqual(mid.totalSiblings, 3);
		assert.strictEqual(mid.hasPrev, true);
		assert.strictEqual(mid.hasNext, true);
		assert.strictEqual(mid.prevId, "msg-v1");
		assert.strictEqual(mid.nextId, "msg-v3");

		const last = calculatePagerState("msg-v3");
		assert.strictEqual(last.currentIndex, 2);
		assert.strictEqual(last.totalSiblings, 3);
		assert.strictEqual(last.hasPrev, true);
		assert.strictEqual(last.hasNext, false);
		assert.strictEqual(last.prevId, "msg-v2");
		assert.strictEqual(last.nextId, undefined);

	});

	test("resolves correct target parent for regenerate and retry actions", () => {

		const resolveTargetHead = (role: string, messageId: string, parentId: string | null) => {
			if (role === "assistant") {
				return parentId;
			}

			return messageId;
		};

		assert.strictEqual(resolveTargetHead("assistant", "asst-1", "user-1"), "user-1");
		assert.strictEqual(resolveTargetHead("assistant", "error-node", "user-2"), "user-2");
		assert.strictEqual(resolveTargetHead("user", "user-1", null), "user-1");

	});

});
