import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createDeepSeekClient,
	type DeepSeekFetch,
} from "../src/lib/deepseek-client.ts";

function jsonResponse(content: string, ok = true, status = 200) {
	return {
		ok,
		status,
		json: async () => ({ choices: [{ message: { content } }] }),
	};
}

function makeFetch(responses: Array<ReturnType<typeof jsonResponse> | Error>) {
	const calls: Array<{ url: string | URL; init?: RequestInit }> = [];
	const fetch: DeepSeekFetch = async (url, init) => {
		calls.push({ url, init });
		const next = responses.shift();
		if (next instanceof Error) throw next;
		return next ?? jsonResponse("{}", false, 500);
	};
	return { fetch, calls };
}

function bodyAt(calls: Array<{ init?: RequestInit }>, index: number) {
	return JSON.parse(String(calls[index]?.init?.body));
}

const validNormal =
	'{"response":{"part_1":"Hola","part_2":"¿Seguimos?","part_3":""},"handoff":{"required":false,"reason":""},"lead":{"labels":["cliente_potencial","caliente"],"score":82,"reason":"pregunta por precio y disponibilidad"}}';
const validFollowup = '{"respuesta":"SI","mensaje":"¿Te ayudo con algo más?"}';

describe("DeepSeek client adapter", () => {
	it("builds chat completions request using configured API key, model, and base URL", async () => {
		const { fetch, calls } = makeFetch([jsonResponse(validNormal)]);
		const client = createDeepSeekClient({
			apiKey: "sk-secret",
			model: "deepseek-chat",
			baseUrl: "https://deepseek.example/v1",
			fetch,
		});

		await client.generateNormalReply({
			systemPrompt: "Sistema",
			history: [{ role: "user", content: "Hola" }],
			queuedMessages: [{ text: "Necesito info" }],
		});

		assert.equal(
			String(calls[0]?.url),
			"https://deepseek.example/v1/chat/completions",
		);
		assert.equal(calls[0]?.init?.method, "POST");
		assert.equal(
			(calls[0]?.init?.headers as Record<string, string>).authorization,
			"Bearer sk-secret",
		);
		assert.equal(bodyAt(calls, 0).model, "deepseek-chat");
	});

	it("normal reply request asks for strict response parts and handoff JSON", async () => {
		const { fetch, calls } = makeFetch([jsonResponse(validNormal)]);
		const client = createDeepSeekClient({
			apiKey: "sk",
			model: "deepseek-chat",
			fetch,
		});

		const result = await client.generateNormalReply({
			systemPrompt: "Sistema",
			history: [],
			queuedMessages: [{ text: "Hola" }],
		});

		assert.equal(result.ok, true);
		assert.equal(result.ok && result.parsed.ok, true);
		assert.deepEqual(result.ok && result.parsed.ok ? result.parsed.parts : [], [
			"Hola",
			"¿Seguimos?",
		]);
		const messagesText = JSON.stringify(bodyAt(calls, 0).messages);
		assert.match(messagesText, /part_1/);
		assert.match(messagesText, /part_2/);
		assert.match(messagesText, /part_3/);
		assert.match(messagesText, /handoff/);
		assert.match(messagesText, /cliente_potencial/);
		assert.match(messagesText, /score/);
	});

	it("follow-up request asks for strict respuesta SI/NO and mensaje JSON", async () => {
		const { fetch, calls } = makeFetch([jsonResponse(validFollowup)]);
		const client = createDeepSeekClient({
			apiKey: "sk",
			model: "deepseek-chat",
			fetch,
		});

		const result = await client.generateFollowUpDecision({
			history: [{ role: "assistant", content: "Te puedo ayudar" }],
		});

		assert.equal(result.ok, true);
		assert.equal(result.ok ? result.parsed.shouldSend : false, true);
		const messagesText = JSON.stringify(bodyAt(calls, 0).messages);
		assert.match(messagesText, /respuesta/);
		assert.match(messagesText, /SI/);
		assert.match(messagesText, /NO/);
		assert.match(messagesText, /mensaje/);
	});

	it("parses standard OpenAI-compatible choices[0].message.content", async () => {
		const { fetch } = makeFetch([jsonResponse(validNormal)]);
		const client = createDeepSeekClient({
			apiKey: "sk",
			model: "deepseek-chat",
			fetch,
		});
		const result = await client.generateNormalReply({
			systemPrompt: "s",
			history: [],
			queuedMessages: [],
		});
		assert.equal(result.ok, true);
		assert.equal(result.ok && result.parsed.ok, true);
		assert.deepEqual(result.ok && result.parsed.ok ? result.parsed.parts : [], [
			"Hola",
			"¿Seguimos?",
		]);
	});

	it("repairs malformed normal JSON with one retry", async () => {
		const { fetch, calls } = makeFetch([
			jsonResponse("texto libre"),
			jsonResponse(validNormal),
		]);
		const client = createDeepSeekClient({
			apiKey: "sk",
			model: "deepseek-chat",
			fetch,
		});

		const result = await client.generateNormalReply({
			systemPrompt: "s",
			history: [],
			queuedMessages: [],
		});

		assert.equal(result.ok, true);
		assert.equal(result.attempts, 2);
		assert.equal(calls.length, 2);
		assert.match(JSON.stringify(bodyAt(calls, 1).messages), /Repara/);
	});

	it("repairs malformed follow-up JSON with one retry", async () => {
		const { fetch, calls } = makeFetch([
			jsonResponse("tal vez"),
			jsonResponse(validFollowup),
		]);
		const client = createDeepSeekClient({
			apiKey: "sk",
			model: "deepseek-chat",
			fetch,
		});

		const result = await client.generateFollowUpDecision({ history: [] });

		assert.equal(result.ok, true);
		assert.equal(result.attempts, 2);
		assert.equal(calls.length, 2);
		assert.match(JSON.stringify(bodyAt(calls, 1).messages), /Repara/);
	});

	it("still-invalid JSON returns safe failure without sendable raw text", async () => {
		const { fetch } = makeFetch([
			jsonResponse("bad one"),
			jsonResponse("bad two"),
		]);
		const client = createDeepSeekClient({
			apiKey: "sk-secret",
			model: "deepseek-chat",
			fetch,
		});

		const result = await client.generateNormalReply({
			systemPrompt: "s",
			history: [],
			queuedMessages: [],
		});

		assert.equal(result.ok, false);
		assert.equal(result.ok ? true : result.sendRaw, false);
		assert.equal(result.ok ? "" : result.reason, "invalid_json");
		assert.doesNotMatch(
			result.ok ? "" : result.userMessage,
			/bad one|bad two|sk-secret/,
		);
	});

	it("non-OK HTTP and network errors return safe failures without throwing or leaking secrets", async () => {
		const http = makeFetch([jsonResponse("nope", false, 429)]);
		const net = makeFetch([new Error("boom sk-secret")]);
		const httpClient = createDeepSeekClient({
			apiKey: "sk-secret",
			model: "deepseek-chat",
			fetch: http.fetch,
		});
		const netClient = createDeepSeekClient({
			apiKey: "sk-secret",
			model: "deepseek-chat",
			fetch: net.fetch,
		});

		const httpResult = await httpClient.generateFollowUpDecision({
			history: [],
		});
		const netResult = await netClient.generateFollowUpDecision({ history: [] });

		assert.equal(httpResult.ok, false);
		assert.equal(httpResult.ok ? "" : httpResult.reason, "deepseek_http_429");
		assert.equal(netResult.ok, false);
		assert.equal(netResult.ok ? "" : netResult.reason, "network_error");
		assert.doesNotMatch(
			httpResult.ok ? "" : httpResult.userMessage,
			/sk-secret/,
		);
		assert.doesNotMatch(
			netResult.ok ? "" : netResult.userMessage,
			/sk-secret|boom/,
		);
	});
	it("strips markdown formatting and validates JSON when using local provider", async () => {
		const markdownResponse = "```json\n" + validNormal + "\n```";
		const { fetch, calls } = makeFetch([jsonResponse(markdownResponse)]);
		const client = createDeepSeekClient({
			apiKey: "local",
			model: "llama3",
			fetch,
			isLocal: true,
		});

		const result = await client.generateNormalReply({
			systemPrompt: "s",
			history: [],
			queuedMessages: [],
		});

		assert.equal(bodyAt(calls, 0).response_format, undefined); // should omit response_format
		assert.equal(result.ok, true);
		assert.equal(result.ok && result.parsed.ok, true);
	});

	it("returns safe failure on local provider when response is completely unparseable", async () => {
		const { fetch } = makeFetch([jsonResponse("just text without valid json")]);
		const client = createDeepSeekClient({
			apiKey: "local",
			model: "llama3",
			fetch,
			isLocal: true,
		});

		const result = await client.generateNormalReply({
			systemPrompt: "s",
			history: [],
			queuedMessages: [],
		});

		assert.equal(result.ok, false);
		assert.equal(result.ok ? "" : result.reason, "invalid_json_format_from_local");
	});
});
