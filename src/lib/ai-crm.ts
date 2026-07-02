import type { LeadLabel } from "../domain/whatsapp-rules.ts";
import type { AiSuggestionAction } from "./db-contract.ts";

export const CRM_RISKY_AI_ACTIONS = new Set<AiSuggestionAction>([
	"create_deal",
	"update_deal_stage",
	"route_to_human",
	"send_reply",
]);

type QualificationStatus = "qualified" | "nurture" | "unqualified" | "unknown";
type Signal = "high" | "medium" | "low" | "unknown";

export interface AiLeadQualification {
	intent: string;
	urgency: Signal;
	budget: string;
	fit: Signal;
	objections: string[];
	next_step: string;
	qualification_status: QualificationStatus;
	confidence: number;
	reason: string;
	lead_score: number;
	lead_labels: LeadLabel[];
	requires_human_review: boolean;
}

export interface AiSuggestionDraft {
	conversation_id: number;
	contact_id: number | null;
	action_type: AiSuggestionAction;
	payload: Record<string, unknown>;
	confidence: number;
	reason: string;
	requires_confirmation: boolean;
	source: string;
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const normalizeSignal = (value: unknown): Signal => {
	if (value === "high" || value === "medium" || value === "low") return value;
	return "unknown";
};

const scoreSignal = (value: Signal) => {
	if (value === "high") return 30;
	if (value === "medium") return 18;
	if (value === "low") return 6;
	return 0;
};

const normalizeStatus = (value: unknown): QualificationStatus => {
	if (
		value === "qualified" ||
		value === "nurture" ||
		value === "unqualified" ||
		value === "unknown"
	) {
		return value;
	}
	return "unknown";
};

const labelForScore = (score: number): LeadLabel[] => {
	if (score >= 80) return ["caliente", "cliente_potencial"];
	if (score >= 50) return ["neutro"];
	return ["frio"];
};

export function normalizeAiLeadQualification(
	raw: Record<string, unknown>,
): AiLeadQualification {
	const urgency = normalizeSignal(raw.urgency);
	const fit = normalizeSignal(raw.fit);
	const status = normalizeStatus(raw.qualification_status);
	const confidence = clamp(Number(raw.confidence ?? 0), 0, 1);
	const budget = typeof raw.budget === "string" ? raw.budget.trim() : "unknown";
	const intent = typeof raw.intent === "string" ? raw.intent.trim() : "unknown";
	const nextStep =
		typeof raw.next_step === "string" && raw.next_step.trim()
			? raw.next_step.trim()
			: "Review lead manually";
	const reason =
		typeof raw.reason === "string" && raw.reason.trim()
			? raw.reason.trim()
			: "AI qualification did not provide a detailed reason";
	const objections = Array.isArray(raw.objections)
		? raw.objections.filter((item): item is string => typeof item === "string")
		: [];

	const statusScore =
		status === "qualified" ? 16 : status === "nurture" ? 10 : status === "unqualified" ? 0 : 6;
	const budgetScore =
		budget === "confirmed" ? 10 : budget === "mentioned" ? 8 : budget === "unknown" ? 0 : 6;
	const intentScore = /buy|price|pricing|demo|purchase|compr|precio|plan/i.test(intent)
		? 6
		: /support|soporte|help|ayuda/i.test(intent)
			? 8
			: 6;
	const lead_score = clamp(
		Math.round(scoreSignal(urgency) + scoreSignal(fit) + statusScore + budgetScore + intentScore),
		0,
		100,
	);

	return {
		intent,
		urgency,
		budget,
		fit,
		objections,
		next_step: nextStep,
		qualification_status: status,
		confidence,
		reason,
		lead_score,
		lead_labels: labelForScore(lead_score),
		requires_human_review: lead_score >= 80 && confidence >= 0.75,
	};
}

export function buildLeadQualificationSuggestions(input: {
	conversation_id: number;
	contact_id: number | null;
	qualification: AiLeadQualification;
}): AiSuggestionDraft[] {
	const { qualification } = input;
	const priority =
		qualification.lead_score >= 80 ? "high" : qualification.lead_score >= 50 ? "medium" : "low";
	const base = {
		conversation_id: input.conversation_id,
		contact_id: input.contact_id,
		confidence: qualification.confidence,
		reason: qualification.reason,
		source: "lead_qualification",
	};

	const suggestions: AiSuggestionDraft[] = [
		{
			...base,
			action_type: "create_task",
			requires_confirmation: priority !== "low",
			payload: {
				title: qualification.next_step,
				priority,
				task_type: priority === "high" ? "call_client" : "follow_up",
				lead_label: qualification.lead_labels[0] ?? null,
			},
		},
	];

	if (qualification.lead_score >= 70) {
		suggestions.push({
			...base,
			action_type: "create_deal",
			requires_confirmation: true,
			payload: {
				title: `Qualified lead: ${qualification.intent}`,
				stage: "contacted",
				description: qualification.reason,
			},
		});
	}

	if (qualification.requires_human_review) {
		suggestions.push({
			...base,
			action_type: "route_to_human",
			requires_confirmation: true,
			payload: {
				reason: qualification.reason,
				next_step: qualification.next_step,
			},
		});
	}

	return suggestions;
}
