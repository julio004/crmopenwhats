import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createTelegramNotifier,
	formatFollowupBlockedNotification,
	formatHumanoHandoffNotification,
	type TelegramFetch,
} from "../src/lib/telegram-notifier.ts";

function createFetchStub(input?: {
	ok?: boolean;
	status?: number;
	body?: unknown;
	throwError?: Error;
}) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fetch: TelegramFetch = async (url, init) => {
		calls.push({ url: String(url), init: init ?? {} });
		if (input?.throwError) throw input.throwError;
		return {
			ok: input?.ok ?? true,
			status: input?.status ?? 200,
			json: async () =>
				input?.body ?? { ok: true, result: { message_id: 123 } },
		};
	};
	return { fetch, calls };
}

describe("Telegram notification adapter", () => {
	it("builds Telegram Bot API sendMessage request URL from config", async () => {
		const { fetch, calls } = createFetchStub();
		const notifier = createTelegramNotifier({
			botToken: "123456:secret-token",
			chatId: "987654",
			fetch,
		});

		const result = await notifier.notifyHumanoHandoff({
			conversationId: 42,
			phone: "549111",
			jid: "549111@s.whatsapp.net",
			reason: "cliente pide asesor",
			lastMessage: "Quiero hablar con alguien",
		});

		assert.equal(result.ok, true);
		assert.equal(calls.length, 1);
		assert.equal(
			calls[0]?.url,
			"https://api.telegram.org/bot123456%3Asecret-token/sendMessage",
		);
		assert.equal(calls[0]?.init.method, "POST");
		assert.equal(
			(calls[0]?.init.headers as Record<string, string>)["content-type"],
			"application/json",
		);
	});

	it("formats Humano handoff notification with phone, JID, conversation id, reason, and last message", async () => {
		const { fetch, calls } = createFetchStub();
		const notifier = createTelegramNotifier({
			botToken: "token",
			chatId: "chat-1",
			fetch,
		});

		await notifier.notifyHumanoHandoff({
			conversationId: 7,
			phone: "549222",
			jid: "549222@s.whatsapp.net",
			reason: "listo para cerrar",
			lastMessage: "Dame el precio final",
		});

		const body = JSON.parse(String(calls[0]?.init.body));
		assert.equal(body.chat_id, "chat-1");
		assert.equal(body.parse_mode, "HTML");
		assert.match(body.text, /Humano requerido/);
		assert.match(body.text, /Conversación: #7/);
		assert.match(body.text, /Teléfono: 549222/);
		assert.match(body.text, /JID: 549222@s\.whatsapp\.net/);
		assert.match(body.text, /Motivo: listo para cerrar/);
		assert.match(body.text, /Último mensaje: Dame el precio final/);
	});

	it("formats follow-up blocked outside 24h notification with phone, conversation id, and reason", async () => {
		const text = formatFollowupBlockedNotification({
			conversationId: 9,
			phone: "549333",
			reason: "outside_24h_window",
		});

		assert.match(text, /Seguimiento bloqueado/);
		assert.match(text, /Conversación: #9/);
		assert.match(text, /Teléfono: 549333/);
		assert.match(text, /Motivo: outside_24h_window/);
	});

	it("missing token or chat id returns skipped result and does not call fetch", async () => {
		const { fetch, calls } = createFetchStub();
		const notifier = createTelegramNotifier({
			botToken: "",
			chatId: "chat-1",
			fetch,
		});

		const result = await notifier.notifyFollowupBlocked({
			conversationId: 1,
			phone: "549444",
			reason: "outside_24h_window",
		});

		assert.deepEqual(result, {
			ok: false,
			status: "skipped",
			reason: "missing_config",
			userMessage: "Telegram notification skipped: missing configuration.",
		});
		assert.equal(calls.length, 0);
	});

	it("non-OK Telegram response returns failure result without throwing by default", async () => {
		const { fetch } = createFetchStub({ ok: false, status: 429 });
		const notifier = createTelegramNotifier({
			botToken: "token",
			chatId: "chat",
			fetch,
		});

		const result = await notifier.notifyHumanoHandoff({
			conversationId: 2,
			phone: "549555",
			jid: "549555@s.whatsapp.net",
			reason: "molesto",
			lastMessage: "Esto no funciona",
		});

		assert.equal(result.ok, false);
		assert.equal(result.status, "failed");
		assert.equal(result.reason, "telegram_http_429");
		assert.match(result.userMessage, /Telegram notification failed/);
	});

	it("fetch/network error returns failure result without breaking caller turn", async () => {
		const { fetch } = createFetchStub({ throwError: new Error("ECONNRESET") });
		const notifier = createTelegramNotifier({
			botToken: "token",
			chatId: "chat",
			fetch,
		});

		const result = await notifier.notifyFollowupBlocked({
			conversationId: 3,
			phone: "549666",
			reason: "outside_24h_window",
		});

		assert.equal(result.ok, false);
		assert.equal(result.status, "failed");
		assert.equal(result.reason, "network_error");
		assert.match(result.userMessage, /Telegram notification failed/);
	});

	it("does not expose token or chat id in user-visible result messages", async () => {
		const { fetch } = createFetchStub({ ok: false, status: 401 });
		const notifier = createTelegramNotifier({
			botToken: "123456:top-secret",
			chatId: "private-chat-id",
			fetch,
		});

		const result = await notifier.notifyFollowupBlocked({
			conversationId: 4,
			phone: "549777",
			reason: "outside_24h_window",
		});

		assert.doesNotMatch(
			result.userMessage,
			/top-secret|123456|private-chat-id/,
		);
		assert.doesNotMatch(
			JSON.stringify(result),
			/top-secret|123456|private-chat-id/,
		);
	});

	it("escapes notification values for Telegram HTML messages", () => {
		const text = formatHumanoHandoffNotification({
			conversationId: 5,
			phone: "<phone>",
			jid: "jid&value",
			reason: "cliente <molesto>",
			lastMessage: "precio > presupuesto",
		});

		assert.match(text, /&lt;phone&gt;/);
		assert.match(text, /jid&amp;value/);
		assert.match(text, /cliente &lt;molesto&gt;/);
		assert.match(text, /precio &gt; presupuesto/);
	});
});
