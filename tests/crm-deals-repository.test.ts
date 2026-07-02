import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DATABASE_SCHEMA_SQL } from "../src/lib/db-contract.ts";
import {
	createInMemoryCrmRepository,
	createPostgresCrmRepository,
} from "../src/lib/repositories/crm-repository.ts";

class FakePg {
	calls: { text: string; values?: unknown[] }[] = [];
	private responders: ((text: string, values?: unknown[]) => { rows: unknown[] })[] = [];

	respondWith(responder: (text: string, values?: unknown[]) => { rows: unknown[] }) {
		this.responders.push(responder);
	}

	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		this.calls.push({ text, values: values ? [...values] : undefined });
		const responder = this.responders.shift();
		return (responder ? responder(text, values ? [...values] : undefined) : { rows: [] }) as { rows: T[] };
	}
}

describe("crm deals schema", () => {
	it("declares crm_deals table and indexes", () => {
		for (const fragment of [
			"CREATE TABLE IF NOT EXISTS crm_deals",
			"stage TEXT CHECK(stage IN ('lead','contacted','proposal_sent','won','lost'))",
			"contact_id INTEGER REFERENCES crm_contacts(id) ON DELETE CASCADE",
			"account_id INTEGER REFERENCES crm_accounts(id) ON DELETE CASCADE",
			"CONSTRAINT chk_deal_owner CHECK (contact_id IS NOT NULL OR account_id IS NOT NULL)",
			"CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(instance_id, contact_id)",
			"CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals(instance_id, account_id)",
			"CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(instance_id, updated_at DESC, id DESC)",
		]) {
			assert.match(
				DATABASE_SCHEMA_SQL,
				new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			);
		}
	});
});

describe("in-memory crm deals repository", () => {
	it("performs full CRUD and records audit events", async () => {
		const repo = createInMemoryCrmRepository();
		const contact = await repo.createContact({ display_name: "John Doe" });

		// 1. Create Deal
		const deal = await repo.createDeal({
			title: "Consulting Project",
			amount: 5000,
			stage: "lead",
			contact_id: contact.id,
			actor_user_id: 1,
		});

		assert.equal(deal.id, 1);
		assert.equal(deal.title, "Consulting Project");
		assert.equal(deal.amount, 5000);
		assert.equal(deal.stage, "lead");
		assert.equal(deal.contact_id, contact.id);

		// Verify audit
		let audits = await repo.listAuditEvents();
		const createdAudit = audits.find((a) => a.action === "crm.deal_created");
		assert.ok(createdAudit);
		assert.equal(createdAudit.entity_type, "crm_deal");
		assert.equal(createdAudit.entity_id, "1");
		assert.equal(createdAudit.actor_user_id, 1);

		// 2. Read Deal
		const found = await repo.findDealById(1);
		assert.ok(found);
		assert.equal(found.title, "Consulting Project");

		const contactDeals = await repo.listDealsByContactId(contact.id);
		assert.equal(contactDeals.length, 1);
		assert.equal(contactDeals[0].id, 1);

		// 3. Update Deal
		const updated = await repo.updateDeal(1, {
			stage: "won",
			amount: 6000,
			actor_user_id: 2,
		});
		assert.equal(updated.stage, "won");
		assert.equal(updated.amount, 6000);

		// Verify audit updated
		audits = await repo.listAuditEvents();
		const updatedAudit = audits.find((a) => a.action === "crm.deal_updated");
		assert.ok(updatedAudit);
		assert.deepEqual(updatedAudit.before_json, { stage: "lead", amount: 5000 });
		assert.deepEqual(updatedAudit.after_json, { stage: "won", amount: 6000 });
		assert.equal(updatedAudit.actor_user_id, 2);

		// 4. Delete Deal
		const deletedOk = await repo.deleteDeal(1, { actor_user_id: 1 });
		assert.ok(deletedOk);

		const notFound = await repo.findDealById(1);
		assert.equal(notFound, null);

		// Verify audit deleted
		audits = await repo.listAuditEvents();
		const deletedAudit = audits.find((a) => a.action === "crm.deal_deleted");
		assert.ok(deletedAudit);
		assert.equal(deletedAudit.entity_id, "1");
	});
});

describe("postgres crm deals repository", () => {
	it("translates deal operations to SQL queries and audits", async () => {
		const pg = new FakePg();
		const repo = createPostgresCrmRepository(pg, { getTenantId: async () => 44 });

		// findDealById
		pg.respondWith(() => ({ rows: [{ id: 10, title: "Postgres Deal" }] }));
		const deal = await repo.findDealById(10);
		assert.ok(deal);
		assert.equal(deal.id, 10);
		assert.match(pg.calls[0].text, /instance_id IS NOT DISTINCT FROM/);
		assert.deepEqual(pg.calls[0].values, [10, 44]);

		// createDeal
		pg.respondWith(() => ({ rows: [{ id: 15, title: "SQL Deal", stage: "lead" }] }));
		pg.respondWith(() => ({ rows: [] })); // audit query responder
		await repo.createDeal({
			title: "SQL Deal",
			contact_id: 20,
			actor_user_id: 5,
		});
		assert.match(pg.calls[1].text, /INSERT INTO crm_deals/);
		assert.match(pg.calls[1].text, /instance_id/);
		assert.equal(pg.calls[1].values?.[0], 44);
		assert.match(pg.calls[2].text, /INSERT INTO audit_events/);
		assert.equal(pg.calls[2].values?.[4], "crm.deal_created");
	});

	it("scopes pipeline and delete queries by tenant instance", async () => {
		const pg = new FakePg();
		const repo = createPostgresCrmRepository(pg, { getTenantId: async () => 44 });

		pg.respondWith((text, values) => {
			assert.match(text, /WHERE instance_id IS NOT DISTINCT FROM \$1/);
			assert.deepEqual(values, [44]);
			return { rows: [] };
		});
		await repo.listDealsPipeline();

		pg.respondWith(() => ({ rows: [{ id: 12, instance_id: 44, title: "Deal" }] }));
		pg.respondWith((text, values) => {
			assert.match(text, /DELETE FROM crm_deals/);
			assert.match(text, /instance_id IS NOT DISTINCT FROM/);
			assert.deepEqual(values, [12, 44]);
			return { rows: [{ id: 12 }] };
		});
		pg.respondWith(() => ({ rows: [] }));
		assert.equal(await repo.deleteDeal(12), true);
	});
});
