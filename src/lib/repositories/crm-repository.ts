import type {
	AiCrmSuggestionRow,
	AiSuggestionAction,
	AiSuggestionStatus,
	AuditEventRow,
	ConversationCrmLinkRow,
	CrmAccountRow,
	CrmContactAccountLinkRow,
	CrmContactMethodRow,
	CrmContactRow,
	CrmDealRow,
} from "../db-contract.ts";

type Queryable = {
	query<T = unknown>(
		text: string,
		values?: readonly unknown[],
	): Promise<{ rows: T[] }>;
};

const nowDate = () => new Date();
const normalizeMethodValue = (value: string) => value.trim();
const mappingSnapshot = (
	row:
		| Pick<ConversationCrmLinkRow, "contact_id" | "account_id">
		| null
		| undefined,
) => ({
	contact_id: row?.contact_id ?? null,
	account_id: row?.account_id ?? null,
});

const hasConnect = (db: any): db is { connect: () => Promise<any> } => {
	return db && typeof db.connect === "function";
};

type CrmRepositoryOptions = {
	/**
	 * Tenant scope for CRM data. In this product the WhatsApp instance is the
	 * tenant boundary, persisted as `instance_id` in the database.
	 */
	getTenantId?: () => Promise<number | null> | number | null;
};

const resolveTenantId = async (options?: CrmRepositoryOptions) =>
	options?.getTenantId ? await options.getTenantId() : null;

export interface CrmRepository {
	createAccount(input: {
		team_id?: number | null;
		name: string;
		owner_user_id?: number | null;
		created_at?: Date;
	}): Promise<CrmAccountRow>;
	createContact(input: {
		team_id?: number | null;
		display_name?: string | null;
		owner_user_id?: number | null;
		created_at?: Date;
	}): Promise<CrmContactRow>;
	getContactById(contactId: number): Promise<CrmContactRow | null>;
	getContact360(contactId: number): Promise<{
		contact: CrmContactRow;
		methods: CrmContactMethodRow[];
		account_links: CrmContactAccountLinkRow[];
		deals: CrmDealRow[];
		ai_suggestions: AiCrmSuggestionRow[];
	} | null>;
	updateContact(
		id: number,
		patch: {
			display_name?: string | null;
			owner_user_id?: number | null;
			team_id?: number | null;
			updated_at?: Date;
		},
	): Promise<CrmContactRow>;
	addContactMethod(input: {
		contact_id: number;
		method_type: string;
		value: string;
		normalized_value?: string;
		is_primary?: boolean;
		created_at?: Date;
	}): Promise<CrmContactMethodRow>;
	listContactMethods(contactId: number): Promise<CrmContactMethodRow[]>;
	linkContactToAccount(input: {
		contact_id: number;
		account_id: number;
		created_at?: Date;
	}): Promise<CrmContactAccountLinkRow>;
	listAccountLinksByContactId(
		contactId: number,
	): Promise<CrmContactAccountLinkRow[]>;
	reassignContactOwner(input: {
		contact_id: number;
		owner_user_id: number | null;
		actor_user_id?: number | null;
		team_id?: number | null;
		request_metadata?: Record<string, unknown>;
		changed_at?: Date;
	}): Promise<CrmContactRow>;
	getConversationCrmLink(
		conversationId: number,
	): Promise<ConversationCrmLinkRow | null>;
	setConversationCrmLink(input: {
		conversation_id: number;
		contact_id: number | null;
		account_id?: number | null;
		actor_user_id?: number | null;
		team_id?: number | null;
		request_metadata?: Record<string, unknown>;
		updated_at?: Date;
	}): Promise<ConversationCrmLinkRow>;
	findDealById(id: number): Promise<CrmDealRow | null>;
	listDealsPipeline(): Promise<CrmDealRow[]>;
	listDealsByContactId(contactId: number): Promise<CrmDealRow[]>;
	listDealsByAccountId(accountId: number): Promise<CrmDealRow[]>;
	createDeal(input: {
		team_id?: number | null;
		title: string;
		description?: string | null;
		amount?: number | null;
		currency?: string;
		stage?: "lead" | "contacted" | "proposal_sent" | "won" | "lost";
		contact_id?: number | null;
		account_id?: number | null;
		owner_user_id?: number | null;
		expected_close_date?: Date | null;
		created_at?: Date;
		actor_user_id?: number | null;
		request_metadata?: Record<string, unknown>;
	}): Promise<CrmDealRow>;
	updateDeal(
		id: number,
		patch: {
			title?: string;
			description?: string | null;
			amount?: number | null;
			currency?: string;
			stage?: "lead" | "contacted" | "proposal_sent" | "won" | "lost";
			contact_id?: number | null;
			account_id?: number | null;
			owner_user_id?: number | null;
			expected_close_date?: Date | null;
			actor_user_id?: number | null;
			team_id?: number | null;
			request_metadata?: Record<string, unknown>;
			updated_at?: Date;
		},
	): Promise<CrmDealRow>;
	deleteDeal(id: number, input?: {
		actor_user_id?: number | null;
		team_id?: number | null;
		request_metadata?: Record<string, unknown>;
		deleted_at?: Date;
	}): Promise<boolean>;
	createAiSuggestion(input: {
		conversation_id: number;
		contact_id?: number | null;
		deal_id?: number | null;
		action_type: AiSuggestionAction;
		payload: Record<string, unknown>;
		confidence?: number | null;
		reason: string;
		requires_confirmation?: boolean;
		source?: string;
		actor_user_id?: number | null;
		team_id?: number | null;
		created_at?: Date;
	}): Promise<AiCrmSuggestionRow>;
	listAiSuggestions(filter?: {
		conversation_id?: number;
		status?: AiSuggestionStatus;
	}): Promise<AiCrmSuggestionRow[]>;
	updateAiSuggestionStatus(
		id: number,
		input: {
			status: Extract<AiSuggestionStatus, "approved" | "rejected" | "expired">;
			actor_user_id?: number | null;
			team_id?: number | null;
			resolution_note?: string | null;
			resolved_at?: Date;
		},
	): Promise<AiCrmSuggestionRow>;
	listAuditEvents(): Promise<AuditEventRow[]>;
}

async function recordAudit(
	db: Queryable,
	input: {
		actor_user_id?: number | null;
		team_id?: number | null;
		entity_type: string;
		entity_id: string;
		action: string;
		before_json?: Record<string, unknown>;
		after_json?: Record<string, unknown>;
		request_metadata?: Record<string, unknown>;
		created_at: Date;
	},
) {
	await db.query(
		`INSERT INTO audit_events (
		 actor_user_id, team_id, entity_type, entity_id, action,
		 before_json, after_json, request_metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[
			input.actor_user_id ?? null,
			input.team_id ?? null,
			input.entity_type,
			input.entity_id,
			input.action,
			input.before_json ?? {},
			input.after_json ?? {},
			input.request_metadata ?? {},
			input.created_at,
		],
	);
}

export function createPostgresCrmRepository(
	db: Queryable,
	options?: CrmRepositoryOptions,
): CrmRepository {
	return {
		async createAccount(input) {
			const tenantId = await resolveTenantId(options);
			const at = input.created_at ?? nowDate();
			const result = await db.query<CrmAccountRow>(
				`INSERT INTO crm_accounts (instance_id, team_id, name, owner_user_id, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $5)
				 RETURNING *`,
				[tenantId, input.team_id ?? null, input.name, input.owner_user_id ?? null, at],
			);
			return result.rows[0];
		},
		async createContact(input) {
			const tenantId = await resolveTenantId(options);
			const at = input.created_at ?? nowDate();
			const result = await db.query<CrmContactRow>(
				`INSERT INTO crm_contacts (instance_id, team_id, display_name, owner_user_id, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $5)
				 RETURNING *`,
				[
					tenantId,
					input.team_id ?? null,
					input.display_name ?? null,
					input.owner_user_id ?? null,
					at,
				],
			);
			return result.rows[0];
		},
		async getContactById(contactId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmContactRow>(
				"SELECT * FROM crm_contacts WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $2 LIMIT 1",
				[contactId, tenantId],
			);
			return result.rows[0] ?? null;
		},
		async getContact360(contactId) {
			const contact = await this.getContactById(contactId);
			if (!contact) return null;
			const [methods, accountLinks, deals, suggestions] = await Promise.all([
				this.listContactMethods(contactId),
				this.listAccountLinksByContactId(contactId),
				this.listDealsByContactId(contactId),
				db.query<AiCrmSuggestionRow>(
					"SELECT * FROM crm_ai_suggestions WHERE contact_id = $1 AND instance_id IS NOT DISTINCT FROM $2 ORDER BY created_at DESC, id DESC",
					[contactId, await resolveTenantId(options)],
				).then((result) => result.rows),
			]);
			return {
				contact,
				methods,
				account_links: accountLinks,
				deals,
				ai_suggestions: suggestions,
			};
		},
		async updateContact(id, patch) {
			const tenantId = await resolveTenantId(options);
			const at = patch.updated_at ?? nowDate();
			const result = await db.query<CrmContactRow>(
				`UPDATE crm_contacts
				 SET display_name = COALESCE($1, display_name),
				     owner_user_id = COALESCE($2, owner_user_id),
				     team_id = COALESCE($3, team_id),
				     updated_at = $4
				 WHERE id = $5 AND instance_id IS NOT DISTINCT FROM $6
				 RETURNING *`,
				[
					patch.display_name ?? null,
					patch.owner_user_id ?? null,
					patch.team_id ?? null,
					at,
					id,
					tenantId,
				],
			);
			const row = result.rows[0];
			if (!row) {
				throw new Error(`CRM contact ${id} not found`);
			}
			return row;
		},
		async addContactMethod(input) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmContactMethodRow>(
				`INSERT INTO crm_contact_methods (
				 instance_id, contact_id, method_type, value, normalized_value, is_primary, created_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7)
				RETURNING *`,
				[
					tenantId,
					input.contact_id,
					input.method_type,
					input.value,
					input.normalized_value ?? normalizeMethodValue(input.value),
					input.is_primary ?? false,
					input.created_at ?? nowDate(),
				],
			);
			return result.rows[0];
		},
		async listContactMethods(contactId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmContactMethodRow>(
				"SELECT * FROM crm_contact_methods WHERE contact_id = $1 AND instance_id IS NOT DISTINCT FROM $2 ORDER BY id ASC",
				[contactId, tenantId],
			);
			return result.rows;
		},
		async linkContactToAccount(input) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmContactAccountLinkRow>(
				`INSERT INTO crm_contact_account_links (contact_id, account_id, created_at)
				 SELECT $1, $2, $3
				 WHERE EXISTS (
				   SELECT 1 FROM crm_contacts WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $4
				 )
				 AND EXISTS (
				   SELECT 1 FROM crm_accounts WHERE id = $2 AND instance_id IS NOT DISTINCT FROM $4
				 )
				 RETURNING *`,
				[input.contact_id, input.account_id, input.created_at ?? nowDate(), tenantId],
			);
			const row = result.rows[0];
			if (!row) {
				throw new Error(
					`CRM contact/account link cannot cross tenant boundaries`,
				);
			}
			return row;
		},
		async listAccountLinksByContactId(contactId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmContactAccountLinkRow>(
				`SELECT l.*
				 FROM crm_contact_account_links l
				 JOIN crm_contacts c ON c.id = l.contact_id
				 WHERE l.contact_id = $1 AND c.instance_id IS NOT DISTINCT FROM $2
				 ORDER BY l.id ASC`,
				[contactId, tenantId],
			);
			return result.rows;
		},
		async reassignContactOwner(input) {
			const tenantId = await resolveTenantId(options);
			const client = (hasConnect(db) ? await db.connect() : db) as Queryable;
			try {
				if (hasConnect(db)) {
					await client.query("BEGIN");
				}
				const beforeResult = await client.query<CrmContactRow>(
					"SELECT * FROM crm_contacts WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $2 LIMIT 1",
					[input.contact_id, tenantId]
				);
				const before = beforeResult.rows[0];
				if (!before) {
					throw new Error(`CRM contact ${input.contact_id} not found`);
				}
				if (before.owner_user_id === input.owner_user_id) {
					if (hasConnect(db)) {
						await client.query("COMMIT");
					}
					return before;
				}

				const at = input.changed_at ?? nowDate();
				const result = await client.query<CrmContactRow>(
					`UPDATE crm_contacts
					 SET owner_user_id = $1, updated_at = $2
					 WHERE id = $3 AND instance_id IS NOT DISTINCT FROM $4
					 RETURNING *`,
					[input.owner_user_id, at, input.contact_id, tenantId],
				);
				const row = result.rows[0];
				if (!row) {
					throw new Error(`CRM contact ${input.contact_id} not found`);
				}
				await recordAudit(client, {
					actor_user_id: input.actor_user_id,
					team_id: input.team_id ?? row.team_id ?? before.team_id ?? null,
					entity_type: "crm_contact",
					entity_id: String(input.contact_id),
					action: "crm_contact.owner_reassigned",
					before_json: { owner_user_id: before.owner_user_id ?? null },
					after_json: { owner_user_id: row.owner_user_id ?? null },
					request_metadata: input.request_metadata,
					created_at: at,
				});
				if (hasConnect(db)) {
					await client.query("COMMIT");
				}
				return row;
			} catch (error) {
				if (hasConnect(db)) {
					await client.query("ROLLBACK").catch(() => {});
				}
				throw error;
			} finally {
				if (hasConnect(db) && typeof (client as any).release === "function") {
					(client as any).release();
				}
			}
		},
		async getConversationCrmLink(conversationId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<ConversationCrmLinkRow>(
				`SELECT l.*
				 FROM conversation_crm_links l
				 JOIN conversations c ON c.id = l.conversation_id
				 WHERE l.conversation_id = $1 AND c.instance_id IS NOT DISTINCT FROM $2
				 LIMIT 1`,
				[conversationId, tenantId],
			);
			return result.rows[0] ?? null;
		},
		async setConversationCrmLink(input) {
			const tenantId = await resolveTenantId(options);
			const client = (hasConnect(db) ? await db.connect() : db) as Queryable;
			try {
				if (hasConnect(db)) {
					await client.query("BEGIN");
				}
				const beforeResult = await client.query<ConversationCrmLinkRow>(
					`SELECT l.*
					 FROM conversation_crm_links l
					 JOIN conversations c ON c.id = l.conversation_id
					 WHERE l.conversation_id = $1 AND c.instance_id IS NOT DISTINCT FROM $2
					 LIMIT 1`,
					[input.conversation_id, tenantId]
				);
				const before = beforeResult.rows[0] ?? null;
				const isNoOp = before &&
					before.contact_id === input.contact_id &&
					(input.account_id === undefined || before.account_id === input.account_id);
				if (isNoOp) {
					if (hasConnect(db)) {
						await client.query("COMMIT");
					}
					return before!;
				}

				const at = input.updated_at ?? nowDate();
				const result = await client.query<ConversationCrmLinkRow>(
					`INSERT INTO conversation_crm_links (
					 conversation_id, contact_id, account_id, created_at, updated_at
					)
					SELECT $1, $2, $3, $4, $4
					WHERE EXISTS (
					  SELECT 1 FROM conversations WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $5
					)
					AND ($2::integer IS NULL OR EXISTS (
					  SELECT 1 FROM crm_contacts WHERE id = $2 AND instance_id IS NOT DISTINCT FROM $5
					))
					AND ($3::integer IS NULL OR EXISTS (
					  SELECT 1 FROM crm_accounts WHERE id = $3 AND instance_id IS NOT DISTINCT FROM $5
					))
					ON CONFLICT (conversation_id) DO UPDATE
					SET contact_id = EXCLUDED.contact_id,
					    account_id = EXCLUDED.account_id,
					    updated_at = EXCLUDED.updated_at
					RETURNING *`,
					[
						input.conversation_id,
						input.contact_id,
						input.account_id ?? null,
						at,
						tenantId,
					],
				);
				const row = result.rows[0];
				if (!row) {
					throw new Error(
						`Conversation CRM link ${input.conversation_id} cannot cross tenant boundaries`,
					);
				}
				await recordAudit(client, {
					actor_user_id: input.actor_user_id,
					team_id: input.team_id ?? null,
					entity_type: "conversation_crm_link",
					entity_id: String(input.conversation_id),
					action: before ? "conversation.crm_remapped" : "conversation.crm_linked",
					before_json: mappingSnapshot(before),
					after_json: mappingSnapshot(row),
					request_metadata: input.request_metadata,
					created_at: at,
				});
				if (hasConnect(db)) {
					await client.query("COMMIT");
				}
				return row;
			} catch (error) {
				if (hasConnect(db)) {
					await client.query("ROLLBACK").catch(() => {});
				}
				throw error;
			} finally {
				if (hasConnect(db) && typeof (client as any).release === "function") {
					(client as any).release();
				}
			}
		},
		async findDealById(id) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmDealRow>(
				"SELECT * FROM crm_deals WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $2 LIMIT 1",
				[id, tenantId],
			);
			return result.rows[0] ?? null;
		},
		async listDealsPipeline() {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmDealRow>(
				"SELECT * FROM crm_deals WHERE instance_id IS NOT DISTINCT FROM $1 ORDER BY updated_at DESC, id DESC",
				[tenantId],
			);
			return result.rows;
		},
		async listDealsByContactId(contactId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmDealRow>(
				"SELECT * FROM crm_deals WHERE contact_id = $1 AND instance_id IS NOT DISTINCT FROM $2 ORDER BY id DESC",
				[contactId, tenantId],
			);
			return result.rows;
		},
		async listDealsByAccountId(accountId) {
			const tenantId = await resolveTenantId(options);
			const result = await db.query<CrmDealRow>(
				"SELECT * FROM crm_deals WHERE account_id = $1 AND instance_id IS NOT DISTINCT FROM $2 ORDER BY id DESC",
				[accountId, tenantId],
			);
			return result.rows;
		},
		async createDeal(input) {
			const tenantId = await resolveTenantId(options);
			const at = input.created_at ?? nowDate();
			const result = await db.query<CrmDealRow>(
				`INSERT INTO crm_deals (
				  instance_id, team_id, title, description, amount, currency, stage,
				  contact_id, account_id, owner_user_id, expected_close_date,
				  created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
				RETURNING *`,
				[
					tenantId,
					input.team_id ?? null,
					input.title,
					input.description ?? null,
					input.amount ?? null,
					input.currency ?? "USD",
					input.stage ?? "lead",
					input.contact_id ?? null,
					input.account_id ?? null,
					input.owner_user_id ?? null,
					input.expected_close_date ?? null,
					at,
				],
			);
			const row = result.rows[0];
			await recordAudit(db, {
				actor_user_id: input.actor_user_id,
				team_id: input.team_id ?? null,
				entity_type: "crm_deal",
				entity_id: String(row.id),
				action: "crm.deal_created",
				before_json: {},
				after_json: { ...row },
				request_metadata: input.request_metadata,
				created_at: at,
			});
			return row;
		},
		async updateDeal(id, patch) {
			const tenantId = await resolveTenantId(options);
			const at = patch.updated_at ?? nowDate();
			const before = await this.findDealById(id);
			if (!before) throw new Error(`CRM deal ${id} not found`);

			const result = await db.query<CrmDealRow>(
				`UPDATE crm_deals
				 SET title = COALESCE($1, title),
				     description = COALESCE($2, description),
				     amount = COALESCE($3, amount),
				     currency = COALESCE($4, currency),
				     stage = COALESCE($5, stage),
				     contact_id = COALESCE($6, contact_id),
				     account_id = COALESCE($7, account_id),
				     owner_user_id = COALESCE($8, owner_user_id),
				     expected_close_date = COALESCE($9, expected_close_date),
				     updated_at = $10
				 WHERE id = $11 AND instance_id IS NOT DISTINCT FROM $12
				 RETURNING *`,
				[
					patch.title ?? null,
					patch.description ?? null,
					patch.amount ?? null,
					patch.currency ?? null,
					patch.stage ?? null,
					patch.contact_id ?? null,
					patch.account_id ?? null,
					patch.owner_user_id ?? null,
					patch.expected_close_date ?? null,
					at,
					id,
					tenantId,
				],
			);
			const row = result.rows[0];
			if (!row) throw new Error(`CRM deal ${id} not found`);

			if (patch.stage !== undefined || patch.amount !== undefined) {
				await recordAudit(db, {
					actor_user_id: patch.actor_user_id,
					team_id: patch.team_id ?? null,
					entity_type: "crm_deal",
					entity_id: String(id),
					action: "crm.deal_updated",
					before_json: { stage: before.stage, amount: before.amount },
					after_json: { stage: row.stage, amount: row.amount },
					request_metadata: patch.request_metadata,
					created_at: at,
				});
			}
			return row;
		},
		async deleteDeal(id, input) {
			const tenantId = await resolveTenantId(options);
			const at = input?.deleted_at ?? nowDate();
			const before = await this.findDealById(id);
			if (!before) return false;

			const result = await db.query(
				"DELETE FROM crm_deals WHERE id = $1 AND instance_id IS NOT DISTINCT FROM $2 RETURNING id",
				[id, tenantId],
			);
			if (result.rows.length === 0) return false;

			await recordAudit(db, {
				actor_user_id: input?.actor_user_id,
				team_id: input?.team_id ?? null,
				entity_type: "crm_deal",
				entity_id: String(id),
				action: "crm.deal_deleted",
				before_json: { ...before },
				after_json: {},
				request_metadata: input?.request_metadata,
				created_at: at,
			});
			return true;
		},
		async createAiSuggestion(input) {
			const tenantId = await resolveTenantId(options);
			const at = input.created_at ?? nowDate();
			const result = await db.query<AiCrmSuggestionRow>(
				`INSERT INTO crm_ai_suggestions (
				  instance_id, conversation_id, contact_id, deal_id, action_type, payload,
				  confidence, reason, requires_confirmation, source, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
				RETURNING *`,
				[
					tenantId,
					input.conversation_id,
					input.contact_id ?? null,
					input.deal_id ?? null,
					input.action_type,
					input.payload,
					input.confidence ?? null,
					input.reason,
					input.requires_confirmation ?? true,
					input.source ?? "lead_qualification",
					at,
				],
			);
			const row = result.rows[0];
			await recordAudit(db, {
				actor_user_id: input.actor_user_id,
				team_id: input.team_id ?? null,
				entity_type: "crm_ai_suggestion",
				entity_id: String(row.id),
				action: "crm.ai_suggestion_created",
				before_json: {},
				after_json: { action_type: row.action_type, status: row.status },
				request_metadata: { source: row.source, confidence: row.confidence },
				created_at: at,
			});
			return row;
		},
		async listAiSuggestions(filter = {}) {
			const tenantId = await resolveTenantId(options);
			const clauses: string[] = [];
			const values: unknown[] = [tenantId];
			clauses.push("instance_id IS NOT DISTINCT FROM $1");
			if (filter.conversation_id !== undefined) {
				values.push(filter.conversation_id);
				clauses.push(`conversation_id = $${values.length}`);
			}
			if (filter.status !== undefined) {
				values.push(filter.status);
				clauses.push(`status = $${values.length}`);
			}
			const result = await db.query<AiCrmSuggestionRow>(
				`SELECT * FROM crm_ai_suggestions WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC`,
				values,
			);
			return result.rows;
		},
		async updateAiSuggestionStatus(id, input) {
			const tenantId = await resolveTenantId(options);
			const at = input.resolved_at ?? nowDate();
			const result = await db.query<AiCrmSuggestionRow>(
				`UPDATE crm_ai_suggestions
				 SET status = $1,
				     resolved_by_user_id = $2,
				     resolution_note = $3,
				     resolved_at = $4,
				     updated_at = $4
				 WHERE id = $5 AND instance_id IS NOT DISTINCT FROM $6
				 RETURNING *`,
				[
					input.status,
					input.actor_user_id ?? null,
					input.resolution_note ?? null,
					at,
					id,
					tenantId,
				],
			);
			const row = result.rows[0];
			if (!row) throw new Error(`CRM AI suggestion ${id} not found`);
			await recordAudit(db, {
				actor_user_id: input.actor_user_id,
				team_id: input.team_id ?? null,
				entity_type: "crm_ai_suggestion",
				entity_id: String(id),
				action: `crm.ai_suggestion_${input.status}`,
				before_json: { status: "pending" },
				after_json: { status: input.status },
				request_metadata: { resolution_note: input.resolution_note ?? null },
				created_at: at,
			});
			return row;
		},
		async listAuditEvents() {
			const result = await db.query<AuditEventRow>(
				"SELECT * FROM audit_events ORDER BY id ASC",
			);
			return result.rows;
		},
	};
}

export function createInMemoryCrmRepository(): CrmRepository {
	const accounts: CrmAccountRow[] = [];
	const contacts: CrmContactRow[] = [];
	const methods: CrmContactMethodRow[] = [];
	const accountLinks: CrmContactAccountLinkRow[] = [];
	const conversationLinks: ConversationCrmLinkRow[] = [];
	const audits: AuditEventRow[] = [];
	const deals: CrmDealRow[] = [];
	const suggestions: AiCrmSuggestionRow[] = [];
	let nextAccountId = 1;
	let nextContactId = 1;
	let nextMethodId = 1;
	let nextAccountLinkId = 1;
	let nextConversationLinkId = 1;
	let nextAuditId = 1;
	let nextDealId = 1;
	let nextSuggestionId = 1;

	return {
		async createAccount(input) {
			const at = input.created_at ?? nowDate();
			const row: CrmAccountRow = {
				id: nextAccountId++,
				instance_id: null,
				team_id: input.team_id ?? null,
				name: input.name,
				owner_user_id: input.owner_user_id ?? null,
				created_at: at,
				updated_at: at,
			};
			accounts.push(row);
			return row;
		},
		async createContact(input) {
			const at = input.created_at ?? nowDate();
			const row: CrmContactRow = {
				id: nextContactId++,
				instance_id: null,
				team_id: input.team_id ?? null,
				display_name: input.display_name ?? null,
				owner_user_id: input.owner_user_id ?? null,
				created_at: at,
				updated_at: at,
			};
			contacts.push(row);
			return row;
		},
		async getContactById(contactId) {
			return contacts.find((row) => row.id === contactId) ?? null;
		},
		async getContact360(contactId) {
			const contact = await this.getContactById(contactId);
			if (!contact) return null;
			return {
				contact,
				methods: await this.listContactMethods(contactId),
				account_links: await this.listAccountLinksByContactId(contactId),
				deals: await this.listDealsByContactId(contactId),
				ai_suggestions: suggestions
					.filter((item) => item.contact_id === contactId)
					.sort((a, b) => b.id - a.id),
			};
		},
		async updateContact(id, patch) {
			const row = contacts.find((c) => c.id === id);
			if (!row) throw new Error(`CRM contact ${id} not found`);
			if (patch.display_name !== undefined) row.display_name = patch.display_name;
			if (patch.owner_user_id !== undefined) row.owner_user_id = patch.owner_user_id;
			if (patch.team_id !== undefined) row.team_id = patch.team_id;
			row.updated_at = patch.updated_at ?? nowDate();
			return row;
		},
		async addContactMethod(input) {
			const row: CrmContactMethodRow = {
				id: nextMethodId++,
				instance_id: null,
				contact_id: input.contact_id,
				method_type: input.method_type,
				value: input.value,
				normalized_value: input.normalized_value ?? normalizeMethodValue(input.value),
				is_primary: input.is_primary ?? false,
				created_at: input.created_at ?? nowDate(),
			};
			methods.push(row);
			return row;
		},
		async listContactMethods(contactId) {
			return methods.filter((row) => row.contact_id === contactId);
		},
		async linkContactToAccount(input) {
			const row: CrmContactAccountLinkRow = {
				id: nextAccountLinkId++,
				contact_id: input.contact_id,
				account_id: input.account_id,
				created_at: input.created_at ?? nowDate(),
			};
			accountLinks.push(row);
			return row;
		},
		async listAccountLinksByContactId(contactId) {
			return accountLinks.filter((row) => row.contact_id === contactId);
		},
		async reassignContactOwner(input) {
			const row = contacts.find((contact) => contact.id === input.contact_id);
			if (!row) throw new Error(`CRM contact ${input.contact_id} not found`);
			const beforeOwner = row.owner_user_id;
			if (beforeOwner === input.owner_user_id) {
				return row;
			}
			row.owner_user_id = input.owner_user_id;
			row.updated_at = input.changed_at ?? nowDate();
			audits.push({
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? row.team_id ?? null,
				entity_type: "crm_contact",
				entity_id: String(row.id),
				action: "crm_contact.owner_reassigned",
				before_json: { owner_user_id: beforeOwner },
				after_json: { owner_user_id: row.owner_user_id },
				request_metadata: input.request_metadata ?? {},
				created_at: row.updated_at,
			});
			return row;
		},
		async getConversationCrmLink(conversationId) {
			return (
				conversationLinks.find((row) => row.conversation_id === conversationId) ?? null
			);
		},
		async setConversationCrmLink(input) {
			// 1. CHECK constraint: contact_id and account_id cannot both be null
			if (input.contact_id === null && (input.account_id === undefined || input.account_id === null)) {
				throw new Error("CHECK constraint violation: conversation_crm_links must link to a contact or an account");
			}
			// 2. Foreign Key constraint: contact_id must exist if not null
			if (input.contact_id !== null) {
				const contactExists = contacts.some((c) => c.id === input.contact_id);
				if (!contactExists) {
					throw new Error("Foreign key constraint violation: contact does not exist");
				}
			}
			// 3. Foreign Key constraint: account_id must exist if not null/undefined
			if (input.account_id !== undefined && input.account_id !== null) {
				const accountExists = accounts.some((a) => a.id === input.account_id);
				if (!accountExists) {
					throw new Error("Foreign key constraint violation: account does not exist");
				}
			}

			const existing =
				conversationLinks.find((row) => row.conversation_id === input.conversation_id) ??
				null;
			const isNoOp = existing &&
				existing.contact_id === input.contact_id &&
				(input.account_id === undefined || existing.account_id === input.account_id);
			if (isNoOp) {
				return existing!;
			}

			const at = input.updated_at ?? nowDate();
			const before = existing ? mappingSnapshot(existing) : { contact_id: null, account_id: null };
			const row = existing ?? {
				id: nextConversationLinkId++,
				conversation_id: input.conversation_id,
				contact_id: null,
				account_id: null,
				created_at: at,
				updated_at: at,
			};
			row.contact_id = input.contact_id;
			row.account_id = input.account_id ?? null;
			row.updated_at = at;
			if (!existing) conversationLinks.push(row);
			audits.push({
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? null,
				entity_type: "conversation_crm_link",
				entity_id: String(input.conversation_id),
				action: existing ? "conversation.crm_remapped" : "conversation.crm_linked",
				before_json: before,
				after_json: mappingSnapshot(row),
				request_metadata: input.request_metadata ?? {},
				created_at: at,
			});
			return row;
		},
		async findDealById(id) {
			return deals.find((d) => d.id === id) ?? null;
		},
		async listDealsPipeline() {
			return [...deals].sort((a, b) => b.id - a.id);
		},
		async listDealsByContactId(contactId) {
			return deals.filter((d) => d.contact_id === contactId).sort((a, b) => b.id - a.id);
		},
		async listDealsByAccountId(accountId) {
			return deals.filter((d) => d.account_id === accountId).sort((a, b) => b.id - a.id);
		},
		async createDeal(input) {
			const at = input.created_at ?? nowDate();
			const row: CrmDealRow = {
				id: nextDealId++,
				instance_id: null,
				team_id: input.team_id ?? null,
				title: input.title,
				description: input.description ?? null,
				amount: input.amount ?? null,
				currency: input.currency ?? "USD",
				stage: input.stage ?? "lead",
				contact_id: input.contact_id ?? null,
				account_id: input.account_id ?? null,
				owner_user_id: input.owner_user_id ?? null,
				expected_close_date: input.expected_close_date ?? null,
				created_at: at,
				updated_at: at,
			};
			deals.push(row);
			audits.push({
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? null,
				entity_type: "crm_deal",
				entity_id: String(row.id),
				action: "crm.deal_created",
				before_json: {},
				after_json: { ...row },
				request_metadata: input.request_metadata ?? {},
				created_at: at,
			});
			return row;
		},
		async updateDeal(id, patch) {
			const at = patch.updated_at ?? nowDate();
			const row = deals.find((d) => d.id === id);
			if (!row) throw new Error(`CRM deal ${id} not found`);
			const beforeStage = row.stage;
			const beforeAmount = row.amount;

			if (patch.title !== undefined) row.title = patch.title;
			if (patch.description !== undefined) row.description = patch.description;
			if (patch.amount !== undefined) row.amount = patch.amount;
			if (patch.currency !== undefined) row.currency = patch.currency;
			if (patch.stage !== undefined) row.stage = patch.stage;
			if (patch.contact_id !== undefined) row.contact_id = patch.contact_id;
			if (patch.account_id !== undefined) row.account_id = patch.account_id;
			if (patch.owner_user_id !== undefined) row.owner_user_id = patch.owner_user_id;
			if (patch.expected_close_date !== undefined) row.expected_close_date = patch.expected_close_date;
			row.updated_at = at;

			if (patch.stage !== undefined || patch.amount !== undefined) {
				audits.push({
					id: nextAuditId++,
					actor_user_id: patch.actor_user_id ?? null,
					team_id: patch.team_id ?? null,
					entity_type: "crm_deal",
					entity_id: String(id),
					action: "crm.deal_updated",
					before_json: { stage: beforeStage, amount: beforeAmount },
					after_json: { stage: row.stage, amount: row.amount },
					request_metadata: patch.request_metadata ?? {},
					created_at: at,
				});
			}
			return row;
		},
		async deleteDeal(id, input) {
			const idx = deals.findIndex((d) => d.id === id);
			if (idx === -1) return false;
			const before = deals[idx];
			deals.splice(idx, 1);
			const at = input?.deleted_at ?? nowDate();
			audits.push({
				id: nextAuditId++,
				actor_user_id: input?.actor_user_id ?? null,
				team_id: input?.team_id ?? null,
				entity_type: "crm_deal",
				entity_id: String(id),
				action: "crm.deal_deleted",
				before_json: { ...before },
				after_json: {},
				request_metadata: input?.request_metadata ?? {},
				created_at: at,
			});
			return true;
		},
		async createAiSuggestion(input) {
			const at = input.created_at ?? nowDate();
			const row: AiCrmSuggestionRow = {
				id: nextSuggestionId++,
				instance_id: null,
				conversation_id: input.conversation_id,
				contact_id: input.contact_id ?? null,
				deal_id: input.deal_id ?? null,
				action_type: input.action_type,
				payload: input.payload,
				confidence: input.confidence ?? null,
				reason: input.reason,
				status: "pending",
				requires_confirmation: input.requires_confirmation ?? true,
				source: input.source ?? "lead_qualification",
				resolved_by_user_id: null,
				resolution_note: null,
				resolved_at: null,
				created_at: at,
				updated_at: at,
			};
			suggestions.push(row);
			audits.push({
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? null,
				entity_type: "crm_ai_suggestion",
				entity_id: String(row.id),
				action: "crm.ai_suggestion_created",
				before_json: {},
				after_json: { action_type: row.action_type, status: row.status },
				request_metadata: { source: row.source, confidence: row.confidence },
				created_at: at,
			});
			return row;
		},
		async listAiSuggestions(filter = {}) {
			return suggestions
				.filter((row) =>
					filter.conversation_id === undefined ||
					row.conversation_id === filter.conversation_id
				)
				.filter((row) => filter.status === undefined || row.status === filter.status)
				.sort((a, b) => b.id - a.id);
		},
		async updateAiSuggestionStatus(id, input) {
			const row = suggestions.find((item) => item.id === id);
			if (!row) throw new Error(`CRM AI suggestion ${id} not found`);
			const at = input.resolved_at ?? nowDate();
			row.status = input.status;
			row.resolved_by_user_id = input.actor_user_id ?? null;
			row.resolution_note = input.resolution_note ?? null;
			row.resolved_at = at;
			row.updated_at = at;
			audits.push({
				id: nextAuditId++,
				actor_user_id: input.actor_user_id ?? null,
				team_id: input.team_id ?? null,
				entity_type: "crm_ai_suggestion",
				entity_id: String(id),
				action: `crm.ai_suggestion_${input.status}`,
				before_json: { status: "pending" },
				after_json: { status: input.status },
				request_metadata: { resolution_note: input.resolution_note ?? null },
				created_at: at,
			});
			return row;
		},
		async listAuditEvents() {
			return [...audits];
		},
	};
}
