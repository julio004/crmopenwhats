import { NextResponse } from "next/server";
import { getSettings } from "../../../lib/db.ts";

type Capability = "chat" | "audio" | "image";
type Provider = "openai" | "google" | "deepseek" | "minimax" | "local";

const PROVIDER_BASE_URL: Record<Provider, string> = {
	openai: "https://api.openai.com/v1",
	google: "https://generativelanguage.googleapis.com/v1beta",
	deepseek: "https://api.deepseek.com",
	minimax: "https://api.minimax.io/v1",
	local: "http://localhost:11434/v1",
};

function getProviderBaseUrl(provider: Provider): string {
	if (provider === "local") {
		return (process.env.LOCAL_LLM_URL || PROVIDER_BASE_URL.local).replace(/\/$/, "");
	}
	return PROVIDER_BASE_URL[provider];
}

const FALLBACK_MODELS: Record<Provider, Record<Capability, string[]>> = {
	openai: {
		chat: ["gpt-4o-mini", "gpt-4o"],
		audio: ["gpt-4o-transcribe", "whisper-1"],
		image: ["gpt-4o-mini", "gpt-4o"],
	},
	google: {
		chat: ["gemini-3.5-flash", "gemini-2.5-flash"],
		audio: ["gemini-3.5-flash", "gemini-2.5-flash"],
		image: ["gemini-3.5-flash", "gemini-2.5-flash"],
	},
	deepseek: {
		chat: ["deepseek-v4-pro", "deepseek-chat"],
		audio: [],
		image: [],
	},
	minimax: {
		chat: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.1"],
		audio: [],
		image: [],
	},
	local: {
		chat: ["llama3"],
		audio: [],
		image: [],
	},
};

function isProvider(value: unknown): value is Provider {
	return value === "openai" ||
		value === "google" ||
		value === "deepseek" ||
		value === "minimax" ||
		value === "local";
}

function isCapability(value: unknown): value is Capability {
	return value === "chat" || value === "audio" || value === "image";
}

function envApiKey(provider: Provider): string {
	if (provider === "openai") return process.env.OPENAI_API_KEY || "";
	if (provider === "google") return process.env.GEMINI_API_KEY || "";
	if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY || "";
	if (provider === "local") return process.env.LOCAL_LLM_API_KEY || "local";
	return process.env.MINIMAX_API_KEY || "";
}

function settingsApiKey(
	settings: Record<string, unknown>,
	provider: Provider,
	capability: Capability,
): string {
	const capabilityKey = settings[`${capability}_ai_api_key`];
	if (typeof capabilityKey === "string" && capabilityKey.trim()) {
		return capabilityKey.trim();
	}
	return envApiKey(provider);
}

function uniqueModels(models: string[]) {
	return Array.from(new Set(models.filter((model) => model.trim()))).sort();
}

function filterModels(
	provider: Provider,
	capability: Capability,
	models: string[],
) {
	if (provider === "google") {
		return uniqueModels(
			models
				.map((model) => model.replace(/^models\//, ""))
				.filter((model) => model.startsWith("gemini-")),
		);
	}

	if (provider === "deepseek") {
		return uniqueModels(models.filter((model) => model.includes("deepseek")));
	}

	if (provider === "minimax") {
		return uniqueModels(models.filter((model) => model.includes("MiniMax")));
	}

	if (provider === "local") {
		return uniqueModels(models); // local providers usually return all available models and we shouldn't restrict names
	}

	if (capability === "audio") {
		return uniqueModels(
			models.filter(
				(model) => model.includes("transcribe") || model.includes("whisper"),
			),
		);
	}

	return uniqueModels(
		models.filter((model) => model.startsWith("gpt-") || model.includes("4o")),
	);
}

async function fetchOpenAiCompatibleModels(
	provider: "openai" | "deepseek" | "minimax" | "local",
	apiKey: string,
	capability: Capability,
) {
	if (provider === "minimax") return FALLBACK_MODELS.minimax[capability];
	const baseUrl = getProviderBaseUrl(provider);
	const response = await fetch(`${baseUrl}/models`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});
	if (!response.ok) throw new Error(`${provider}_models_http_${response.status}`);
	const payload = await response.json();
	const rawArray = Array.isArray(payload.data) 
		? payload.data 
		: Array.isArray(payload.models) 
			? payload.models 
			: Array.isArray(payload) 
				? payload 
				: [];
	const models = rawArray
		.map((item: unknown) => {
			if (typeof item === "object" && item !== null) {
				const obj = item as Record<string, unknown>;
				if ("id" in obj && typeof obj.id === "string") return obj.id;
				if ("name" in obj && typeof obj.name === "string") return obj.name;
				if ("key" in obj && typeof obj.key === "string") return obj.key;
			}
			return "";
		})
		.filter(Boolean);
	return filterModels(provider, capability, models);
}

async function fetchGoogleModels(apiKey: string, capability: Capability) {
	const response = await fetch(
		`${PROVIDER_BASE_URL.google}/models?key=${encodeURIComponent(apiKey)}`,
	);
	if (!response.ok) throw new Error(`google_models_http_${response.status}`);
	const payload = await response.json();
	const models = Array.isArray(payload.models)
		? payload.models
				.filter((item: unknown) => {
					if (typeof item !== "object" || item === null) return false;
					if (!("supportedGenerationMethods" in item)) return true;
					return (
						Array.isArray(item.supportedGenerationMethods) &&
						item.supportedGenerationMethods.includes("generateContent")
					);
				})
				.map((item: unknown) =>
					typeof item === "object" &&
					item !== null &&
					"name" in item &&
					typeof item.name === "string"
						? item.name
						: "",
				)
				.filter(Boolean)
		: [];
	return filterModels("google", capability, models);
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		if (!isProvider(body?.provider) || !isCapability(body?.capability)) {
			return NextResponse.json({ error: "Invalid provider or capability" }, { status: 400 });
		}
		const provider: Provider = body.provider;
		const capability: Capability = body.capability;

		if (
			(capability === "audio" || capability === "image") &&
			(provider === "deepseek" || provider === "minimax" || provider === "local")
		) {
			return NextResponse.json({ error: "Provider not supported for capability" }, { status: 400 });
		}

		const settings = await getSettings();
		const apiKey =
			typeof body.apiKey === "string" && body.apiKey.trim()
				? body.apiKey.trim()
				: settingsApiKey(settings, provider, capability);
		if (!apiKey) {
			return NextResponse.json({ error: "Missing API key" }, { status: 400 });
		}

		const fetched =
			provider === "google"
				? await fetchGoogleModels(apiKey, capability)
				: await fetchOpenAiCompatibleModels(
						provider,
						apiKey,
						capability,
					);
		const models = fetched.length > 0 ? fetched : FALLBACK_MODELS[provider][capability];

		return NextResponse.json({
			ok: true,
			provider,
			capability,
			models,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: "Could not connect to provider",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 502 },
		);
	}
}
