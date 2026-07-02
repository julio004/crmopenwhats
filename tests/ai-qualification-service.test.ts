import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qualifyLeadAndCreateSuggestions } from "../src/lib/ai-qualification-service.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";

describe("AI qualification service", () => {
	it("persists AI lead suggestions from a structured model response", async () => {
		const repo = createInMemoryCrmRepository();
		const contact = await repo.createContact({ display_name: "Buyer" });

		const result = await qualifyLeadAndCreateSuggestions({
			conversation: { id: 90, contact_id: contact.id },
			history: [{ role: "user", content: "Necesito precios y una demo hoy" }],
			crmRepo: repo,
			aiClient: {
				qualifyLead: async () => ({
					ok: true,
					parsed: {
						intent: "pricing demo",
						urgency: "high",
						budget: "confirmed",
						fit: "high",
						objections: [],
						next_step: "Schedule demo",
						qualification_status: "qualified",
						confidence: 0.9,
						reason: "Customer asked for pricing and a demo today",
					},
				}),
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.qualification.lead_score, 92);
		assert.equal(result.suggestions_created, 3);

		const pending = await repo.listAiSuggestions({ conversation_id: 90, status: "pending" });
		assert.equal(pending.length, 3);
		assert.equal(pending.some((item) => item.action_type === "create_deal"), true);
		assert.equal(pending.some((item) => item.action_type === "route_to_human"), true);
	});

	it("returns a safe failure without creating suggestions when AI qualification fails", async () => {
		const repo = createInMemoryCrmRepository();

		const result = await qualifyLeadAndCreateSuggestions({
			conversation: { id: 91, contact_id: null },
			history: [{ role: "user", content: "hola" }],
			crmRepo: repo,
			aiClient: {
				qualifyLead: async () => ({ ok: false, reason: "network_error" }),
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.reason, "network_error");
		assert.deepEqual(await repo.listAiSuggestions({ conversation_id: 91 }), []);
	});
});
