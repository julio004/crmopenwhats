import {
	ensureSchemaInitialized,
	getConversationById as getConversationByIdFromDb,
	listConversations as listConversationsFromDb,
	type ConversationListRow,
	pool,
} from "../db.ts";
import type { ConversationRow } from "../db-contract.ts";

export interface ConversationCrmIdentityRow {
	conversation_id: number;
	contact_id: number | null;
	contact_name: string | null;
	contact_phone: string | null;
	contact_jid: string | null;
	account_id: number | null;
	account_name: string | null;
	owner_user_id: number | null;
}

export interface ConversationCompatibilityRow extends ConversationListRow {
	contact_id?: number | null;
	contact_name?: string | null;
	contact_phone?: string | null;
	contact_jid?: string | null;
	account_id?: number | null;
	account_name?: string | null;
	owner_user_id?: number | null;
}

type BaseConversation = ConversationRow | ConversationListRow;

interface ConversationViewDeps {
	listConversations: (options?: {
		archived?: boolean;
		hasMessages?: boolean;
	}) => Promise<ConversationListRow[]>;
	getConversationById: (conversationId: number) => Promise<ConversationRow | null>;
	listCrmIdentityByConversationIds: (
		conversationIds: number[],
	) => Promise<ConversationCrmIdentityRow[]>;
}

function isDefaultName(name: string | null | undefined, phone: string | null | undefined): boolean {
	if (!name) return true;
	const cleanName = name.replace(/\+/g, "").trim();
	const cleanPhone = phone?.replace(/\+/g, "").trim();
	return cleanName === cleanPhone;
}

function enrichConversation(
	conversation: BaseConversation,
	identity?: ConversationCrmIdentityRow,
): ConversationCompatibilityRow {
	const hasFriendlyName = conversation.name && !isDefaultName(conversation.name, conversation.phone);
	return {
		...conversation,
		contact_id: identity?.contact_id ?? null,
		contact_name: identity?.contact_name ?? null,
		contact_phone: identity?.contact_phone ?? null,
		contact_jid: identity?.contact_jid ?? null,
		account_id: identity?.account_id ?? null,
		account_name: identity?.account_name ?? null,
		owner_user_id: identity?.owner_user_id ?? null,
		name: hasFriendlyName ? conversation.name : (identity?.contact_name ?? conversation.name),
		phone: identity?.contact_phone ?? conversation.phone,
		jid: identity?.contact_jid ?? conversation.jid,
	};
}

async function listCrmIdentityByConversationIds(
	conversationIds: number[],
): Promise<ConversationCrmIdentityRow[]> {
	if (conversationIds.length === 0) return [];
	await ensureSchemaInitialized();
	const result = await pool.query<ConversationCrmIdentityRow>(
		`SELECT
			l.conversation_id,
			l.contact_id,
			c.display_name AS contact_name,
			phone_method.value AS contact_phone,
			jid_method.value AS contact_jid,
			l.account_id,
			a.name AS account_name,
			COALESCE(c.owner_user_id, a.owner_user_id) AS owner_user_id
		 FROM conversation_crm_links l
		 LEFT JOIN crm_contacts c ON c.id = l.contact_id
		 LEFT JOIN crm_accounts a ON a.id = l.account_id
		 LEFT JOIN LATERAL (
		 	SELECT value
		 	FROM crm_contact_methods
		 	WHERE contact_id = c.id AND method_type = 'whatsapp_phone'
		 	ORDER BY is_primary DESC, id ASC
		 	LIMIT 1
		 ) phone_method ON TRUE
		 LEFT JOIN LATERAL (
		 	SELECT value
		 	FROM crm_contact_methods
		 	WHERE contact_id = c.id AND method_type = 'whatsapp_jid'
		 	ORDER BY is_primary DESC, id ASC
		 	LIMIT 1
		 ) jid_method ON TRUE
		 WHERE l.conversation_id = ANY($1::int[])`,
		[conversationIds],
	);
	return result.rows;
}

export function createConversationViewService(deps: ConversationViewDeps) {
	return {
		async listConversations(options: { archived?: boolean; hasMessages?: boolean } = {}) {
			const conversations = await deps.listConversations(options);
			const identities = await deps.listCrmIdentityByConversationIds(
				conversations.map((conversation) => conversation.id),
			);
			const identitiesByConversationId = new Map(
				identities.map((identity) => [identity.conversation_id, identity]),
			);
			return conversations.map((conversation) =>
				enrichConversation(
					conversation,
					identitiesByConversationId.get(conversation.id),
				),
			);
		},
		async getConversationById(conversationId: number) {
			const conversation = await deps.getConversationById(conversationId);
			if (!conversation) return null;
			const [identity] = await deps.listCrmIdentityByConversationIds([conversationId]);
			return enrichConversation(conversation, identity);
		},
	};
}

export const runtimeConversationViewService = createConversationViewService({
	listConversations: listConversationsFromDb,
	getConversationById: getConversationByIdFromDb,
	listCrmIdentityByConversationIds,
});
