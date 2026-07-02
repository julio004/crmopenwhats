import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	normalizeCrmTaskInput,
	normalizeCrmTaskPatch,
} from "../src/lib/crm-tasks.ts";

describe("CRM task normalization", () => {
	it("normalizes a Trello-style CRM task linked to a conversation and lead label", () => {
		const due = new Date("2026-06-05T15:00:00.000Z");

		assert.deepEqual(
			normalizeCrmTaskInput({
				conversation_id: "12",
				title: "  Llamar al cliente  ",
				description: "  Confirmar presupuesto  ",
				status: "in_progress",
				task_type: "set_label",
				lead_label: "caliente",
				priority: "high",
				due_at: due.toISOString(),
			}),
			{
				conversation_id: 12,
				title: "Llamar al cliente",
				description: "Confirmar presupuesto",
				status: "in_progress",
				task_type: "set_label",
				lead_label: "caliente",
				priority: "high",
				due_at: due,
			},
		);
	});

	it("defaults optional task fields and rejects an empty title", () => {
		assert.deepEqual(normalizeCrmTaskInput({ title: "Seguimiento" }), {
			conversation_id: null,
			title: "Seguimiento",
			description: null,
			status: "pending",
			task_type: "custom",
			lead_label: null,
			priority: "medium",
			due_at: null,
		});

		assert.throws(
			() => normalizeCrmTaskInput({ title: "   " }),
			/Task title is required/,
		);
	});

	it("normalizes partial updates without requiring all fields", () => {
		assert.deepEqual(normalizeCrmTaskPatch({ status: "done" }), {
			status: "done",
		});
		assert.deepEqual(normalizeCrmTaskPatch({ lead_label: "" }), {
			lead_label: null,
		});
	});
});
