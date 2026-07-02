import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CRM_RISKY_AI_ACTIONS,
	buildLeadQualificationSuggestions,
	normalizeAiLeadQualification,
} from "../src/lib/ai-crm.ts";

describe("AI CRM qualification", () => {
	it("normalizes a hot lead into scored CRM suggestions requiring human confirmation", () => {
		const qualification = normalizeAiLeadQualification({
			intent: "buy",
			urgency: "high",
			budget: "confirmed",
			fit: "high",
			objections: ["needs onboarding"],
			next_step: "Book a demo today",
			qualification_status: "qualified",
			confidence: 0.91,
			reason: "Asked for pricing and implementation timing",
		});

		assert.equal(qualification.lead_score, 92);
		assert.deepEqual(qualification.lead_labels, ["caliente", "cliente_potencial"]);
		assert.equal(qualification.requires_human_review, true);

		const suggestions = buildLeadQualificationSuggestions({
			conversation_id: 7,
			contact_id: 3,
			qualification,
		});

		assert.equal(suggestions.length, 3);
		assert.deepEqual(
			suggestions.map((item) => item.action_type),
			["create_task", "create_deal", "route_to_human"],
		);
		assert.equal(suggestions.every((item) => item.requires_confirmation), true);
		assert.equal(suggestions[0].payload.title, "Book a demo today");
	});

	it("normalizes weak signals into a low-risk follow-up suggestion", () => {
		const qualification = normalizeAiLeadQualification({
			intent: "support",
			urgency: "low",
			budget: "unknown",
			fit: "medium",
			next_step: "Ask what problem they want to solve",
			qualification_status: "unqualified",
			confidence: 0.42,
			reason: "Only asked a broad question",
		});

		assert.equal(qualification.lead_score, 32);
		assert.deepEqual(qualification.lead_labels, ["frio"]);
		assert.equal(qualification.requires_human_review, false);

		const suggestions = buildLeadQualificationSuggestions({
			conversation_id: 8,
			contact_id: null,
			qualification,
		});

		assert.equal(suggestions.length, 1);
		assert.equal(suggestions[0].action_type, "create_task");
		assert.equal(suggestions[0].requires_confirmation, false);
		assert.equal(suggestions[0].payload.priority, "low");
	});

	it("classifies deal, routing and reply actions as risky AI actions", () => {
		assert.equal(CRM_RISKY_AI_ACTIONS.has("create_deal"), true);
		assert.equal(CRM_RISKY_AI_ACTIONS.has("update_deal_stage"), true);
		assert.equal(CRM_RISKY_AI_ACTIONS.has("send_reply"), true);
		assert.equal(CRM_RISKY_AI_ACTIONS.has("create_task"), false);
	});
});
