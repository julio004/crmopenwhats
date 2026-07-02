import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createContact360Route } from "../src/app/api/crm/contacts/[contactId]/route.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";

const requireViewer = async () => ({ user: { id: 1 }, teamId: 1 });

describe("crm contact 360 API", () => {
	it("returns the unified contact profile for viewers", async () => {
		const crmRepo = createInMemoryCrmRepository();
		const contact = await crmRepo.createContact({ display_name: "Contact 360" });
		await crmRepo.addContactMethod({
			contact_id: contact.id,
			method_type: "phone",
			value: "+1555000111",
		});
		await crmRepo.createDeal({ title: "Pipeline deal", contact_id: contact.id });

		const route = createContact360Route({ requireViewer, crmRepo });
		const res = await route.GET(new Request("http://localhost/api/crm/contacts/1"), {
			params: Promise.resolve({ contactId: String(contact.id) }),
		});

		assert.equal(res.status, 200);
		const body = await res.json();
		assert.equal(body.contact.display_name, "Contact 360");
		assert.equal(body.methods[0].value, "+1555000111");
		assert.equal(body.deals[0].title, "Pipeline deal");
	});
});
