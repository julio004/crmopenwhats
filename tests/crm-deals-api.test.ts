import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import { createDealsRoute } from "../src/app/api/crm/deals/route.ts";
import { createDealDetailRoute } from "../src/app/api/crm/deals/[dealId]/route.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";
import { AuthError } from "../src/lib/auth/session.ts";

const mockRequireViewer = async (req: Request) => {
	const authHeader = req.headers.get("cookie") ?? "";
	if (authHeader.includes("invalid")) throw new AuthError(401, "auth_unauthorized");
	if (authHeader.includes("viewer-only")) return { user: { id: 3 }, teamId: 1 };
	return { user: { id: 2 }, teamId: 1 };
};

const mockRequireAgent = async (req: Request) => {
	const authHeader = req.headers.get("cookie") ?? "";
	if (authHeader.includes("invalid")) throw new AuthError(401, "auth_unauthorized");
	if (authHeader.includes("viewer-only")) throw new AuthError(403, "auth_forbidden");
	return { user: { id: 2 }, teamId: 1 };
};

describe("crm deals api routes", () => {
	it("performs deals CRUD operations and enforces RBAC", async () => {
		const crmRepo = createInMemoryCrmRepository();
		const contact = await crmRepo.createContact({ display_name: "Customer A" });

		const listAndCreateRoute = createDealsRoute({
			requireViewer: mockRequireViewer,
			requireAgent: mockRequireAgent,
			crmRepo,
		});

		const detailRoute = createDealDetailRoute({
			requireAgent: mockRequireAgent,
			crmRepo,
		});

		// 1. GET (list initially empty)
		const listReqEmpty = new Request(`http://localhost/api/crm/deals?contactId=${contact.id}`, {
			headers: { cookie: "bot_session=viewer-only" },
		});
		const listResEmpty = await listAndCreateRoute.GET(listReqEmpty);
		assert.equal(listResEmpty.status, 200);
		assert.deepEqual(await listResEmpty.json(), []);

		// 2. POST (fail with 403 for viewer-only role)
		const createReqForbidden = new Request("http://localhost/api/crm/deals", {
			method: "POST",
			headers: {
				cookie: "bot_session=viewer-only",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				title: "Forbidden Deal",
				contactId: contact.id,
			}),
		});
		const createResForbidden = await listAndCreateRoute.POST(createReqForbidden);
		assert.equal(createResForbidden.status, 403);

		// 3. POST (succeed with agent role)
		const createReqOk = new Request("http://localhost/api/crm/deals", {
			method: "POST",
			headers: {
				cookie: "bot_session=agent",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				title: "Enterprise Upgrade",
				amount: 12000,
				stage: "lead",
				contactId: contact.id,
			}),
		});
		const createResOk = await listAndCreateRoute.POST(createReqOk);
		assert.equal(createResOk.status, 201);
		const createdDeal = await createResOk.json();
		assert.equal(createdDeal.id, 1);
		assert.equal(createdDeal.title, "Enterprise Upgrade");
		assert.equal(createdDeal.amount, 12000);

		// 4. GET (list now contains the deal)
		const listReqWithDeals = new Request(`http://localhost/api/crm/deals?contactId=${contact.id}`, {
			headers: { cookie: "bot_session=viewer-only" },
		});
		const listResWithDeals = await listAndCreateRoute.GET(listReqWithDeals);
		assert.equal(listResWithDeals.status, 200);
		const dealsList = await listResWithDeals.json();
		assert.equal(dealsList.length, 1);
		assert.equal(dealsList[0].id, 1);

		// 5. PATCH (update deal amount and stage)
		const patchReq = new Request("http://localhost/api/crm/deals/1", {
			method: "PATCH",
			headers: {
				cookie: "bot_session=agent",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				amount: 15000,
				stage: "proposal_sent",
			}),
		});
		const patchRes = await detailRoute.PATCH(patchReq, { params: Promise.resolve({ dealId: "1" }) });
		assert.equal(patchRes.status, 200);
		const updatedDeal = await patchRes.json();
		assert.equal(updatedDeal.amount, 15000);
		assert.equal(updatedDeal.stage, "proposal_sent");

		// 6. DELETE (delete deal)
		const deleteReq = new Request("http://localhost/api/crm/deals/1", {
			method: "DELETE",
			headers: { cookie: "bot_session=agent" },
		});
		const deleteRes = await detailRoute.DELETE(deleteReq, { params: Promise.resolve({ dealId: "1" }) });
		assert.equal(deleteRes.status, 200);
		assert.deepEqual(await deleteRes.json(), { ok: true });

		// 7. GET (list is empty again)
		const listReqEmptyFinal = new Request(`http://localhost/api/crm/deals?contactId=${contact.id}`, {
			headers: { cookie: "bot_session=viewer-only" },
		});
		const listResEmptyFinal = await listAndCreateRoute.GET(listReqEmptyFinal);
		assert.deepEqual(await listResEmptyFinal.json(), []);
	});
});
