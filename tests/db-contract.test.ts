import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	DATABASE_SCHEMA_SQL,
	DEFAULT_SETTINGS,
	createInMemoryRepository,
	type ConversationEventType,
} from "../src/lib/db-contract.ts";

const iso = (value: string) => new Date(value);

describe("database schema contract", () => {
	it("declares required tables, columns, indexes, and default settings", () => {
		const sql = DATABASE_SCHEMA_SQL;
		for (const fragment of [
			"CREATE TABLE IF NOT EXISTS conversations",
			"instance_id INTEGER",
			"jid TEXT",
			"CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_instance_phone",
			"CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_instance_jid",
			"mode_reason TEXT",
			"last_user_message_at TIMESTAMP WITH TIME ZONE",
			"last_assistant_message_at TIMESTAMP WITH TIME ZONE",
			"last_human_message_at TIMESTAMP WITH TIME ZONE",
			"last_owner_intervention_at TIMESTAMP WITH TIME ZONE",
			"lead_labels JSONB NOT NULL DEFAULT '[]'::jsonb",
			"lead_score INTEGER CHECK",
			"lead_updated_by TEXT CHECK",
			"CREATE TABLE IF NOT EXISTS messages",
			"whatsapp_message_id TEXT",
			"direction TEXT CHECK(direction IN ('inbound','outbound'))",
			"source TEXT CHECK(source IN ('whatsapp','dashboard','bot','scheduler','system'))",
			"metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
			"CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id",
			"CREATE TABLE IF NOT EXISTS settings",
			"CREATE TABLE IF NOT EXISTS instance_settings",
			"CREATE TABLE IF NOT EXISTS whatsapp_instances",
			"CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_one_active",
			"status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))",
			"CREATE TABLE IF NOT EXISTS conversation_events",
			"CREATE INDEX IF NOT EXISTS idx_conversation_events_conv_created",
			"CREATE TABLE IF NOT EXISTS automations",
			"trigger_type TEXT CHECK(trigger_type IN ('incoming_message'))",
			"definition JSONB NOT NULL",
			"CREATE INDEX IF NOT EXISTS idx_automations_enabled_trigger",
			"CREATE TABLE IF NOT EXISTS crm_tasks",
			"status TEXT CHECK(status IN ('pending','in_progress','done'))",
			"task_type TEXT CHECK(task_type IN ('call_client','follow_up','evaluate_lead','set_label','custom'))",
			"lead_label TEXT CHECK(lead_label IS NULL OR lead_label IN ('frio','neutro','caliente','cliente_potencial'))",
			"CREATE INDEX IF NOT EXISTS idx_crm_tasks_status_due",
			"('bot_on_keyword', '\"ok.\"'::jsonb)",
			"('followup_interval_hours', '12'::jsonb)",
			"('followup_interval_minutes', '0'::jsonb)",
			"('followup_min_hours_after_assistant', '12'::jsonb)",
			"('followup_min_minutes_after_assistant', '0'::jsonb)",
			"('followup_max_attempts', '2'::jsonb)",
			"('whatsapp_freeform_window_hours', '24'::jsonb)",
			"('block_outside_24h_followups', 'true'::jsonb)",
		]) {
			assert.match(
				sql,
				new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			);
		}
	});

	it("exposes settings defaults required by owner controls and follow-ups", () => {
		assert.equal(DEFAULT_SETTINGS.bot_on_keyword, "ok.");
		assert.equal(DEFAULT_SETTINGS.followup_interval_hours, 12);
		assert.equal(DEFAULT_SETTINGS.followup_interval_minutes, 0);
		assert.equal(DEFAULT_SETTINGS.followup_min_hours_after_assistant, 12);
		assert.equal(DEFAULT_SETTINGS.followup_min_minutes_after_assistant, 0);
		assert.equal(DEFAULT_SETTINGS.followup_max_attempts, 2);
		assert.equal(DEFAULT_SETTINGS.whatsapp_freeform_window_hours, 24);
		assert.equal(DEFAULT_SETTINGS.block_outside_24h_followups, true);
	});
});

describe("in-memory repository contract", () => {
	it("repairs a LID-stored phone when the real sender phone arrives later", () => {
		const repo = createInMemoryRepository();
		const original = repo.getOrCreateConversation({
			phone: "239917074530322",
			jid: "239917074530322@lid",
			name: "Azokiallc",
		});

		const repaired = repo.getOrCreateConversation({
			phone: "18299727934",
			jid: "239917074530322@lid",
			name: "Azokiallc",
		});

		assert.equal(repaired.id, original.id);
		assert.equal(repo.getConversationById(original.id)?.phone, "18299727934");
		assert.equal(repo.getConversationById(original.id)?.jid, "239917074530322@lid");
	});

	it("touches source-specific timestamps and resets follow-ups when messages are inserted", () => {
		const repo = createInMemoryRepository();
		const convo = repo.getOrCreateConversation({
			phone: "549111",
			jid: "549111@s.whatsapp.net",
			name: "Ana",
		});
		repo.updateConversation(convo.id, {
			followup_attempts: 2,
			followup_blocked_reason: "outside_24h_window",
			followup_blocked_at: iso("2026-06-01T00:00:00Z"),
		});

		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			whatsapp_message_id: "m-user",
			direction: "inbound",
			role: "user",
			content: "Hola",
			source: "whatsapp",
			from_me: false,
			created_at: iso("2026-06-01T10:00:00Z"),
		});
		assert.equal(
			repo.getConversationById(convo.id)?.last_message_at?.toISOString(),
			"2026-06-01T10:00:00.000Z",
		);
		assert.equal(
			repo.getConversationById(convo.id)?.last_user_message_at?.toISOString(),
			"2026-06-01T10:00:00.000Z",
		);
		assert.equal(repo.getConversationById(convo.id)?.followup_attempts, 0);
		assert.equal(
			repo.getConversationById(convo.id)?.followup_blocked_reason,
			null,
		);
		repo.updateConversation(convo.id, {
			lead_labels: ["cliente_potencial", "caliente"],
			lead_score: 86,
			lead_score_reason: "pidi? precio y mostr? urgencia",
			lead_updated_at: iso("2026-06-01T10:00:30Z"),
			lead_updated_by: "assistant",
		});
		assert.deepEqual(repo.getConversationById(convo.id)?.lead_labels, [
			"cliente_potencial",
			"caliente",
		]);
		assert.equal(repo.getConversationById(convo.id)?.lead_score, 86);

		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "outbound",
			role: "assistant",
			content: "Buenas",
			source: "bot",
			from_me: false,
			created_at: iso("2026-06-01T10:01:00Z"),
		});
		assert.equal(
			repo
				.getConversationById(convo.id)
				?.last_assistant_message_at?.toISOString(),
			"2026-06-01T10:01:00.000Z",
		);

		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "outbound",
			role: "human",
			content: "Me encargo",
			source: "whatsapp",
			from_me: true,
			created_at: iso("2026-06-01T10:02:00Z"),
		});
		assert.equal(
			repo.getConversationById(convo.id)?.last_human_message_at?.toISOString(),
			"2026-06-01T10:02:00.000Z",
		);
		assert.equal(
			repo
				.getConversationById(convo.id)
				?.last_owner_intervention_at?.toISOString(),
			"2026-06-01T10:02:00.000Z",
		);
	});

	it("records mode transitions and events with reason, actor, and timestamp", () => {
		const repo = createInMemoryRepository();
		const convo = repo.getOrCreateConversation({ phone: "549222" });
		const changedAt = iso("2026-06-01T12:00:00Z");

		const event = repo.setMode(convo.id, "HUMAN", {
			reason: "assistant_handoff",
			changedBy: "assistant",
			changedAt,
			eventType: "handoff_to_human",
			metadata: { source: "deepseek" },
		});

		const updated = repo.getConversationById(convo.id);
		assert.equal(updated?.mode, "HUMAN");
		assert.equal(updated?.mode_reason, "assistant_handoff");
		assert.equal(updated?.mode_changed_by, "assistant");
		assert.equal(
			updated?.mode_changed_at?.toISOString(),
			changedAt.toISOString(),
		);
		assert.deepEqual(event, {
			id: 1,
			conversation_id: convo.id,
			event_type: "handoff_to_human",
			actor_role: "assistant",
			reason: "assistant_handoff",
			metadata: { source: "deepseek" },
			created_at: changedAt,
		});
	});

	it("selects follow-up candidates according to mode, latest role, attempts, and user reply", () => {
		const repo = createInMemoryRepository();
		const now = iso("2026-06-03T12:00:00Z");
		const eligible = repo.getOrCreateConversation({ phone: "1" });
		const human = repo.getOrCreateConversation({ phone: "2" });
		repo.updateConversation(human.id, { mode: "HUMAN" });
		const userAfterAssistant = repo.getOrCreateConversation({ phone: "3" });
		const maxAttempts = repo.getOrCreateConversation({ phone: "4" });
		const outside24h = repo.getOrCreateConversation({ phone: "5" });

		for (const conversation of [
			eligible,
			human,
			userAfterAssistant,
			maxAttempts,
			outside24h,
		]) {
			repo.insertMessageAndTouchConversation({
				conversation_id: conversation.id,
				direction: "inbound",
				role: "user",
				content: "hola",
				source: "whatsapp",
				created_at: iso(
					conversation.id === outside24h.id
						? "2026-06-01T11:00:00Z"
						: "2026-06-02T12:00:00Z",
				),
			});
			repo.insertMessageAndTouchConversation({
				conversation_id: conversation.id,
				direction: "outbound",
				role: "assistant",
				content: "respuesta",
				source: "bot",
				created_at: iso("2026-06-02T12:00:00Z"),
			});
		}
		repo.insertMessageAndTouchConversation({
			conversation_id: userAfterAssistant.id,
			direction: "inbound",
			role: "user",
			content: "volví",
			source: "whatsapp",
			created_at: iso("2026-06-02T13:00:00Z"),
		});
		repo.updateConversation(maxAttempts.id, { followup_attempts: 2 });

		assert.deepEqual(
			repo
				.getPendingFollowUps({
					now,
					minHoursAfterAssistant: 12,
					maxAttempts: 2,
					freeformWindowHours: 24,
					blockOutside24h: true,
				})
				.map((c) => c.id),
			[eligible.id, outside24h.id],
		);
		assert.deepEqual(
			repo
				.getPendingFollowUps({
					now,
					minHoursAfterAssistant: 12,
					maxAttempts: 2,
					freeformWindowHours: 24,
					blockOutside24h: false,
				})
				.map((c) => c.id),
			[eligible.id, outside24h.id],
		);
	});

	it("does not select conversations whose last follow-up is still inside the configured wait", () => {
		const repo = createInMemoryRepository();
		const convo = repo.getOrCreateConversation({ phone: "549777" });
		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "inbound",
			role: "user",
			content: "Hola",
			source: "whatsapp",
			created_at: iso("2026-06-04T14:00:00Z"),
		});
		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "outbound",
			role: "assistant",
			content: "Te ayudo.",
			source: "bot",
			created_at: iso("2026-06-04T15:24:00Z"),
		});
		repo.updateConversation(convo.id, {
			followup_attempts: 1,
			last_followup_at: iso("2026-06-04T15:24:00Z"),
		});

		const rows = repo.getPendingFollowUps({
			now: iso("2026-06-04T15:31:00Z"),
			minHoursAfterAssistant: 1.5,
			maxAttempts: 3,
			freeformWindowHours: 24,
			blockOutside24h: true,
		});

		assert.deepEqual(rows.map((row) => row.id), []);
	});

	it("uses insertion order, not skewed timestamps, to decide whether IA is the latest message for follow-ups", () => {
		const repo = createInMemoryRepository();
		const now = iso("2026-06-04T12:10:00Z");
		const convo = repo.getOrCreateConversation({ phone: "549999" });
		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "inbound",
			role: "user",
			content: "Hola",
			source: "whatsapp",
			created_at: iso("2026-06-04T12:00:05Z"),
		});
		repo.insertMessageAndTouchConversation({
			conversation_id: convo.id,
			direction: "outbound",
			role: "assistant",
			content: "Te ayudo.",
			source: "bot",
			created_at: iso("2026-06-04T12:00:00Z"),
		});

		assert.deepEqual(
			repo
				.getPendingFollowUps({
					now,
					minHoursAfterAssistant: 0.03,
					maxAttempts: 3,
					freeformWindowHours: 24,
					blockOutside24h: true,
				})
				.map((c) => c.id),
			[convo.id],
		);
	});

	it("records handoff and blocked follow-up event shapes", () => {
		const repo = createInMemoryRepository();
		const convo = repo.getOrCreateConversation({ phone: "549333" });
		const types: ConversationEventType[] = [
			"handoff_to_human",
			"followup_blocked_24h",
		];

		const handoff = repo.recordConversationEvent({
			conversation_id: convo.id,
			event_type: types[0],
			actor_role: "assistant",
			reason: "cliente pide asesor",
			metadata: { notifyTelegram: true },
			created_at: iso("2026-06-01T12:00:00Z"),
		});
		const blocked = repo.markFollowUpBlocked(
			convo.id,
			"outside_24h_window",
			iso("2026-06-02T12:00:00Z"),
		);

		assert.equal(handoff.event_type, "handoff_to_human");
		assert.equal(handoff.metadata.notifyTelegram, true);
		assert.equal(blocked.event_type, "followup_blocked_24h");
		assert.equal(
			repo.getConversationById(convo.id)?.followup_blocked_reason,
			"outside_24h_window",
		);
	});
});
