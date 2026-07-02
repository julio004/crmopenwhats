import { createDeepSeekClient } from "./deepseek-client.ts";

export const deepseek = createDeepSeekClient({
	apiKey: process.env.DEEPSEEK_API_KEY || "",
	model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
	fetch: globalThis.fetch as any,
});
