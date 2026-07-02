import {
	DATABASE_SCHEMA_SQL,
	DEFAULT_SETTINGS,
	type ConversationEventRow,
	type ConversationEventType,
	type ConversationRow,
	type EventActorRole,
	type FollowUpQueryInput,
	type InsertMessageInput,
	type MessageRow,
	type ModeChangedBy,
} from "./db-contract.ts";
import type { ConversationMode } from "../domain/whatsapp-rules.ts";

export interface PostgresQueryable {
	query<T = unknown>(
		text: string,
		values?: readonly unknown[],
	): Promise<{ rows: T[] }>;
}

export interface PostgresClient extends PostgresQueryable {
	release(): void;
}

export interface PostgresPool extends PostgresQueryable {
	connect?: () => Promise<PostgresClient>;
}

const nowDate = () => new Date();
const actorFor = (changedBy: ModeChangedBy): EventActorRole =>
	changedBy === "assistant"
		? "assistant"
		: changedBy === "system"
			? "system"
			: "human";

const SCHEMA_INIT_ADVISORY_LOCK_ID = 756_709_401;

const LEGACY_INSTANCE_ID_PREFLIGHT_SQL = `
DO $$
BEGIN
	IF to_regclass('public.conversations') IS NOT NULL THEN
		ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.outbox') IS NOT NULL THEN
		ALTER TABLE outbox ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_accounts') IS NOT NULL THEN
		ALTER TABLE crm_accounts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_contacts') IS NOT NULL THEN
		ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_contact_methods') IS NOT NULL THEN
		ALTER TABLE crm_contact_methods ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_deals') IS NOT NULL THEN
		ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_ai_suggestions') IS NOT NULL THEN
		ALTER TABLE crm_ai_suggestions ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.system_prompts') IS NOT NULL THEN
		ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.automations') IS NOT NULL THEN
		ALTER TABLE automations ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
	IF to_regclass('public.crm_tasks') IS NOT NULL THEN
		ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS instance_id INTEGER;
	END IF;
END $$;
`;

const SCHEMA_MIGRATION_SQL = `${LEGACY_INSTANCE_ID_PREFLIGHT_SQL}
${DATABASE_SCHEMA_SQL}
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_picture_fetched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK(lead_score IS NULL OR (lead_score >= 0 AND lead_score <= 100));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_score_reason TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_updated_by TEXT CHECK(lead_updated_by IS NULL OR lead_updated_by IN ('assistant','dashboard'));
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS media_type TEXT CHECK(media_type IN ('text','image','audio','unknown')) NOT NULL DEFAULT 'text';
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_accounts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_contact_methods ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_ai_suggestions ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS instance_id INTEGER;
ALTER TABLE crm_contact_methods DROP CONSTRAINT IF EXISTS crm_contact_methods_method_type_normalized_value_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contact_methods_instance_method_value ON crm_contact_methods(instance_id, method_type, normalized_value);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_instance ON crm_accounts(instance_id, id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_instance ON crm_contacts(instance_id, id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_methods_contact ON crm_contact_methods(instance_id, contact_id, id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(instance_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals(instance_id, account_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(instance_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ai_suggestions_conversation_status ON crm_ai_suggestions(instance_id, conversation_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ai_suggestions_status_created ON crm_ai_suggestions(instance_id, status, created_at DESC);
INSERT INTO whatsapp_instances (name, phone, status, qr_string, is_active, created_at, updated_at)
SELECT 'Principal', cs.phone, COALESCE(cs.status, 'disconnected'), cs.qr_string, TRUE, NOW(), NOW()
FROM connection_state cs
WHERE cs.id = 1
  AND NOT EXISTS (SELECT 1 FROM whatsapp_instances);
INSERT INTO whatsapp_instances (name, is_active, created_at, updated_at)
SELECT 'Principal', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_instances);
DO $$
DECLARE
	default_instance_id INTEGER;
BEGIN
	SELECT id INTO default_instance_id
	FROM whatsapp_instances
	ORDER BY is_active DESC, id ASC
	LIMIT 1;

	IF default_instance_id IS NOT NULL THEN
		UPDATE conversations SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE outbox SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_accounts SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_contacts SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_contact_methods SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_deals SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_ai_suggestions SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE system_prompts SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE automations SET instance_id = default_instance_id WHERE instance_id IS NULL;
		UPDATE crm_tasks SET instance_id = default_instance_id WHERE instance_id IS NULL;
	END IF;
END $$;`;

export async function initializePostgresSchema(pool: PostgresPool) {
	if (!pool.connect) {
		await pool.query(SCHEMA_MIGRATION_SQL);
		return;
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock($1)", [
			SCHEMA_INIT_ADVISORY_LOCK_ID,
		]);
		await client.query(SCHEMA_MIGRATION_SQL);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK").catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}

function valueOrNull(value: unknown) {
	return value === undefined ? null : value;
}

const JSONB_CONVERSATION_COLUMNS = new Set(["lead_labels"]);

function assignmentForConversationColumn(key: string, parameterIndex: number) {
	return JSONB_CONVERSATION_COLUMNS.has(key)
		? `${key} = $${parameterIndex}::jsonb`
		: `${key} = $${parameterIndex}`;
}

function valueForConversationColumn(key: string, value: unknown) {
	return JSONB_CONVERSATION_COLUMNS.has(key) ? JSON.stringify(value) : value;
}

const UPDATE_CONVERSATION_COLUMNS = new Set([
	"name",
	"mode",
	"mode_reason",
	"mode_changed_at",
	"mode_changed_by",
	"followup_attempts",
	"last_followup_at",
	"followup_blocked_at",
	"followup_blocked_reason",
	"last_message_at",
	"last_user_message_at",
	"last_assistant_message_at",
	"last_human_message_at",
	"last_owner_intervention_at",
	"last_ai_reactivated_at",
	"unread_count",
	"is_archived",
	"profile_picture_url",
	"profile_picture_fetched_at",
	"lead_labels",
	"lead_score",
	"lead_score_reason",
	"lead_updated_at",
	"lead_updated_by",
	"updated_at",
]);

async function withTransaction<T>(
	pool: PostgresPool,
	work: (client: PostgresQueryable) => Promise<T>,
): Promise<T> {
	if (!pool.connect) return work(pool);
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await work(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

async function insertConversationEvent(
	queryable: PostgresQueryable,
	input: {
		conversation_id: number;
		event_type: ConversationEventType;
		actor_role: EventActorRole;
		reason?: string | null;
		metadata?: Record<string, unknown>;
		created_at?: Date;
	},
): Promise<ConversationEventRow> {
	const result = await queryable.query<ConversationEventRow>(
		`INSERT INTO conversation_events (
		   conversation_id, event_type, actor_role, reason, metadata, created_at
		 ) VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING *`,
		[
			input.conversation_id,
			input.event_type,
			input.actor_role,
			input.reason ?? null,
			input.metadata ?? {},
			input.created_at ?? nowDate(),
		],
	);
	return result.rows[0];
}

export function createPostgresRepository(pool: PostgresPool) {
	const repo = {
		async getSettings(): Promise<Record<string, unknown>> {
			const result = await pool.query<{ key: string; value: unknown }>(
				"SELECT key, value FROM settings ORDER BY key ASC",
			);
			return {
				...DEFAULT_SETTINGS,
				...Object.fromEntries(result.rows.map((row) => [row.key, row.value])),
			};
		},

		async getOrCreateConversation(input: {
			instance_id?: number | null;
			phone: string;
			jid?: string | null;
			name?: string | null;
		}): Promise<ConversationRow> {
			const instanceId = input.instance_id ?? null;
			return withTransaction(pool, async (client) => {
				if (pool.connect) {
					const hash = input.phone.split("").reduce((a, b) => {
						a = (a << 5) - a + b.charCodeAt(0);
						return a & a;
					}, 0);
					const lockId = Math.abs(hash) % 2147483647;
					await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
				}

				const existing = await client.query<ConversationRow>(
					`SELECT * FROM conversations
					 WHERE (instance_id IS NOT DISTINCT FROM $3)
					   AND (phone = $1 OR jid = $2)
					 ORDER BY
					   CASE WHEN phone = $1 AND jid = $2 THEN 0
					        WHEN phone = $1 THEN 1
					        WHEN jid = $2 THEN 2
					        ELSE 3 END,
					   id ASC`,
					[input.phone, input.jid ?? null, instanceId],
				);
				if (existing.rows[0]) {
					const row = existing.rows[0];
					const nextName = input.name?.trim();
					let shouldUpdatePhone =
						!!input.phone && !!input.jid && row.jid === input.jid && row.phone !== input.phone;
					let shouldUpdateJid = !!input.jid && row.jid !== input.jid;
					const shouldUpdateName = !!nextName && !row.name?.trim();

					if (existing.rows.length > 1) {
						if (shouldUpdatePhone && existing.rows.some((r) => r.id !== row.id && r.phone === input.phone)) {
							shouldUpdatePhone = false;
						}
						if (shouldUpdateJid && existing.rows.some((r) => r.id !== row.id && r.jid === input.jid)) {
							shouldUpdateJid = false;
						}
					}

					if (shouldUpdatePhone || shouldUpdateJid || shouldUpdateName) {
						const updated = await client.query<ConversationRow>(
							`UPDATE conversations
							 SET phone = CASE WHEN $1::text IS NULL THEN phone ELSE $1::text END,
							     jid = CASE WHEN $2::text IS NULL THEN jid ELSE $2::text END,
							     name = CASE WHEN $3::text IS NULL OR NULLIF(TRIM(name), '') IS NOT NULL THEN name ELSE $3::text END,
							     updated_at = NOW()
							 WHERE id = $4
							 RETURNING *`,
							[
								shouldUpdatePhone ? input.phone : null,
								shouldUpdateJid ? input.jid : null,
								nextName ?? null,
								row.id,
							],
						);
						return updated.rows[0];
					}
					return row;
				}

				const created = await client.query<ConversationRow>(
					`INSERT INTO conversations (instance_id, phone, jid, name)
					 VALUES ($1, $2, $3, $4)
					 RETURNING *`,
					[instanceId, input.phone, input.jid ?? null, input.name ?? null],
				);
				return created.rows[0];
			});
		},

		async getConversationById(id: number): Promise<ConversationRow | null> {
			const result = await pool.query<ConversationRow>(
				"SELECT * FROM conversations WHERE id = $1 LIMIT 1",
				[id],
			);
			return result.rows[0] ?? null;
		},

		async updateConversation(
			id: number,
			patch: Partial<ConversationRow>,
		): Promise<ConversationRow> {
			const entries = Object.entries(patch).filter(
				([key, value]) => key !== "id" && value !== undefined,
			);
			for (const [key] of entries) {
				if (!UPDATE_CONVERSATION_COLUMNS.has(key))
					throw new Error(`unsupported_conversation_patch_column:${key}`);
			}
			const updatedAt = patch.updated_at ?? nowDate();
			const assignments = entries.map(([key], index) =>
				assignmentForConversationColumn(key, index + 2),
			);
			const values = entries.map(([key, value]) =>
				valueForConversationColumn(key, value),
			);
			if (!entries.some(([key]) => key === "updated_at")) {
				assignments.push(`updated_at = $${values.length + 2}`);
				values.push(updatedAt);
			}
			const result = await pool.query<ConversationRow>(
				`UPDATE conversations
				 SET ${assignments.join(", ")}
				 WHERE id = $1
				 RETURNING *`,
				[id, ...values],
			);
			if (!result.rows[0]) throw new Error(`conversation_not_found:${id}`);
			return result.rows[0];
		},

		async insertMessageAndTouchConversation(
			input: InsertMessageInput,
		): Promise<MessageRow> {
			return withTransaction(pool, async (client) => {
				const createdAt = input.created_at ?? nowDate();

				// Si el mensaje es saliente (outbound / from_me) y tiene un ID de WhatsApp real
				// intentamos buscar y asociar un registro local que se haya creado previamente sin ID.
				if (input.direction === "outbound" && input.whatsapp_message_id) {
					// Buscamos un mensaje reciente (últimos 5 minutos) con el mismo contenido y sin ID de WhatsApp
					const existingRes = await client.query<MessageRow>(
						`SELECT * FROM messages
						 WHERE conversation_id = $1
						   AND direction = 'outbound'
						   AND whatsapp_message_id IS NULL
						   AND content = $2
						   AND created_at >= $3
						 ORDER BY created_at DESC
						 LIMIT 1`,
						[
							input.conversation_id,
							input.content,
							new Date(createdAt.getTime() - 5 * 60 * 1000),
						],
					);

					if (existingRes.rows.length > 0) {
						const existingMsg = existingRes.rows[0];
						// Actualizamos el registro existente con el ID real de WhatsApp
						const updatedMsgRes = await client.query<MessageRow>(
							`UPDATE messages
							 SET whatsapp_message_id = $1,
							     raw_timestamp = $2,
							     metadata = metadata || $3::jsonb
							 WHERE id = $4
							 RETURNING *`,
							[
								input.whatsapp_message_id,
								input.raw_timestamp ?? createdAt,
								JSON.stringify(input.metadata ?? {}),
								existingMsg.id,
							],
						);

						// También actualizamos la conversación para reflejar la última intervención
						let touchSql = `UPDATE conversations
						 SET last_message_at = $2, updated_at = $2`;
						if (existingMsg.role === "user") {
							touchSql += `,
						 last_user_message_at = $2,
						 followup_attempts = 0,
						 followup_blocked_at = NULL,
						 followup_blocked_reason = NULL,
						 unread_count = unread_count + 1,
						 is_archived = false`;
						} else if (existingMsg.role === "assistant") {
							touchSql += ", last_assistant_message_at = $2";
						} else {
							touchSql += `, last_human_message_at = $2, unread_count = 0`;
							if (existingMsg.from_me || existingMsg.source === "whatsapp")
								touchSql += ", last_owner_intervention_at = $2";
						}
						touchSql += " WHERE id = $1 RETURNING *";
						await client.query(touchSql, [input.conversation_id, createdAt]);

						return updatedMsgRes.rows[0];
					}
				}

				// Si no se asoció a un registro existente, hacemos la inserción normal:
				const message = await client.query<MessageRow>(
					`INSERT INTO messages (
				   conversation_id, whatsapp_message_id, direction, role, content,
				   media_type, source, from_me, raw_timestamp, created_at, metadata
				 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				 RETURNING *`,
					[
						input.conversation_id,
						valueOrNull(input.whatsapp_message_id),
						input.direction,
						input.role,
						input.content,
						input.media_type ?? "text",
						input.source,
						input.from_me ?? false,
						input.raw_timestamp ?? null,
						createdAt,
						input.metadata ?? {},
					],
				);

				let touchSql = `UPDATE conversations
				 SET last_message_at = $2, updated_at = $2`;
				if (input.role === "user") {
					touchSql += `,
				 last_user_message_at = $2,
				 followup_attempts = 0,
				 followup_blocked_at = NULL,
				 followup_blocked_reason = NULL,
				 unread_count = unread_count + 1,
				 is_archived = false`;
				} else if (input.role === "assistant") {
					touchSql += ", last_assistant_message_at = $2";
				} else {
					touchSql += `, last_human_message_at = $2, unread_count = 0`;
					if (input.from_me || input.source === "whatsapp")
						touchSql += ", last_owner_intervention_at = $2";
				}
				touchSql += " WHERE id = $1 RETURNING *";
				const touched = await client.query<ConversationRow>(touchSql, [
					input.conversation_id,
					createdAt,
				]);
				if (!touched.rows[0])
					throw new Error(`conversation_not_found:${input.conversation_id}`);
				return message.rows[0];
			});
		},

		async setMode(
			id: number,
			mode: ConversationMode,
			input: {
				reason: string;
				changedBy: ModeChangedBy;
				changedAt?: Date;
				eventType?: ConversationEventType;
				metadata?: Record<string, unknown>;
			},
		): Promise<ConversationEventRow | null> {
			return withTransaction(pool, async (client) => {
				const changedAt = input.changedAt ?? nowDate();
				const lastAiReactivatedAt =
					mode === "AI" && input.reason === "owner_keyword_on"
						? changedAt
						: null;
				const updated = await client.query<ConversationRow>(
					`UPDATE conversations
				 SET mode = $2,
				     mode_reason = $3,
				     mode_changed_by = $4,
				     mode_changed_at = $5,
				     updated_at = $5,
				     last_ai_reactivated_at = COALESCE($6, last_ai_reactivated_at)
				 WHERE id = $1
				 RETURNING *`,
					[
						id,
						mode,
						input.reason,
						input.changedBy,
						changedAt,
						lastAiReactivatedAt,
					],
				);
				if (!updated.rows[0]) throw new Error(`conversation_not_found:${id}`);
				return input.eventType
					? insertConversationEvent(client, {
							conversation_id: id,
							event_type: input.eventType,
							actor_role: actorFor(input.changedBy),
							reason: input.reason,
							metadata: input.metadata ?? {},
							created_at: changedAt,
						})
					: null;
			});
		},

		async recordConversationEvent(input: {
			conversation_id: number;
			event_type: ConversationEventType;
			actor_role: EventActorRole;
			reason?: string | null;
			metadata?: Record<string, unknown>;
			created_at?: Date;
		}): Promise<ConversationEventRow> {
			return insertConversationEvent(pool, input);
		},

		async getRecentMessages(
			conversationId: number,
			limit: number,
		): Promise<MessageRow[]> {
			const result = await pool.query<MessageRow>(
				`SELECT * FROM (
					SELECT * FROM messages
					WHERE conversation_id = $1
					ORDER BY id DESC
					LIMIT $2
				) subquery
				ORDER BY id ASC`,
				[conversationId, limit],
			);
			return result.rows;
		},

		async getPendingFollowUps(
			input: FollowUpQueryInput,
		): Promise<ConversationRow[]> {
			let minAgeMs = input.minHoursAfterAssistant * 3_600_000;

			// Si se define un override en segundos para pruebas de desarrollo, lo usamos
			if (process.env.DEV_FOLLOWUP_MIN_AGE_SECONDS) {
				const overrideSec = parseInt(process.env.DEV_FOLLOWUP_MIN_AGE_SECONDS, 10);
				if (!isNaN(overrideSec)) {
					minAgeMs = overrideSec * 1000;
				}
			}

			const followUpCutoff = new Date(input.now.getTime() - minAgeMs);
			const values: unknown[] = [followUpCutoff, input.maxAttempts];
			const result = await pool.query<ConversationRow>(
				`SELECT c.*
				 FROM conversations c
				 JOIN LATERAL (
				   SELECT m.id, m.role, m.created_at
				   FROM messages m
				   WHERE m.conversation_id = c.id
				   ORDER BY m.id DESC
				   LIMIT 1
				 ) latest ON TRUE
				 WHERE c.mode = 'AI'
				   AND c.followup_attempts < $2
				   AND latest.role = 'assistant'
				   AND latest.created_at <= $1
				   AND (c.last_followup_at IS NULL OR c.last_followup_at <= $1)
				   AND NOT EXISTS (
				     SELECT 1 FROM messages newer_user
				     WHERE newer_user.conversation_id = c.id
				       AND newer_user.role = 'user'
				       AND newer_user.id > latest.id
				   )
				 ORDER BY latest.created_at ASC`,
				values,
			);
			return result.rows;
		},

		async incrementFollowUpAttempt(
			conversationId: number,
			at = nowDate(),
		): Promise<ConversationRow> {
			const result = await pool.query<ConversationRow>(
				`UPDATE conversations
				 SET followup_attempts = followup_attempts + 1,
				     last_followup_at = $2,
				     updated_at = $2
				 WHERE id = $1
				 RETURNING *`,
				[conversationId, at],
			);
			if (!result.rows[0])
				throw new Error(`conversation_not_found:${conversationId}`);
			return result.rows[0];
		},

		async markFollowUpBlocked(
			conversationId: number,
			reason: string,
			blockedAt = nowDate(),
		): Promise<ConversationEventRow> {
			const updated = await pool.query<ConversationRow>(
				`UPDATE conversations
				 SET followup_blocked_at = $2,
				     followup_blocked_reason = $3,
				     updated_at = $2
				 WHERE id = $1
				 RETURNING *`,
				[conversationId, blockedAt, reason],
			);
			if (!updated.rows[0])
				throw new Error(`conversation_not_found:${conversationId}`);
			return repo.recordConversationEvent({
				conversation_id: conversationId,
				event_type: "followup_blocked_24h",
				actor_role: "system",
				reason,
				metadata: { boundary: "whatsapp_freeform_window" },
				created_at: blockedAt,
			});
		},

		async tryRestoreCrmLink(
			conversationId: number,
			normalizedPhone: string,
			instanceId: number | null,
		): Promise<boolean> {
			return withTransaction(pool, async (client) => {
				const existingLink = await client.query(
					`SELECT 1 FROM conversation_crm_links WHERE conversation_id = $1 LIMIT 1`,
					[conversationId]
				);
				if (existingLink.rows.length > 0) return false;

				const matches = await client.query<{ contact_id: number; account_id: number | null }>(
					`SELECT c.id AS contact_id, l.account_id
					 FROM crm_contact_methods m
					 JOIN crm_contacts c ON m.contact_id = c.id
					 LEFT JOIN crm_contact_account_links l ON c.id = l.contact_id
					 WHERE m.normalized_value = $1
					   AND m.method_type = 'whatsapp'
					   AND (m.instance_id IS NOT DISTINCT FROM $2)
					 GROUP BY c.id, l.account_id`,
					[normalizedPhone, instanceId]
				);

				if (matches.rows.length !== 1) return false;

				const { contact_id, account_id } = matches.rows[0];
				await client.query(
					`INSERT INTO conversation_crm_links (conversation_id, contact_id, account_id, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (conversation_id) DO NOTHING`,
					[conversationId, contact_id, account_id]
				);
				return true;
			});
		},
	};
	return repo;
}
