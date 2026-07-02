import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	decideOwnerKeywordAction,
	getTurnFinalizationCleanup,
	isFollowUpEligible,
	parseFollowUpDecision,
	parseNormalReply,
	planHandoffActions,
	normalizeWhatsappIdentity,
	type FollowUpCandidate,
} from "../src/domain/whatsapp-rules.ts";

const settings = {
	botOnKeyword: "ok.",
	keywordCaseSensitive: false,
	followupMaxAttempts: 2,
	followupMinHoursAfterAssistant: 12,
	whatsappFreeformWindowHours: 24,
	blockOutside24hFollowups: true,
};

describe("owner keyword controls", () => {
	it("enables AI only when the owner sends the exact normalized on keyword", () => {
		assert.equal(
			decideOwnerKeywordAction({ text: " ok. ", fromMe: true, settings }),
			"enable_bot",
		);
		assert.equal(
			decideOwnerKeywordAction({ text: "bot off", fromMe: true, settings }),
			"none",
		);
		assert.equal(
			decideOwnerKeywordAction({ text: "ok.", fromMe: false, settings }),
			"none",
		);
		assert.equal(
			decideOwnerKeywordAction({ text: "ok. please", fromMe: true, settings }),
			"none",
		);
	});
});

describe("turn finalization", () => {
	it("cleans transient Redis keys and excludes auth/durable state", () => {
		const cleanup = getTurnFinalizationCleanup("42");
		assert.deepEqual(cleanup.deleteKeys, [
			"wa:v1:turn:queue:42",
			"wa:v1:turn:debounce:42",
			"wa:v1:turn:processing:42",
		]);
		assert.equal(cleanup.tokenSafeLockKey, "wa:v1:turn:lock:42");
		assert.equal(cleanup.touchesBaileysAuth, false);
		assert.equal(cleanup.touchesDurableDatabase, false);
	});
});

describe("follow-up eligibility", () => {
	const base: FollowUpCandidate = {
		mode: "AI",
		latestVisibleRole: "assistant",
		hasUserAfterLatestAssistant: false,
		followupAttempts: 0,
		lastAssistantAt: new Date("2026-06-03T00:00:00Z"),
		lastUserMessageAt: new Date("2026-06-03T12:00:00Z"),
		hasActiveTurnState: false,
		followupLockAcquired: true,
	};

	it("requires AI mode, assistant last, no user reply, attempts, no active processing, 12h due interval, and 24h window", () => {
		const now = new Date("2026-06-03T12:00:00Z");
		assert.deepEqual(isFollowUpEligible(base, settings, now), {
			eligible: true,
		});
		assert.equal(
			isFollowUpEligible(
				{ ...base, lastAssistantAt: new Date("2026-06-03T00:01:00Z") },
				settings,
				now,
			).eligible,
			false,
		);
		assert.equal(
			isFollowUpEligible({ ...base, mode: "HUMAN" }, settings, now).eligible,
			false,
		);
		assert.equal(
			isFollowUpEligible({ ...base, latestVisibleRole: "user" }, settings, now)
				.eligible,
			false,
		);
		assert.equal(
			isFollowUpEligible(
				{ ...base, hasUserAfterLatestAssistant: true },
				settings,
				now,
			).eligible,
			false,
		);
		assert.equal(
			isFollowUpEligible({ ...base, followupAttempts: 2 }, settings, now)
				.eligible,
			false,
		);
		assert.equal(
			isFollowUpEligible({ ...base, hasActiveTurnState: true }, settings, now)
				.eligible,
			false,
		);
		assert.deepEqual(
			isFollowUpEligible(
				{ ...base, lastUserMessageAt: new Date("2026-06-02T11:59:59Z") },
				settings,
				now,
			),
			{ eligible: false, reason: "outside_24h_window" },
		);
	});
});

describe("DeepSeek JSON validation", () => {
	it("accepts strict normal/follow-up JSON and refuses raw invalid text", () => {
		assert.deepEqual(
			parseNormalReply(
				'{"response":{"part_1":"Hola","part_2":"","part_3":""},"handoff":{"required":false,"reason":""}}',
			),
			{
				ok: true,
				parts: ["Hola"],
				handoff: { required: false, reason: "" },
				lead: { labels: [], score: null, reason: "" },
			},
		);
		assert.deepEqual(parseNormalReply("Hola sin JSON"), {
			ok: false,
			sendRaw: false,
			reason: "invalid_json",
		});
		assert.deepEqual(
			parseFollowUpDecision('{"respuesta":"SI","mensaje":"¿Seguimos?"}'),
			{ ok: true, shouldSend: true, message: "¿Seguimos?" },
		);
		assert.deepEqual(parseFollowUpDecision("mensaje libre"), {
			ok: false,
			shouldSend: false,
			sendRaw: false,
			reason: "invalid_json",
		});
	});
});

describe("Humano handoff contract", () => {
	it("plans HUMAN mode and Telegram notification when handoff is required", () => {
		assert.deepEqual(
			planHandoffActions({ required: true, reason: "cliente pide asesor" }),
			{
				mode: "HUMAN",
				eventType: "handoff_to_human",
				notifyTelegram: true,
				reason: "cliente pide asesor",
			},
		);
		assert.equal(planHandoffActions({ required: false, reason: "" }), null);
	});
});

describe("identity normalization", () => {
	it("strips companion device suffixes and standardizes to base phone", () => {
		assert.equal(normalizeWhatsappIdentity("5491112345678:52@s.whatsapp.net"), "5491112345678");
		assert.equal(normalizeWhatsappIdentity("5491112345678:52"), "5491112345678");
		assert.equal(normalizeWhatsappIdentity("171855029772514@lid"), "171855029772514@lid");
	});
});
