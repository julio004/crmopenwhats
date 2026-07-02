import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPipelineRoute } from "../src/app/api/crm/pipeline/route.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";

const requireViewer = async () => ({ user: { id: 1 }, teamId: 1 });

describe("crm pipeline API", () => {
	it("returns deals grouped by commercial stage with totals", async () => {
		const crmRepo = createInMemoryCrmRepository();
		const contact = await crmRepo.createContact({ display_name: "Pipeline buyer" });
		await crmRepo.createDeal({
			title: "Lead deal",
			contact_id: contact.id,
			amount: 1000,
			stage: "lead",
		});
		await crmRepo.createDeal({
			title: "Won deal",
			contact_id: contact.id,
			amount: 3000,
			stage: "won",
		});

		const route = createPipelineRoute({ requireViewer, crmRepo });
		const res = await route.GET(new Request("http://localhost/api/crm/pipeline"));

		assert.equal(res.status, 200);
		const body = await res.json();
		assert.equal(body.total_amount, 4000);
		assert.equal(body.stages.lead.count, 1);
		assert.equal(body.stages.lead.amount, 1000);
		assert.equal(body.stages.won.count, 1);
		assert.equal(body.stages.won.deals[0].title, "Won deal");
	});
});
