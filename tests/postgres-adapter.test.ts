import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConversationRow, MessageRow } from "../src/lib/db-contract.ts";
import {
	createPostgresRepository,
	initializePostgresSchema,
} from "../src/lib/postgres-adapter.ts";

interface QueryCall {
	text: string;
	values?: unknown[];
}

class FakePg {
	calls: QueryCall[] = [];
	private responders: ((
		text: string,
		values?: unknown[],
	) => { rows: unknown[] })[] = [];

	respondWith(
		responder: (text: string, values?: unknown[]) => { rows: unknown[] },
	) {
		this.responders.push(responder);
	}

	async query<T = unknown>(text: string, values?: readonly unknown[]) {
		this.calls.push({ text, values: values ? [...values] : undefined });
		const responder = this.responders.shift();
		const result = responder
			? responder(text, values ? [...values] : undefined)
			: { rows: [] };
		return result as { rows: T[] };
	}
}

class FakePgPool extends FakePg {
	released = 0;
	async connect() {
		return {
			query: <T = unknown>(text: string, values?: readonly unknown[]) =>
				this.query<T>(text, values),
			release: () => {
				this.released += 1;
			},
		};
	}
}

const conversation = (
	patch: Partial<ConversationRow> = {},
): ConversationRow => ({
	id: 7,
	instance_id: null,
	phone: "5491111111111",
	jid: "5491111111111@s.whatsapp.net",
	name: null,
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
	last_message_at: null,
	last_user_message_at: null,
	last_assistant_message_at: null,
	last_human_message_at: null,
	last_owner_intervention_at: null,
	last_ai_reactivated_at: null,
	unread_count: 0,
	is_archived: false,
	lead_labels: [],
	lead_score: null,
	lead_score_reason: null,
	lead_updated_at: null,
	lead_updated_by: null,
	created_at: new Date("2026-01-01T00:00:00.000Z"),
	updated_at: new Date("2026-01-01T00:00:00.000Z"),
	...patch,
});

const message = (patch: Partial<MessageRow> = {}): MessageRow => ({
	id: 11,
	conversation_id: 7,
	whatsapp_message_id: null,
	direction: "outbound",
	role: "assistant",
	content: "Hola",
	media_type: "text",
	source: "bot",
	from_me: false,
	raw_timestamp: null,
	created_at: new Date("2026-01-01T01:00:00.000Z"),
	metadata: {},
	...patch,
});

describe("postgres adapter", () => {
	it("initializes schema with the shared DATABASE_SCHEMA_SQL", async () => {
		const pg = new FakePg();
		await initializePostgresSchema(pg);
		assert.equal(pg.calls.length, 1);
		assert.match(pg.calls[0].text, /to_regclass\('public\.conversations'\)/);
		assert.match(pg.calls[0].text, /ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instance_id/);
		assert.match(pg.calls[0].text, /CREATE TABLE IF NOT EXISTS conversations/);
		assert.match(
			pg.calls[0].text,
			/CREATE TABLE IF NOT EXISTS conversation_events/,
		);
		assert.match(pg.calls[0].text, /UPDATE crm_contacts SET instance_id = default_instance_id WHERE instance_id IS NULL/);
	});

	it("serializes real schema initialization with a transaction-level advisory lock", async () => {
		const pg = new FakePgPool();

		await initializePostgresSchema(pg);

		assert.equal(pg.calls[0].text, "BEGIN");
		assert.match(pg.calls[1].text, /pg_advisory_xact_lock/);
		assert.match(pg.calls[2].text, /CREATE TABLE IF NOT EXISTS conversations/);
		assert.equal(pg.calls[3].text, "COMMIT");
		assert.equal(pg.released, 1);
	});

	it("merges settings rows over defaults", async () => {
		const pg = new FakePg();
		pg.respondWith(() => ({
			rows: [
				{ key: "bot_on_keyword", value: "dale" },
				{ key: "followup_max_attempts", value: 4 },
			],
		}));
		const repo = createPostgresRepository(pg);

		const settings = await repo.getSettings();

		assert.equal(settings.bot_on_keyword, "dale");
		assert.equal(settings.followup_max_attempts, 4);
		assert.equal(settings.followup_interval_hours, 12);
		assert.match(pg.calls[0].text, /SELECT key, value FROM settings/);
	});

	it("gets existing conversation before inserting a new one", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /instance_id IS NOT DISTINCT FROM \$3/);
			assert.match(text, /phone = \$1 OR jid = \$2/);
			assert.deepEqual(values, [
				"5491111111111",
				"5491111111111@s.whatsapp.net",
				null,
			]);
			return { rows: [conversation()] };
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.getOrCreateConversation({
			phone: "5491111111111",
			jid: "5491111111111@s.whatsapp.net",
		});

		assert.equal(row.id, 7);
		assert.equal(pg.calls.length, 1);
	});

	it("repairs an existing LID conversation phone when senderPn later provides the real phone", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /instance_id IS NOT DISTINCT FROM \$3/);
			assert.match(text, /phone = \$1 OR jid = \$2/);
			assert.deepEqual(values, ["18299727934", "239917074530322@lid", null]);
			return {
				rows: [
					conversation({
						phone: "239917074530322",
						jid: "239917074530322@lid",
						name: "Azokiallc",
					}),
				],
			};
		});
		pg.respondWith((text, values) => {
			assert.match(text, /SET phone = CASE/);
			assert.deepEqual(values, [
				"18299727934",
				null,
				null,
				7,
			]);
			return {
				rows: [
					conversation({
						phone: "18299727934",
						jid: "239917074530322@lid",
						name: "Azokiallc",
					}),
				],
			};
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.getOrCreateConversation({
			phone: "18299727934",
			jid: "239917074530322@lid",
		});

		assert.equal(row.phone, "18299727934");
		assert.equal(row.jid, "239917074530322@lid");
	});

	it("avoids unique constraint violation by not updating phone/jid when a collision exists between phone and LID rows", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /phone = \$1 OR jid = \$2/);
			return {
				rows: [
					// Sort order based on CASE WHEN: matching phone is first.
					conversation({
						id: 2,
						phone: "18299727934",
						jid: null,
					}),
					conversation({
						id: 1,
						phone: "239917074530322",
						jid: "239917074530322@lid",
					}),
				],
			};
		});
		// Since we matched the phone row (id 2), and LID row has the jid, we should NOT update JID of row 2.
		// So it should NOT call update, just return row 2.
		pg.respondWith(() => {
			throw new Error("Should not try to update if it would violate unique constraint");
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.getOrCreateConversation({
			phone: "18299727934",
			jid: "239917074530322@lid",
		});

		assert.equal(row.id, 2);
		assert.equal(row.phone, "18299727934");
		assert.equal(row.jid, null);
	});

	it("avoids unique constraint violation when a collision exists and name is updated", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /phone = \$1 OR jid = \$2/);
			return {
				rows: [
					// Sort order based on CASE WHEN: matching phone is first.
					conversation({
						id: 2,
						phone: "18299727934",
						jid: null,
						name: null,
					}),
					conversation({
						id: 1,
						phone: "239917074530322",
						jid: "239917074530322@lid",
					}),
				],
			};
		});
		pg.respondWith((text, values) => {
			assert.match(text, /SET phone = CASE/);
			assert.deepEqual(values, [
				null,
				null,
				"New Name",
				2,
			]);
			return {
				rows: [
					conversation({
						id: 2,
						phone: "18299727934",
						jid: null,
						name: "New Name",
					}),
				],
			};
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.getOrCreateConversation({
			phone: "18299727934",
			jid: "239917074530322@lid",
			name: "New Name",
		});

		assert.equal(row.id, 2);
		assert.equal(row.name, "New Name");
	});

	it("inserts conversation when no existing phone or jid matches", async () => {
		const pg = new FakePg();
		pg.respondWith(() => ({ rows: [] }));
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO conversations/);
			assert.deepEqual(values, [
				null,
				"5491111111111",
				"5491111111111@s.whatsapp.net",
				"Ada",
			]);
			return { rows: [conversation({ name: "Ada" })] };
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.getOrCreateConversation({
			phone: "5491111111111",
			jid: "5491111111111@s.whatsapp.net",
			name: "Ada",
		});

		assert.equal(row.name, "Ada");
	});

	it("serializes JSONB conversation patches before updating", async () => {
		const pg = new FakePg();
		const updatedAt = new Date("2026-01-02T00:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /lead_labels = \$2::jsonb/);
			assert.match(text, /updated_at = \$6/);
			assert.deepEqual(values, [
				7,
				JSON.stringify(["neutro"]),
				75,
				"mensaje de audio con interés",
				"assistant",
				updatedAt,
			]);
			return {
				rows: [
					conversation({
						lead_labels: ["neutro"],
						lead_score: 75,
						lead_score_reason: "mensaje de audio con interés",
						lead_updated_by: "assistant",
					}),
				],
			};
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.updateConversation(7, {
			lead_labels: ["neutro"],
			lead_score: 75,
			lead_score_reason: "mensaje de audio con interés",
			lead_updated_by: "assistant",
			updated_at: updatedAt,
		});

		assert.deepEqual(row.lead_labels, ["neutro"]);
	});

	it("inserts user message and resets follow-up counters while touching timestamps", async () => {
		const pg = new FakePg();
		const createdAt = new Date("2026-01-02T03:04:05.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO messages/);
			assert.deepEqual(values, [
				7,
				"wamid.1",
				"inbound",
				"user",
				"Hola",
				"text",
				"whatsapp",
				false,
				null,
				createdAt,
				{ source: "test" },
			]);
			return {
				rows: [
					message({
						role: "user",
						direction: "inbound",
						content: "Hola",
						created_at: createdAt,
					}),
				],
			};
		});
		pg.respondWith((text, values) => {
			assert.match(text, /followup_attempts = 0/);
			assert.match(text, /last_user_message_at = \$2/);
			assert.match(text, /is_archived = false/);
			assert.deepEqual(values, [7, createdAt]);
			return { rows: [conversation({ last_user_message_at: createdAt, is_archived: false })] };
		});
		const repo = createPostgresRepository(pg);

		const row = await repo.insertMessageAndTouchConversation({
			conversation_id: 7,
			whatsapp_message_id: "wamid.1",
			direction: "inbound",
			role: "user",
			content: "Hola",
			media_type: "text",
			source: "whatsapp",
			created_at: createdAt,
			metadata: { source: "test" },
		});

		assert.equal(row.id, 11);
	});

	it("rolls back message insert when conversation touch fails", async () => {
		const pg = new FakePgPool();
		const createdAt = new Date("2026-01-02T03:04:05.000Z");
		pg.respondWith((text) => {
			assert.equal(text, "BEGIN");
			return { rows: [] };
		});
		pg.respondWith((text) => {
			assert.match(text, /INSERT INTO messages/);
			return { rows: [message({ role: "user", created_at: createdAt })] };
		});
		pg.respondWith((text) => {
			assert.match(text, /UPDATE conversations/);
			return { rows: [] };
		});
		pg.respondWith((text) => {
			assert.equal(text, "ROLLBACK");
			return { rows: [] };
		});
		const repo = createPostgresRepository(pg);

		await assert.rejects(
			repo.insertMessageAndTouchConversation({
				conversation_id: 7,
				direction: "inbound",
				role: "user",
				content: "Hola",
				source: "whatsapp",
				created_at: createdAt,
			}),
			/conversation_not_found:7/,
		);
		assert.equal(pg.released, 1);
		assert.deepEqual(
			pg.calls.map((call) => call.text),
			["BEGIN", pg.calls[1].text, pg.calls[2].text, "ROLLBACK"],
		);
	});

	it("touches assistant and human timestamp semantics", async () => {
		const pg = new FakePg();
		const assistantAt = new Date("2026-01-02T04:00:00.000Z");
		const humanAt = new Date("2026-01-02T05:00:00.000Z");
		pg.respondWith(() => ({ rows: [message({ created_at: assistantAt })] }));
		pg.respondWith((text, values) => {
			assert.match(text, /last_assistant_message_at = \$2/);
			assert.deepEqual(values, [7, assistantAt]);
			return { rows: [conversation()] };
		});
		pg.respondWith(() => ({
			rows: [message({ role: "human", created_at: humanAt })],
		}));
		pg.respondWith((text, values) => {
			assert.match(text, /last_human_message_at = \$2/);
			assert.match(text, /last_owner_intervention_at = \$2/);
			assert.deepEqual(values, [7, humanAt]);
			return { rows: [conversation()] };
		});
		const repo = createPostgresRepository(pg);

		await repo.insertMessageAndTouchConversation({
			conversation_id: 7,
			direction: "outbound",
			role: "assistant",
			content: "Hola",
			source: "bot",
			created_at: assistantAt,
		});
		await repo.insertMessageAndTouchConversation({
			conversation_id: 7,
			direction: "inbound",
			role: "human",
			content: "ok.",
			source: "whatsapp",
			from_me: true,
			created_at: humanAt,
		});
	});

	it("updates mode and records audit event", async () => {
		const pg = new FakePg();
		const changedAt = new Date("2026-01-03T00:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /UPDATE conversations/);
			assert.match(
				text,
				/last_ai_reactivated_at = COALESCE\(\$6, last_ai_reactivated_at\)/,
			);
			assert.deepEqual(values, [
				7,
				"AI",
				"owner_keyword_on",
				"owner",
				changedAt,
				changedAt,
			]);
			return {
				rows: [conversation({ mode: "AI", last_ai_reactivated_at: changedAt })],
			};
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO conversation_events/);
			assert.deepEqual(values, [
				7,
				"bot_enabled",
				"human",
				"owner_keyword_on",
				{ ok: true },
				changedAt,
			]);
			return {
				rows: [
					{
						id: 3,
						conversation_id: 7,
						event_type: "bot_enabled",
						actor_role: "human",
						reason: "owner_keyword_on",
						metadata: { ok: true },
						created_at: changedAt,
					},
				],
			};
		});
		const repo = createPostgresRepository(pg);

		const event = await repo.setMode(7, "AI", {
			reason: "owner_keyword_on",
			changedBy: "owner",
			changedAt,
			eventType: "bot_enabled",
			metadata: { ok: true },
		});

		assert.equal(event?.event_type, "bot_enabled");
	});

	it("rolls back mode updates when audit event insert fails", async () => {
		const pg = new FakePgPool();
		const changedAt = new Date("2026-01-03T00:00:00.000Z");
		pg.respondWith((text) => {
			assert.equal(text, "BEGIN");
			return { rows: [] };
		});
		pg.respondWith((text) => {
			assert.match(text, /UPDATE conversations/);
			return { rows: [conversation({ mode: "HUMAN" })] };
		});
		pg.respondWith((text) => {
			assert.match(text, /INSERT INTO conversation_events/);
			throw new Error("event_insert_failed");
		});
		pg.respondWith((text) => {
			assert.equal(text, "ROLLBACK");
			return { rows: [] };
		});
		const repo = createPostgresRepository(pg);

		await assert.rejects(
			repo.setMode(7, "HUMAN", {
				reason: "owner_keyword_off",
				changedBy: "owner",
				changedAt,
				eventType: "bot_disabled",
			}),
			/event_insert_failed/,
		);
		assert.equal(pg.released, 1);
		assert.equal(pg.calls.at(-1)?.text, "ROLLBACK");
	});

	it("rejects unrecognized updateConversation patch columns", async () => {
		const pg = new FakePg();
		const repo = createPostgresRepository(pg);

		await assert.rejects(
			repo.updateConversation(7, {
				phone: "malicious",
			} as Partial<ConversationRow>),
			/unsupported_conversation_patch_column:phone/,
		);
		assert.equal(pg.calls.length, 0);
	});

	it("returns recent messages chronologically with a limit", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /ORDER BY id ASC/);
			assert.match(text, /LIMIT \$2/);
			assert.deepEqual(values, [7, 2]);
			return { rows: [message({ id: 1 }), message({ id: 2 })] };
		});
		const repo = createPostgresRepository(pg);

		const rows = await repo.getRecentMessages(7, 2);

		assert.deepEqual(
			rows.map((row) => row.id),
			[1, 2],
		);
	});

	it("queries pending follow-ups with AI/latest-assistant/no-new-user rules and leaves 24h blocking to the scheduler", async () => {
		const pg = new FakePg();
		const now = new Date("2026-01-04T00:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /c\.mode = 'AI'/);
			assert.match(text, /c\.followup_attempts < \$2/);
			assert.match(text, /latest\.role = 'assistant'/);
			assert.match(text, /c\.last_followup_at IS NULL OR c\.last_followup_at <= \$1/);
			assert.match(text, /ORDER BY m\.id DESC/);
			assert.match(text, /NOT EXISTS[\s\S]+newer_user/);
			assert.match(text, /newer_user\.id > latest\.id/);
			assert.doesNotMatch(text, /last_user_message_at >= \$3/);
			assert.deepEqual(values, [
				new Date("2026-01-03T00:00:00.000Z"),
				2,
			]);
			return { rows: [conversation()] };
		});
		const repo = createPostgresRepository(pg);

		const rows = await repo.getPendingFollowUps({
			now,
			maxAttempts: 2,
			minHoursAfterAssistant: 24,
			freeformWindowHours: 24,
			blockOutside24h: true,
		});

		assert.equal(rows.length, 1);
	});

	it("increments attempts and marks blocked follow-ups", async () => {
		const pg = new FakePg();
		const at = new Date("2026-01-05T00:00:00.000Z");
		pg.respondWith((text, values) => {
			assert.match(text, /followup_attempts = followup_attempts \+ 1/);
			assert.deepEqual(values, [7, at]);
			return {
				rows: [conversation({ followup_attempts: 1, last_followup_at: at })],
			};
		});
		pg.respondWith((text, values) => {
			assert.match(text, /followup_blocked_at = \$2/);
			assert.deepEqual(values, [7, at, "outside_24h_window"]);
			return { rows: [conversation({ followup_blocked_at: at })] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO conversation_events/);
			assert.deepEqual(values, [
				7,
				"followup_blocked_24h",
				"system",
				"outside_24h_window",
				{ boundary: "whatsapp_freeform_window" },
				at,
			]);
			return {
				rows: [
					{
						id: 4,
						conversation_id: 7,
						event_type: "followup_blocked_24h",
						actor_role: "system",
						reason: "outside_24h_window",
						metadata: { boundary: "whatsapp_freeform_window" },
						created_at: at,
					},
				],
			};
		});
		const repo = createPostgresRepository(pg);

		await repo.incrementFollowUpAttempt(7, at);
		const event = await repo.markFollowUpBlocked(7, "outside_24h_window", at);

		assert.equal(event.event_type, "followup_blocked_24h");
	});

	it("restores CRM link only if exactly one tenant-scoped method matches", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT 1 FROM conversation_crm_links/);
			return { rows: [] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT c\.id AS contact_id, l\.account_id/);
			assert.deepEqual(values, ["5491112345678", 2]);
			return { rows: [{ contact_id: 15, account_id: 42 }] };
		});
		pg.respondWith((text, values) => {
			assert.match(text, /INSERT INTO conversation_crm_links/);
			assert.deepEqual(values, [7, 15, 42]);
			return { rows: [{ id: 100 }] };
		});
		
		const repo = createPostgresRepository(pg) as any;
		
		const restored = await repo.tryRestoreCrmLink(7, "5491112345678", 2);
		assert.equal(restored, true);
	});

	it("does not restore CRM link if multiple methods match", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT 1 FROM conversation_crm_links/);
			return { rows: [] };
		});
		pg.respondWith((text, values) => {
			return { rows: [{ contact_id: 15 }, { contact_id: 16 }] };
		});
		const repo = createPostgresRepository(pg) as any;
		
		const restored = await repo.tryRestoreCrmLink(7, "5491112345678", null);
		assert.equal(restored, false);
		assert.equal(pg.calls.length, 2);
	});

	it("does not restore CRM link if zero methods match", async () => {
		const pg = new FakePg();
		pg.respondWith((text, values) => {
			assert.match(text, /SELECT 1 FROM conversation_crm_links/);
			return { rows: [] };
		});
		pg.respondWith((text, values) => {
			return { rows: [] };
		});
		const repo = createPostgresRepository(pg) as any;
		
		const restored = await repo.tryRestoreCrmLink(7, "5491112345678", null);
		assert.equal(restored, false);
		assert.equal(pg.calls.length, 2);
	});
});
