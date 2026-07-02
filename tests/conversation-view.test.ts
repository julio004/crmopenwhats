import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConversationRow } from "../src/lib/db-contract.ts";
import {
	hashSessionToken,
	requireRequestRole,
} from "../src/lib/auth/session.ts";
import { createInMemoryAuthRepository } from "../src/lib/repositories/auth-repository.ts";
import {
	createConversationViewService,
	type ConversationCompatibilityRow,
} from "../src/lib/services/conversation-view.ts";
import { createConversationListRoute } from "../src/app/api/conversations/route.ts";
import { createConversationPatchRoute } from "../src/app/api/conversations/[conversationId]/route.ts";
import { createInMemoryCrmRepository } from "../src/lib/repositories/crm-repository.ts";

const NOW = new Date("2026-06-05T15:00:00.000Z");

function makeConversation(overrides: Partial<ConversationRow> = {}): ConversationRow {
	return {
		id: 41,
		instance_id: null,
		phone: "5491112345678",
		jid: "5491112345678@s.whatsapp.net",
		name: "Legacy Name",
		profile_picture_url: null,
		profile_picture_fetched_at: null,
		mode: "AI",
		mode_reason: null,
		mode_changed_at: null,
		mode_changed_by: null,
		followup_attempts: 0,
		last_followup_at: null,
		followup_blocked_at: null,
		followup_blocked_reason: null,
		last_message_at: NOW,
		last_user_message_at: NOW,
		last_assistant_message_at: null,
		last_human_message_at: null,
		last_owner_intervention_at: null,
		last_ai_reactivated_at: null,
		unread_count: 1,
		is_archived: false,
		lead_labels: [],
		lead_score: null,
		lead_score_reason: null,
		lead_updated_at: null,
		lead_updated_by: null,
		created_at: NOW,
		updated_at: NOW,
		...overrides,
	};
}

describe("conversation compatibility view service", () => {
	it("returns backward-compatible conversation rows enriched with linked CRM identity", async () => {
		const service = createConversationViewService({
			listConversations: async () => [
				{
					...makeConversation({ name: null }),
					last_message_content: "Hola",
					last_message_role: "user",
				},
			],
			getConversationById: async () => null,
			listCrmIdentityByConversationIds: async () => [
				{
					conversation_id: 41,
					contact_id: 7,
					contact_name: "Ana CRM",
					contact_phone: "5491199988877",
					contact_jid: "5491199988877@s.whatsapp.net",
					account_id: 11,
					account_name: "Acme SA",
					owner_user_id: 99,
				},
			],
		});

		const rows = await service.listConversations({ archived: false, hasMessages: true });

		assert.equal(rows.length, 1);
		assert.deepEqual(rows[0] satisfies ConversationCompatibilityRow, {
			...makeConversation(),
			last_message_content: "Hola",
			last_message_role: "user",
			contact_id: 7,
			contact_name: "Ana CRM",
			contact_phone: "5491199988877",
			contact_jid: "5491199988877@s.whatsapp.net",
			account_id: 11,
			account_name: "Acme SA",
			owner_user_id: 99,
			name: "Ana CRM",
			phone: "5491199988877",
			jid: "5491199988877@s.whatsapp.net",
		});
	});

	it("keeps legacy conversation identity when no CRM mapping exists", async () => {
		const service = createConversationViewService({
			listConversations: async () => [makeConversation({ id: 88, name: null, jid: null })],
			getConversationById: async () => null,
			listCrmIdentityByConversationIds: async () => [],
		});

		const rows = await service.listConversations();

		assert.equal(rows[0]?.contact_id, null);
		assert.equal(rows[0]?.account_id, null);
		assert.equal(rows[0]?.owner_user_id, null);
		assert.equal(rows[0]?.phone, "5491112345678");
		assert.equal(rows[0]?.jid, null);
	});

	it("preserves manual/friendly conversation names and does not overwrite with CRM contact name", async () => {
		const service = createConversationViewService({
			listConversations: async () => [
				{
					...makeConversation({ name: "Custom Nickname" }),
					last_message_content: "Hola",
					last_message_role: "user",
				},
			],
			getConversationById: async () => null,
			listCrmIdentityByConversationIds: async () => [
				{
					conversation_id: 41,
					contact_id: 7,
					contact_name: "Ana CRM",
					contact_phone: "5491199988877",
					contact_jid: "5491199988877@s.whatsapp.net",
					account_id: 11,
					account_name: "Acme SA",
					owner_user_id: 99,
				},
			],
		});

		const rows = await service.listConversations();

		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.name, "Custom Nickname");
		assert.equal(rows[0]?.contact_name, "Ana CRM");
	});
});

describe("conversation routes compatibility payload", () => {
	it("GET /api/conversations returns compatible rows plus linked CRM fields", async () => {
		const compatRow: ConversationCompatibilityRow = {
			...makeConversation({ id: 55 }),
			contact_id: 9,
			contact_name: "Lara",
			contact_phone: "5491100000000",
			contact_jid: "5491100000000@s.whatsapp.net",
			account_id: 12,
			account_name: "Northwind",
			owner_user_id: 5,
			name: "Lara",
			phone: "5491100000000",
			jid: "5491100000000@s.whatsapp.net",
			last_message_content: "Necesito precio",
			last_message_role: "user",
		};
		const GET = createConversationListRoute({
			requireViewer: async () => undefined,
			listConversations: async (options) => {
				assert.deepEqual(options, { archived: true, hasMessages: true });
				return [compatRow];
			},
		});

		const response = await GET(
			new Request("http://localhost/api/conversations?archived=true&hasMessages=true"),
		);

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), [
			{
				...compatRow,
				created_at: compatRow.created_at.toISOString(),
				updated_at: compatRow.updated_at.toISOString(),
				last_message_at: compatRow.last_message_at?.toISOString(),
				last_user_message_at: compatRow.last_user_message_at?.toISOString(),
			},
		]);
	});

	it("GET /api/conversations rejects requests without a durable viewer session", async () => {
		const repo = createInMemoryAuthRepository();
		let listCalls = 0;
		const GET = createConversationListRoute({
			requireViewer: (req: Request) => requireRequestRole(req, { repo, now: () => NOW }, "viewer"),
			listConversations: async () => {
				listCalls += 1;
				return [{ id: 1 }];
			},
		} as any);

		const response = await GET(new Request("http://localhost/api/conversations"));

		assert.equal(response.status, 401);
		assert.deepEqual(await response.json(), { error: "auth_unauthorized" });
		assert.equal(listCalls, 0);
	});

	it("GET /api/conversations rejects revoked durable sessions and allows viewer access", async () => {
		const repo = createInMemoryAuthRepository();
		const team = await repo.createTeam({ name: "Core" });
		const user = await repo.createUser({ email: "viewer@example.com" });
		await repo.addTeamMembership({ team_id: team.id, user_id: user.id, role: "viewer" });
		const viewerSession = await repo.createSession({
			user_id: user.id,
			session_token_hash: hashSessionToken("viewer-token"),
			expires_at: new Date(NOW.getTime() + 60_000),
		});
		assert.ok(viewerSession.id > 0);

		const revokedToken = "revoked-token";
		const revokedSession = await repo.createSession({
			user_id: user.id,
			session_token_hash: hashSessionToken(revokedToken),
			expires_at: new Date(NOW.getTime() + 60_000),
		});
		await repo.revokeSessionByTokenHash(revokedSession.session_token_hash, NOW);

		const activeRow: ConversationCompatibilityRow = {
			...makeConversation({ id: 77 }),
			contact_id: 3,
			contact_name: "Viewer OK",
			contact_phone: null,
			contact_jid: null,
			account_id: null,
			account_name: null,
			owner_user_id: 8,
		};
		let listCalls = 0;
		const GET = createConversationListRoute({
			requireViewer: (req: Request) => requireRequestRole(req, { repo, now: () => NOW }, "viewer"),
			listConversations: async () => {
				listCalls += 1;
				return [activeRow];
			},
		} as any);

		const revokedResponse = await GET(
			new Request("http://localhost/api/conversations", {
				headers: { cookie: `bot_session=${revokedToken}` },
			}),
		);
		assert.equal(revokedResponse.status, 401);
		assert.deepEqual(await revokedResponse.json(), { error: "auth_unauthorized" });
		assert.equal(listCalls, 0);

		const allowedResponse = await GET(
			new Request("http://localhost/api/conversations", {
				headers: { cookie: "bot_session=viewer-token" },
			}),
		);
		assert.equal(allowedResponse.status, 200);
		assert.equal(listCalls, 1);
		const json = await allowedResponse.json();
		assert.equal(json[0].contact_name, "Viewer OK");
		assert.equal(json[0].owner_user_id, 8);
	});

	it("PATCH /api/conversations/[conversationId] returns the compatibility payload after update", async () => {
		const compatRow: ConversationCompatibilityRow = {
			...makeConversation({ id: 91, name: "Legacy", phone: "5491133332222" }),
			contact_id: 20,
			contact_name: "Mapped Contact",
			contact_phone: "5491144445555",
			contact_jid: "5491144445555@s.whatsapp.net",
			account_id: 30,
			account_name: "Mapped Account",
			owner_user_id: 15,
			name: "Mapped Contact",
			phone: "5491144445555",
			jid: "5491144445555@s.whatsapp.net",
		};
		const PATCH = createConversationPatchRoute({
			requireAgent: async () => undefined,
			getConversationById: async (conversationId) =>
				conversationId === 91 ? makeConversation({ id: 91, name: "Legacy" }) : null,
			updateConversation: async (conversationId, patch) => {
				assert.equal(conversationId, 91);
				assert.equal(patch.name, "Nuevo nombre");
				return makeConversation({ id: 91, name: "Nuevo nombre" });
			},
			getConversationViewById: async (conversationId) => {
				assert.equal(conversationId, 91);
				return compatRow;
			},
		});

		const response = await PATCH(
			new Request("http://localhost/api/conversations/91", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Nuevo nombre" }),
			}),
			{ params: Promise.resolve({ conversationId: "91" }) },
		);

		assert.equal(response.status, 200);
		const json = await response.json();
		assert.equal(json.name, "Nuevo nombre");
		assert.equal(json.contact_name, "Mapped Contact");
		assert.equal(json.account_name, "Mapped Account");
		assert.equal(json.owner_user_id, 15);
		assert.equal(json.phone, "5491144445555");
	});

	it("creates a new CRM contact on PATCH if it does not exist, and updates it on subsequent edits", async () => {
		const crmRepo = createInMemoryCrmRepository();
		const conversation = makeConversation({ id: 101, name: "Original Name", phone: "5491199998888", jid: "5491199998888@s.whatsapp.net" });
		
		const PATCH = createConversationPatchRoute({
			requireAgent: async () => undefined,
			getConversationById: async (id) => (id === 101 ? conversation : null),
			updateConversation: async (id, patch) => {
				if (patch.name !== undefined) conversation.name = patch.name as string | null;
				return conversation;
			},
			getConversationViewById: async (id) => {
				const link = await crmRepo.getConversationCrmLink(id);
				const contact = link ? await crmRepo.getContactById(link.contact_id!) : null;
				return {
					...conversation,
					contact_id: contact?.id ?? null,
					contact_name: contact?.display_name ?? null,
				};
			},
			crmRepo,
		});

		// 1. Primer PATCH: Debería crear un contacto CRM y el enlace correspondiente
		const res1 = await PATCH(
			new Request("http://localhost/api/conversations/101", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Cliente CRM" }),
			}),
			{ params: Promise.resolve({ conversationId: "101" }) },
		);

		assert.equal(res1.status, 200);
		const data1 = await res1.json();
		assert.equal(data1.name, "Cliente CRM");
		assert.equal(data1.contact_name, "Cliente CRM");
		assert.ok(data1.contact_id);

		// Verificar que el contacto y métodos existan en crmRepo
		const contactId = data1.contact_id;
		const contact = await crmRepo.getContactById(contactId);
		assert.ok(contact);
		assert.equal(contact.display_name, "Cliente CRM");

		const methods = await crmRepo.listContactMethods(contactId);
		const phoneMethod = methods.find((m) => m.method_type === "whatsapp_phone");
		assert.ok(phoneMethod);
		assert.equal(phoneMethod.value, "5491199998888");

		// 2. Segundo PATCH: Debería actualizar el contacto CRM existente en lugar de duplicarlo
		const res2 = await PATCH(
			new Request("http://localhost/api/conversations/101", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Cliente CRM Modificado" }),
			}),
			{ params: Promise.resolve({ conversationId: "101" }) },
		);

		assert.equal(res2.status, 200);
		const data2 = await res2.json();
		assert.equal(data2.name, "Cliente CRM Modificado");
		assert.equal(data2.contact_name, "Cliente CRM Modificado");
		assert.equal(data2.contact_id, contactId);

		const contactUpdated = await crmRepo.getContactById(contactId);
		assert.equal(contactUpdated?.display_name, "Cliente CRM Modificado");
	});
});
