import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthError } from "../src/lib/auth/session.ts";
import { createSuggestionsRoute } from "../src/app/api/crm/suggestions/route.ts";
import { createSuggestionDetailRoute } from "../src/app/api/crm/suggestions/[suggestionId]/route.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";

const requireViewer = async (req: Request) => {
	const cookie = req.headers.get("cookie") ?? "";
	if (cookie.includes("invalid")) throw new AuthError(401, "auth_unauthorized");
	return { user: { id: 1 }, teamId: 1 };
};

const requireAgent = async (req: Request) => {
	const cookie = req.headers.get("cookie") ?? "";
	if (cookie.includes("viewer-only")) throw new AuthError(403, "auth_forbidden");
	return { user: { id: 2 }, teamId: 1 };
};

describe("crm AI suggestions API", () => {
	it("lists pending suggestions and lets agents approve or reject them", async () => {
		const crmRepo = createInMemoryCrmRepository();
		const created = await crmRepo.createAiSuggestion({
			conversation_id: 12,
			contact_id: null,
			action_type: "create_task",
			payload: { title: "Follow up", priority: "medium" },
			confidence: 0.72,
			reason: "Asked for more info",
			requires_confirmation: false,
			source: "lead_qualification",
		});

		const listRoute = createSuggestionsRoute({ requireViewer, crmRepo });
		const detailRoute = createSuggestionDetailRoute({ requireAgent, crmRepo });

		const listRes = await listRoute.GET(
			new Request("http://localhost/api/crm/suggestions?status=pending", {
				headers: { cookie: "bot_session=viewer" },
			}),
		);
		assert.equal(listRes.status, 200);
		const listed = await listRes.json();
		assert.equal(listed.length, 1);
		assert.equal(listed[0].id, created.id);

		const forbidden = await detailRoute.PATCH(
			new Request("http://localhost/api/crm/suggestions/1", {
				method: "PATCH",
				headers: { cookie: "bot_session=viewer-only" },
				body: JSON.stringify({ status: "approved" }),
			}),
			{ params: Promise.resolve({ suggestionId: String(created.id) }) },
		);
		assert.equal(forbidden.status, 403);

		const approved = await detailRoute.PATCH(
			new Request("http://localhost/api/crm/suggestions/1", {
				method: "PATCH",
				headers: { cookie: "bot_session=agent", "content-type": "application/json" },
				body: JSON.stringify({ status: "approved", resolutionNote: "Looks right" }),
			}),
			{ params: Promise.resolve({ suggestionId: String(created.id) }) },
		);
		assert.equal(approved.status, 200);
		const body = await approved.json();
		assert.equal(body.status, "approved");
		assert.equal(body.resolution_note, "Looks right");
	});
});
