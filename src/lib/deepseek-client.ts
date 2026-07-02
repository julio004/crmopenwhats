import {
	parseFollowUpDecision,
	parseNormalReply,
	type FollowUpDecisionParseResult,
	type MessageRole,
	type NormalReplyParseResult,
} from "../domain/whatsapp-rules.ts";

export type DeepSeekFetchResponse = {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
};

export type DeepSeekFetch = (
	url: string | URL,
	init?: RequestInit,
) => Promise<DeepSeekFetchResponse>;

export interface DeepSeekClientConfig {
	apiKey: string;
	model: string;
	fetch: DeepSeekFetch;
	baseUrl?: string;
	isLocal?: boolean;
}

export interface DeepSeekHistoryMessage {
	role: MessageRole;
	content: string;
}

export interface NormalReplyRequest {
	systemPrompt: string;
	history: DeepSeekHistoryMessage[];
	queuedMessages: Array<{ text: string }>;
}

export interface FollowUpRequest {
	history: DeepSeekHistoryMessage[];
}

export interface LeadQualificationRequest {
	history: DeepSeekHistoryMessage[];
}

export type DeepSeekAdapterResult<T> =
	| { ok: true; parsed: T; rawContent: string; attempts: number }
	| {
			ok: false;
			reason: string;
			sendRaw: false;
			attempts: number;
			userMessage: string;
	  };

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Parser<T> = (raw: string) => T;

type ParseFailure = { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chatUrl(config: DeepSeekClientConfig) {
	return `${(config.baseUrl ?? "https://api.deepseek.com/v1").replace(/\/$/, "")}/chat/completions`;
}

function safeFailure(
	reason: string,
	attempts: number,
): DeepSeekAdapterResult<never> {
	return {
		ok: false,
		reason,
		sendRaw: false,
		attempts,
		userMessage:
			"DeepSeek request failed safely; no raw model text is sendable.",
	};
}

function extractContent(payload: unknown): string | null {
	if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
	const first = payload.choices[0];
	if (!isRecord(first) || !isRecord(first.message)) return null;
	return typeof first.message.content === "string"
		? first.message.content
		: null;
}

function toChatHistory(history: DeepSeekHistoryMessage[]): ChatMessage[] {
	return history.map((item) => ({
		role: item.role === "assistant" ? "assistant" : "user",
		content: item.content,
	}));
}

function normalMessages(input: NormalReplyRequest): ChatMessage[] {
	return [
		{ role: "system", content: input.systemPrompt },
		...toChatHistory(input.history),
		{
			role: "user",
			content: [
				"Responde usando JSON estricto sin markdown.",
				'Formato obligatorio: {"response":{"part_1":"...","part_2":"...","part_3":"..."},"handoff":{"required":false,"reason":""},"lead":{"labels":["frio"|"neutro"|"caliente"|"cliente_potencial"],"score":0-100,"reason":"..."}}.',
				"Usa handoff.required=true si necesita humano.",
				"Clasifica intención comercial actual. Usa labels como estado completo: omití una etiqueta si ya no aplica. score=0 pésimo lead, 100 excelente lead.",
				`Mensajes del turno: ${input.queuedMessages.map((m) => m.text).join("\n")}`,
			].join("\n"),
		},
	];
}

function followUpMessages(input: FollowUpRequest): ChatMessage[] {
	return [
		{
			role: "system",
			content: [
				"Eres un asistente virtual de ventas. Tu tarea es analizar el historial de chat y decidir si amerita enviar un mensaje de seguimiento (follow-up) para reactivar la conversación porque el cliente dejó de responder.",
				"",
				"Reglas de Decisión:",
				"- Si el último mensaje es del cliente (user), devuelve respuesta='NO'.",
				"- Si ya se envió un seguimiento recientemente y el cliente no ha interactuado, evalúa si es prudente insistir. Si no, devuelve respuesta='NO'.",
				"- Si amerita seguimiento, devuelve respuesta='SI' y redacta un mensaje.",
				"",
				"Reglas de Redacción del Mensaje de Seguimiento (mensaje):",
				"- Debe ser un mensaje breve, natural y amigable para saber si el cliente sigue ahí, animarlo a responder o continuar con la conversación.",
				"- Ejemplos de tono: '¡Hola! ¿Pudiste ver la información?', 'Hola, ¿sigues por ahí? Cuéntame si tienes alguna duda.', 'Hola, me quedé atento a tu respuesta. ¿Pudiste revisar lo anterior?'.",
				"- ¡CRÍTICO!: NO repitas NINGÚN mensaje de seguimiento (follow-up) que ya se haya enviado antes en el historial. Si ves en el historial que ya le enviaste un mensaje de seguimiento (como '¡Hola! ¿Sigues por ahí?'), debés redactar un mensaje completamente diferente, cambiar el enfoque (por ejemplo, ofrecerle una demo gratis de 3 días, preguntarle si prefiere ver los precios detallados de los planes, o si tiene dudas sobre el equipo de US$300).",
				"- ¡CRÍTICO!: NO respondas tus propias preguntas anteriores ni intentes re-explicar el negocio.",
				"- ¡CRÍTICO!: NO escribas descripciones, resúmenes ni análisis de la conversación (por ejemplo, 'El usuario confirma...', 'Se le pregunta...'). El contenido de 'mensaje' debe ser el texto literal, en lenguaje sumamente natural y en primera persona que se le enviará directamente al cliente por WhatsApp.",
				"",
				"Devuelve exclusivamente JSON estricto con el siguiente formato:",
				'{"respuesta":"SI"|"NO","mensaje":"..."}'
			].join("\n"),
		},
		...toChatHistory(input.history),
		{
			role: "user",
			content: [
				"Analizá el historial de chat anterior.",
				"Decidí si corresponde enviar un mensaje de seguimiento (follow-up) para reactivar la conversación porque el cliente dejó de responder.",
				"Devolvé exclusivamente JSON estricto con el siguiente formato sin markdown ni bloques de código:",
				'{"respuesta":"SI"|"NO","mensaje":"..."}'
			].join("\n"),
		},
	];
}

function qualificationMessages(input: LeadQualificationRequest): ChatMessage[] {
	return [
		{
			role: "system",
			content: [
				"You are a lead qualification analyst for a WhatsApp CRM.",
				"Return strict JSON only. Do not include markdown.",
				"Required keys: intent, urgency, budget, fit, objections, next_step, qualification_status, confidence, reason.",
				"urgency and fit must be one of: high, medium, low, unknown.",
				"qualification_status must be one of: qualified, nurture, unqualified, unknown.",
				"confidence must be a number from 0 to 1.",
			].join("\n"),
		},
		...toChatHistory(input.history),
		{
			role: "user",
			content:
				"Perform lead qualification for the conversation above and return strict JSON.",
		},
	];
}

type LeadQualificationParseResult =
	| ({ ok: true } & Record<string, unknown>)
	| { ok: false; reason: string };

function parseLeadQualification(raw: string): LeadQualificationParseResult {
	try {
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) return { ok: false as const, reason: "qualification_not_object" };
		for (const key of [
			"intent",
			"urgency",
			"budget",
			"fit",
			"next_step",
			"qualification_status",
			"confidence",
			"reason",
		]) {
			if (!(key in parsed)) {
				return { ok: false as const, reason: `qualification_missing_${key}` };
			}
		}
		return { ok: true as const, ...parsed };
	} catch {
		return { ok: false as const, reason: "qualification_invalid_json" };
	}
}

function repairMessages(
	raw: string,
	kind: "normal" | "followup" | "qualification",
): ChatMessage[] {
	const schema =
		kind === "normal"
			? '{"response":{"part_1":"...","part_2":"...","part_3":"..."},"handoff":{"required":false,"reason":""},"lead":{"labels":["frio"|"neutro"|"caliente"|"cliente_potencial"],"score":0-100,"reason":"..."}}'
			: kind === "followup"
				? '{"respuesta":"SI"|"NO","mensaje":"..."}'
				: '{"intent":"...","urgency":"high|medium|low|unknown","budget":"confirmed|mentioned|unknown|...","fit":"high|medium|low|unknown","objections":["..."],"next_step":"...","qualification_status":"qualified|nurture|unqualified|unknown","confidence":0.0,"reason":"..."}';
	return [
		{
			role: "user",
			content: `Repara la salida anterior para que sea JSON estricto con este formato: ${schema}\nSalida anterior:\n${raw}`,
		},
	];
}

export function createDeepSeekClient(config: DeepSeekClientConfig) {
	async function post(messages: ChatMessage[]) {
		const response = await config.fetch(chatUrl(config), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify({
				model: config.model,
				messages,
				temperature: 0.3,
				...(config.isLocal ? {} : { response_format: { type: "json_object" } }),
			}),
		});
		if (!response.ok)
			return { ok: false as const, reason: `deepseek_http_${response.status}` };
		let content = extractContent(await response.json());
		if (content === null)
			return { ok: false as const, reason: "invalid_response_shape" };
			
		if (config.isLocal) {
			let cleanRaw = content.trim();
			if (cleanRaw.startsWith("```json")) {
				cleanRaw = cleanRaw.substring(7);
				if (cleanRaw.endsWith("```")) cleanRaw = cleanRaw.substring(0, cleanRaw.length - 3);
				cleanRaw = cleanRaw.trim();
			} else if (cleanRaw.startsWith("```")) {
				cleanRaw = cleanRaw.substring(3);
				if (cleanRaw.endsWith("```")) cleanRaw = cleanRaw.substring(0, cleanRaw.length - 3);
				cleanRaw = cleanRaw.trim();
			}
			content = cleanRaw;
			try {
				JSON.parse(content);
			} catch {
				return { ok: false as const, reason: "invalid_json_format_from_local" };
			}
		}
		return { ok: true as const, content };
	}

	async function requestWithRepair<T extends { ok: boolean }>(input: {
		messages: ChatMessage[];
		kind: "normal" | "followup" | "qualification";
		parse: Parser<T>;
	}): Promise<DeepSeekAdapterResult<T>> {
		let attempts = 0;
		try {
			const first = await post(input.messages);
			attempts += 1;
			if (!first.ok) return safeFailure(first.reason, attempts);
			let parsed = input.parse(first.content);
			if (parsed.ok)
				return { ok: true, parsed, rawContent: first.content, attempts };

			const repair = await post(repairMessages(first.content, input.kind));
			attempts += 1;
			if (!repair.ok) return safeFailure(repair.reason, attempts);
			parsed = input.parse(repair.content);
			if (parsed.ok)
				return { ok: true, parsed, rawContent: repair.content, attempts };
			return safeFailure((parsed as unknown as ParseFailure).reason, attempts);
		} catch {
			return safeFailure("network_error", attempts + 1);
		}
	}

	return {
		generateNormalReply(input: NormalReplyRequest) {
			return requestWithRepair<NormalReplyParseResult>({
				messages: normalMessages(input),
				kind: "normal",
				parse: parseNormalReply,
			});
		},
		generateFollowUpDecision(input: FollowUpRequest) {
			return requestWithRepair<FollowUpDecisionParseResult>({
				messages: followUpMessages(input),
				kind: "followup",
				parse: parseFollowUpDecision,
			});
		},
		qualifyLead(input: LeadQualificationRequest) {
			return requestWithRepair<ReturnType<typeof parseLeadQualification>>({
				messages: qualificationMessages(input),
				kind: "qualification",
				parse: parseLeadQualification,
			});
		},
	};
}
