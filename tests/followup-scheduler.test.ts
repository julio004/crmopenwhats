import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createInMemoryRepository,
	type ConversationRow,
} from "../src/lib/db-contract.ts";
import {
	createInMemoryTurnState,
	redisTurnKeys,
} from "../src/lib/redis-turn-state.ts";
import {
	createFollowUpScheduler,
	followUpDurationHours,
} from "../src/lib/followup-scheduler.ts";
const at = (value: string) => new Date(value);
type Decision =
	| {
			ok: true;
			parsed: { ok: true; shouldSend: boolean; message: string | null };
	  }
	| { ok: false; reason: string };
function seedCandidate(
	repo = createInMemoryRepository(),
	input: {
		phone?: string;
		userAt?: string;
		assistantAt?: string;
		attempts?: number;
		mode?: "AI" | "HUMAN";
	} = {},
) {
	const convo = repo.getOrCreateConversation({
		phone: input.phone ?? "549111",
		jid: `${input.phone ?? "549111"}@s.whatsapp.net`,
		name: "Ana",
	});
	repo.updateConversation(convo.id, { mode: input.mode ?? "AI" });
	repo.insertMessageAndTouchConversation({
		conversation_id: convo.id,
		direction: "inbound",
		role: "user",
		content: "Hola",
		source: "whatsapp",
		created_at: at(input.userAt ?? "2026-06-03T12:00:00Z"),
	});
	repo.insertMessageAndTouchConversation({
		conversation_id: convo.id,
		direction: "outbound",
		role: "assistant",
		content: "Respuesta previa",
		source: "bot",
		created_at: at(input.assistantAt ?? "2026-06-03T12:00:00Z"),
	});
	if (input.attempts !== undefined)
		repo.updateConversation(convo.id, { followup_attempts: input.attempts });
	return { repo, convo };
}
function makeDeps(
	input: {
		repo?: ReturnType<typeof createInMemoryRepository>;
		decision?: Decision;
		candidateOverride?: ConversationRow[];
		telegramResult?: unknown;
	} = {},
) {
	const repo = input.repo ?? createInMemoryRepository();
	const turnState = createInMemoryTurnState();
	const calls: string[] = [];
	const sent: string[] = [];
	const telegram: unknown[] = [];
	const candidateQueries: unknown[] = [];
	const logs: string[] = [];
	let tokenIndex = 0;
	const decision =
		input.decision ??
		({
			ok: true,
			parsed: { ok: true, shouldSend: true, message: "¿Sigues interesado?" },
		} satisfies Decision);
	const scheduler = createFollowUpScheduler({
		now: () => at("2026-06-04T12:00:00Z"),
		repo: {
			getSettings: () => repo.getSettings(),
			getPendingFollowUps: (query) => {
				candidateQueries.push(query);
				return input.candidateOverride ?? repo.getPendingFollowUps(query);
			},
			getConversationById: (id) => repo.getConversationById(id),
			insertMessageAndTouchConversation: (message) =>
				repo.insertMessageAndTouchConversation(message),
			updateConversation: (id, patch) => repo.updateConversation(id, patch),
			recordConversationEvent: (event) => repo.recordConversationEvent(event),
			markFollowUpBlocked: (id, reason, blockedAt) =>
				repo.markFollowUpBlocked(id, reason, blockedAt),
		},
		turnState,
		getRecentHistory: async (conversationId) => {
			calls.push(`history:${conversationId}`);
			return [{ role: "assistant", content: "Respuesta previa" }];
		},
		decideFollowUp: async (history) => {
			calls.push(`deepseek:${history.length}`);
			return decision;
		},
		sendWhatsAppMessage: async (_jid, text) => {
			calls.push(`send:${text}`);
			sent.push(text);
		},
		notifyFollowupBlocked: async (payload) => {
			calls.push("telegram");
			telegram.push(payload);
			return input.telegramResult ?? { ok: true, status: "sent" };
		},
		generateToken: () => `token-${++tokenIndex}`,
		logger: {
			log: (...parts) => logs.push(parts.join(" ")),
			warn: (...parts) => logs.push(parts.join(" ")),
			error: (...parts) => logs.push(parts.join(" ")),
		},
	});
	return {
		scheduler,
		repo,
		turnState,
		calls,
		sent,
		telegram,
		candidateQueries,
		logs,
	};
}
describe("follow-up scheduler orchestration", () => {
	it("combines hour and minute follow-up settings into decimal hours", () => {
		assert.equal(
			followUpDurationHours(
				{
					followup_min_hours_after_assistant: 1,
					followup_min_minutes_after_assistant: 30,
				},
				"followup_min_hours_after_assistant",
				"followup_min_minutes_after_assistant",
			),
			1.5,
		);
	});

	it("acquires a global runner lock and skips all work when unavailable", async () => {
		const { scheduler, turnState, calls, candidateQueries } = makeDeps();
		turnState.acquireFollowupRunnerLock("busy", { ttlMs: 300_000 });
		const result = await scheduler.runOnce();
		assert.equal(result.status, "skipped_runner_locked");
		assert.equal(result.processed, 0);
		assert.deepEqual(candidateQueries, []);
		assert.deepEqual(calls, []);
		assert.equal(
			turnState.inspectKey(redisTurnKeys.followupRunnerLock())?.value,
			"busy",
		);
	});
	it("queries candidates with settings and sends eligible SI decisions", async () => {
		const { repo, convo } = seedCandidate();
		const { scheduler, sent, calls, candidateQueries, turnState, logs } = makeDeps({
			repo,
		});
		const result = await scheduler.runOnce();
		const updated = repo.getConversationById(convo.id);
		assert.equal(result.status, "completed");
		assert.equal(result.sent, 1);
		assert.deepEqual(sent, ["¿Sigues interesado?"]);
		assert.deepEqual(calls, [
			`history:${convo.id}`,
			"deepseek:1",
			"send:¿Sigues interesado?",
		]);
		assert.deepEqual(candidateQueries[0], {
			now: at("2026-06-04T12:00:00Z"),
			minHoursAfterAssistant: 12,
			maxAttempts: 2,
			freeformWindowHours: 24,
			blockOutside24h: true,
		});
		assert.equal(
			logs.some((line) =>
				line.includes("Configuración activa: espera mínima tras IA=12h"),
			),
			true,
		);
		assert.equal(updated?.followup_attempts, 1);
		assert.equal(
			updated?.last_followup_at?.toISOString(),
			"2026-06-04T12:00:00.000Z",
		);
		assert.equal(
			updated?.last_assistant_message_at?.toISOString(),
			"2026-06-04T12:00:00.000Z",
		);
		assert.equal(
			turnState.inspectKey(redisTurnKeys.followupRunnerLock()),
			null,
		);
		assert.equal(
			turnState.inspectKey(redisTurnKeys.followupConversationLock(convo.id)),
			null,
		);
	});
	it("skips candidates with active inbound turn state or unavailable conversation lock", async () => {
		const { repo, convo } = seedCandidate();
		const { scheduler, turnState, sent, calls } = makeDeps({ repo });
		turnState.enqueueTurnMessage(
			convo.id,
			{
				messageId: "queued",
				dbMessageId: 1,
				text: "nuevo mensaje",
				mediaType: "text",
				createdAt: "2026-06-04T12:00:00.000Z",
			},
			{ ttlSeconds: 300 },
		);
		const activeResult = await scheduler.runOnce();
		assert.equal(activeResult.skippedActiveTurn, 1);
		assert.deepEqual(sent, []);
		assert.equal(
			calls.some((call) => call.startsWith("deepseek:")),
			false,
		);
		const clean = makeDeps({ repo });
		clean.turnState.acquireFollowupConversationLock(convo.id, "other", {
			ttlMs: 120_000,
		});
		const lockedResult = await clean.scheduler.runOnce();
		assert.equal(lockedResult.skippedConversationLocked, 1);
		assert.deepEqual(clean.sent, []);
		assert.equal(
			clean.turnState.inspectKey(
				redisTurnKeys.followupConversationLock(convo.id),
			)?.value,
			"other",
		);
	});
	it("does not send for NO decisions and records a skipped event", async () => {
		const { repo, convo } = seedCandidate();
		const { scheduler, sent } = makeDeps({
			repo,
			decision: {
				ok: true,
				parsed: { ok: true, shouldSend: false, message: null },
			},
		});
		const result = await scheduler.runOnce();
		assert.equal(result.skippedByDecision, 1);
		assert.deepEqual(sent, []);
		assert.equal(repo.getConversationById(convo.id)?.followup_attempts, 0);
		assert.equal(repo.listEvents().at(-1)?.event_type, "followup_skipped");
	});
	it("invalid DeepSeek failures send nothing and record deepseek_json_invalid", async () => {
		const { repo } = seedCandidate();
		const { scheduler, sent } = makeDeps({
			repo,
			decision: { ok: false, reason: "invalid_json" },
		});
		const result = await scheduler.runOnce();
		assert.equal(result.invalidDecisions, 1);
		assert.deepEqual(sent, []);
		assert.equal(repo.listEvents().at(-1)?.event_type, "deepseek_json_invalid");
	});
	it("blocks outside 24h candidates, records audit, and emits Telegram notification intent", async () => {
		const { repo, convo } = seedCandidate(createInMemoryRepository(), {
			userAt: "2026-06-02T11:00:00Z",
			assistantAt: "2026-06-03T12:00:00Z",
		});
		const { scheduler, sent, telegram, calls } = makeDeps({
			repo,
			candidateOverride: [convo],
		});
		const result = await scheduler.runOnce();
		const updated = repo.getConversationById(convo.id);
		assert.equal(result.blocked24h, 1);
		assert.deepEqual(sent, []);
		assert.equal(calls.includes("telegram"), true);
		assert.deepEqual(telegram, [
			{
				conversationId: convo.id,
				phone: "549111",
				reason: "outside_24h_window",
			},
		]);
		assert.equal(updated?.followup_blocked_reason, "outside_24h_window");
		assert.equal(repo.listEvents().at(-1)?.event_type, "followup_blocked_24h");
	});
	it("repository candidate contract excludes HUMAN, user-replied, max-attempt, and outside-window rows", async () => {
		const repo = createInMemoryRepository();
		const eligible = seedCandidate(repo, { phone: "1" }).convo;
		seedCandidate(repo, { phone: "2", mode: "HUMAN" });
		const userReplied = seedCandidate(repo, { phone: "3" }).convo;
		repo.insertMessageAndTouchConversation({
			conversation_id: userReplied.id,
			direction: "inbound",
			role: "user",
			content: "volví",
			source: "whatsapp",
			created_at: at("2026-06-03T13:00:00Z"),
		});
		seedCandidate(repo, { phone: "4", attempts: 2 });
		seedCandidate(repo, {
			phone: "5",
			userAt: "2026-06-02T11:00:00Z",
			assistantAt: "2026-06-03T12:00:00Z",
		});
		const { scheduler } = makeDeps({ repo });
		const result = await scheduler.runOnce();
		assert.equal(result.candidates, 2);
		assert.equal(result.sent, 1);
		assert.equal(result.blocked24h, 1);
		assert.deepEqual(
			repo
				.listEvents()
				.filter((event) => event.event_type === "followup_sent")
				.map((event) => event.conversation_id),
			[eligible.id],
		);
	});

	it("skips and records event when follow-up message is a duplicate of a past assistant message in history", async () => {
		const { repo, convo } = seedCandidate();
		const { scheduler, sent, calls } = makeDeps({
			repo,
			decision: {
				ok: true,
				parsed: { ok: true, shouldSend: true, message: "Respuesta previa" },
			},
		});
		const result = await scheduler.runOnce();
		assert.equal(result.status, "completed");
		assert.equal(result.sent, 0);
		assert.deepEqual(sent, []);
		assert.equal(repo.listEvents().at(-1)?.event_type, "followup_skipped");
		assert.equal(repo.listEvents().at(-1)?.reason, "duplicate_followup_message");
	});
});
