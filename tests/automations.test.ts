import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeAutomationInput } from "../src/lib/automations.ts";

describe("safe automation definitions", () => {
	it("normalizes a safe automation with predefined blocks only", () => {
		const automation = normalizeAutomationInput({
			name: "Responder precio",
			enabled: true,
			definition: {
				trigger: { type: "incoming_message" },
				conditions: [{ type: "message_contains", value: "precio" }],
				actions: [{ type: "send_whatsapp", value: "Te paso la información." }],
			},
		});

		assert.equal(automation.name, "Responder precio");
		assert.equal(automation.enabled, true);
		assert.equal(automation.definition.trigger.type, "incoming_message");
		assert.deepEqual(automation.definition.conditions, [
			{ type: "message_contains", value: "precio" },
		]);
	});

	it("rejects unsafe or empty automation blocks", () => {
		assert.throws(
			() =>
				normalizeAutomationInput({
					name: "SQL libre",
					definition: {
						trigger: { type: "incoming_message" },
						conditions: [{ type: "sql" as any, value: "DROP TABLE messages" }],
						actions: [{ type: "send_whatsapp", value: "ok" }],
					},
				}),
			/invalid_automation_condition/,
		);

		assert.throws(
			() =>
				normalizeAutomationInput({
					name: "Sin acciones",
					definition: {
						trigger: { type: "incoming_message" },
						conditions: [{ type: "always" }],
						actions: [],
					},
				}),
			/invalid_automation_actions/,
		);
	});
});
