import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createConfiguredChatClient } from "../src/lib/ai-providers.ts";

describe("MiniMax chat provider", () => {
	it("uses MiniMax as an OpenAI-compatible chat-only provider", async () => {
		const calls: Array<{ url: string; body: any }> = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push({
				url,
				body: JSON.parse(String(init?.body ?? "{}")),
			});
			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({
									response: { part_1: "Hola", part_2: "", part_3: "" },
									handoff: { required: false, reason: "" },
								}),
							},
						},
					],
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		try {
			const client = createConfiguredChatClient({
				chat_ai_provider: "minimax",
				chat_ai_api_key: "mk-test",
				chat_ai_model: "MiniMax-M2.7",
			});

			const result = await client.generateNormalReply({
				systemPrompt: "Responde breve.",
				history: [],
				queuedMessages: [{ text: "Hola" }],
			});

			assert.equal(result.ok, true);
			assert.equal(calls[0].url, "https://api.minimax.io/v1/chat/completions");
			assert.equal(calls[0].body.model, "MiniMax-M2.7");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
