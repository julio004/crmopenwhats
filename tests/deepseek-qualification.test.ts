import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDeepSeekClient } from "../src/lib/deepseek-client.ts";

describe("DeepSeek lead qualification", () => {
	it("requests strict JSON qualification and parses the response", async () => {
		let requestBody: any = null;
		const client = createDeepSeekClient({
			apiKey: "secret",
			model: "deepseek-chat",
			baseUrl: "https://deepseek.test/v1",
			fetch: async (_url, init) => {
				requestBody = JSON.parse(String(init?.body));
				return {
					ok: true,
					status: 200,
					json: async () => ({
						choices: [
							{
								message: {
									content: JSON.stringify({
										intent: "pricing demo",
										urgency: "high",
										budget: "confirmed",
										fit: "high",
										objections: ["timeline"],
										next_step: "Call lead",
										qualification_status: "qualified",
										confidence: 0.89,
										reason: "Asked for prices and demo",
									}),
								},
							},
						],
					}),
				};
			},
		});

		const result = await client.qualifyLead({
			history: [{ role: "user", content: "Quiero precios y demo" }],
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.parsed.ok, true);
		if (!result.parsed.ok) return;
		assert.equal(result.parsed.intent, "pricing demo");
		assert.equal(result.parsed.qualification_status, "qualified");
		assert.match(requestBody.messages.at(-1).content, /lead qualification/i);
		assert.deepEqual(requestBody.response_format, { type: "json_object" });
	});
});
