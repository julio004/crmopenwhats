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

const iso = (value: string) => new Date(value);

describe("crm repository schema", () => {
	it("declares CRM identity and mapping tables", () => {
		for (const fragment of [
			"CREATE TABLE IF NOT EXISTS crm_accounts",
			"owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
			"CREATE TABLE IF NOT EXISTS crm_contacts",
			"CREATE TABLE IF NOT EXISTS crm_contact_methods",
			"normalized_value TEXT NOT NULL",
			"CREATE TABLE IF NOT EXISTS crm_contact_account_links",
			"UNIQUE(contact_id, account_id)",
			"CREATE TABLE IF NOT EXISTS conversation_crm_links",
			"conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE",
		]) {
			assert.match(
				DATABASE_SCHEMA_SQL,
				new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			);
		}
	});
});

describe("in-memory crm repository", () => {
	it("stores contacts independently from conversations and supports multi-method account links", async () => {
		const repo = createInMemoryCrmRepository();
		const account = await repo.createAccount({ name: "Acme", owner_user_id: 8 });
		const contact = await repo.createContact({ display_name: "Ana", owner_user_id: 3 });

		await repo.addContactMethod({
			contact_id: contact.id,
			method_type: "whatsapp_phone",
			value: "+54 9 11 5555 1111",
			normalized_value: "5491155551111",
			is_primary: true,
		});
		await repo.addContactMethod({
			contact_id: contact.id,
			method_type: "email",
			value: "ana@acme.test",
			normalized_value: "ana@acme.test",
		});
		await repo.linkContactToAccount({ contact_id: contact.id, account_id: account.id });

		assert.equal(contact.display_name, "Ana");
		assert.deepEqual(
			(await repo.listContactMethods(contact.id)).map((row) => row.method_type),
			["whatsapp_phone", "email"],
		);
		assert.deepEqual(
			(await repo.listAccountLinksByContactId(contact.id)).map((row) => row.account_id),
			[account.id],
		);
	});

	it("reassigns contact owners and records an audit snapshot", async () => {
		const repo = createInMemoryCrmRepository();
		const contact = await repo.createContact({ display_name: "Bruno", owner_user_id: 4, team_id: 2 });
		const changedAt = iso("2026-06-05T10:00:00.000Z");

		const updated = await repo.reassignContactOwner({
			contact_id: contact.id,
			owner_user_id: 7,
			actor_user_id: 9,
			team_id: 2,
			changed_at: changedAt,
		});
		const audits = await repo.listAuditEvents();

		assert.equal(updated.owner_user_id, 7);
		assert.equal(audits.length, 1);
		assert.equal(audits[0]?.action, "crm_contact.owner_reassigned");
		assert.deepEqual(audits[0]?.before_json, { owner_user_id: 4 });
		assert.deepEqual(audits[0]?.after_json, { owner_user_id: 7 });
		assert.equal(audits[0]?.created_at.toISOString(), changedAt.toISOString());
	});

	it("remaps conversations with before and after snapshots", async () => {
		const repo = createInMemoryCrmRepository();
		const firstContact = await repo.createContact({ display_name: "Carla", owner_user_id: 1 });
		const secondContact = await repo.createContact({ display_name: "Dani", owner_user_id: 2 });
		const firstAccount = await repo.createAccount({ name: "North", owner_user_id: 1 });
		const secondAccount = await repo.createAccount({ name: "South", owner_user_id: 2 });

		await repo.setConversationCrmLink({
			conversation_id: 42,
			contact_id: firstContact.id,
			account_id: firstAccount.id,
			actor_user_id: 11,
		});
		const remapped = await repo.setConversationCrmLink({
			conversation_id: 42,
			contact_id: secondContact.id,
			account_id: secondAccount.id,
			actor_user_id: 11,
		});
		const audits = await repo.listAuditEvents();

		assert.equal(remapped.contact_id, secondContact.id);
		assert.equal(remapped.account_id, secondAccount.id);
		assert.deepEqual(await repo.getConversationCrmLink(42), remapped);
		assert.equal(audits[1]?.action, "conversation.crm_remapped");
		assert.deepEqual(audits[1]?.before_json, {
			contact_id: firstContact.id,
			account_id: firstAccount.id,
		});
		assert.deepEqual(audits[1]?.after_json, {
			contact_id: secondContact.id,
			account_id: secondAccount.id,
		});
	});
});

	describe("postgres crm repository", () => {
	it("persists remaps and owner changes with audit-aware SQL boundaries", async () => {
		const pg = new FakePg();
		const changedAt = iso("2026-06-05T12:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT \* FROM crm_contacts/);
			assert.deepEqual(values, [3, 12]);
			return { rows: [{ id: 3, instance_id: 12, team_id: 2, display_name: "Ana", owner_user_id: 4, created_at: changedAt, updated_at: changedAt }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /UPDATE crm_contacts/);
			assert.match(text, /instance_id IS NOT DISTINCT FROM/);
			assert.deepEqual(values, [5, changedAt, 3, 12]);
			return { rows: [{ id: 3, instance_id: 12, team_id: 2, display_name: "Ana", owner_user_id: 5, created_at: changedAt, updated_at: changedAt }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO audit_events/);
			assert.equal(values?.[2], "crm_contact");
			assert.equal(values?.[4], "crm_contact.owner_reassigned");
			assert.deepEqual(values?.[5], { owner_user_id: 4 });
			assert.deepEqual(values?.[6], { owner_user_id: 5 });
			return { rows: [{ id: 1, action: "crm_contact.owner_reassigned" }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /FROM conversation_crm_links/);
			assert.match(text, /JOIN conversations/);
			assert.deepEqual(values, [77, 12]);
			return { rows: [{ id: 8, conversation_id: 77, contact_id: 1, account_id: 2, created_at: changedAt, updated_at: changedAt }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO conversation_crm_links/);
			assert.match(text, /instance_id IS NOT DISTINCT FROM/);
			assert.match(text, /ON CONFLICT \(conversation_id\) DO UPDATE/);
			assert.deepEqual(values, [77, 8, 13, changedAt, 12]);
			return { rows: [{ id: 9, conversation_id: 77, contact_id: 8, account_id: 13, created_at: changedAt, updated_at: changedAt }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO audit_events/);
			assert.equal(values?.[2], "conversation_crm_link");
			assert.equal(values?.[4], "conversation.crm_remapped");
			assert.deepEqual(values?.[5], { contact_id: 1, account_id: 2 });
			assert.deepEqual(values?.[6], { contact_id: 8, account_id: 13 });
			return { rows: [{ id: 2, action: "conversation.crm_linked" }] };
		});

		const repo = createPostgresCrmRepository(pg, { getTenantId: async () => 12 });

		await repo.reassignContactOwner({
			contact_id: 3,
			owner_user_id: 5,
			actor_user_id: 9,
			team_id: 2,
			changed_at: changedAt,
		});
		await repo.setConversationCrmLink({
			conversation_id: 77,
			contact_id: 8,
			account_id: 13,
			actor_user_id: 9,
			team_id: 2,
			updated_at: changedAt,
		});

		assert.equal(pg.calls.length, 6);
	});

	it("does not audit owner reassignment when the contact does not exist", async () => {
		const pg = new FakePg();
		const changedAt = iso("2026-06-05T13:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT \* FROM crm_contacts/);
			assert.deepEqual(values, [404, 12]);
			return { rows: [] };
		});

		const repo = createPostgresCrmRepository(pg, { getTenantId: async () => 12 });

		await assert.rejects(
			() =>
				repo.reassignContactOwner({
					contact_id: 404,
					owner_user_id: 9,
					actor_user_id: 7,
					team_id: 2,
					changed_at: changedAt,
				}),
			/CRM contact 404 not found/i,
		);

		assert.equal(pg.calls.length, 1);
	});

	it("enforces in-memory repository constraints and no-ops", async () => {
		const repo = createInMemoryCrmRepository();

		// 1. CHECK constraint: contact_id and account_id cannot both be null
		await assert.rejects(
			() => repo.setConversationCrmLink({ conversation_id: 1, contact_id: null, account_id: null }),
			/CHECK constraint violation/i,
		);

		// 2. FK constraint: contact_id must exist
		await assert.rejects(
			() => repo.setConversationCrmLink({ conversation_id: 1, contact_id: 999 }),
			/Foreign key constraint violation/i,
		);

		// 3. FK constraint: account_id must exist
		await assert.rejects(
			() => repo.setConversationCrmLink({ conversation_id: 1, contact_id: null, account_id: 999 }),
			/Foreign key constraint violation/i,
		);

		// Setup valid contact & account
		const contact = await repo.createContact({ display_name: "Val" });
		const account = await repo.createAccount({ name: "ValCorp" });

		// Successful link
		const link = await repo.setConversationCrmLink({ conversation_id: 1, contact_id: contact.id, account_id: account.id });
		assert.equal(link.contact_id, contact.id);

		const audits1 = await repo.listAuditEvents();
		assert.equal(audits1.length, 1);

		// No-op link should not produce another audit event
		await repo.setConversationCrmLink({ conversation_id: 1, contact_id: contact.id, account_id: account.id });
		const audits2 = await repo.listAuditEvents();
		assert.equal(audits2.length, 1); // unchanged!
	});

	it("executes postgres operations in a transaction client if connect method is present", async () => {
		const client = new FakePg();
		const pg = {
			connect: async () => client,
			query: async () => ({ rows: [] }),
		};

		const changedAt = iso("2026-06-05T13:00:00.000Z");

		// Transaction begin
		client.respondWith((text) => {
			assert.match(text, /BEGIN/);
			return { rows: [] };
		});
		// Mock the initial contact fetch on pg first
		client.respondWith((text) => {
			assert.match(text, /SELECT \* FROM crm_contacts/);
			return { rows: [{ id: 3, owner_user_id: 1, team_id: 2, created_at: changedAt, updated_at: changedAt }] };
		});
		// Update
		client.respondWith((text) => {
			assert.match(text, /UPDATE crm_contacts/);
			return { rows: [{ id: 3, owner_user_id: 5, team_id: 2 }] };
		});
		// Audit log
		client.respondWith((text) => {
			assert.match(text, /INSERT INTO audit_events/);
			return { rows: [] };
		});
		// Commit
		client.respondWith((text) => {
			assert.match(text, /COMMIT/);
			return { rows: [] };
		});

		let released = false;
		(client as any).release = () => {
			released = true;
		};

		const repo = createPostgresCrmRepository(pg as any);
		await repo.reassignContactOwner({
			contact_id: 3,
			owner_user_id: 5,
			changed_at: changedAt,
		});

		assert.ok(released);
		assert.equal(client.calls.length, 5); // SELECT, BEGIN, UPDATE, INSERT, COMMIT
	});
});
