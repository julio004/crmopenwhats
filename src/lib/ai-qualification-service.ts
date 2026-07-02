import type { MessageRole } from "../domain/whatsapp-rules.ts";
import {
	buildLeadQualificationSuggestions,
	normalizeAiLeadQualification,
	type AiLeadQualification,
} from "./ai-crm.ts";
import type { CrmRepository } from "./repositories/crm-repository.ts";

export interface QualificationHistoryMessage {
	role: MessageRole;
	content: string;
}

export interface QualificationAiClient {
	qualifyLead(input: {
		history: QualificationHistoryMessage[];
	}): Promise<
		| { ok: true; parsed: Record<string, unknown> }
		| { ok: false; reason: string }
	>;
}

export async function qualifyLeadAndCreateSuggestions(input: {
	conversation: { id: number; contact_id: number | null };
	history: QualificationHistoryMessage[];
	crmRepo: Pick<CrmRepository, "createAiSuggestion">;
	aiClient: QualificationAiClient;
}): Promise<
	| {
			ok: true;
			qualification: AiLeadQualification;
			suggestions_created: number;
	  }
	| { ok: false; reason: string }
> {
	const aiResult = await input.aiClient.qualifyLead({ history: input.history });
	if (!aiResult.ok) return { ok: false, reason: aiResult.reason };

	const qualification = normalizeAiLeadQualification(aiResult.parsed);
	const suggestions = buildLeadQualificationSuggestions({
		conversation_id: input.conversation.id,
		contact_id: input.conversation.contact_id,
		qualification,
	});

	for (const suggestion of suggestions) {
		await input.crmRepo.createAiSuggestion(suggestion);
	}

	return {
		ok: true,
		qualification,
		suggestions_created: suggestions.length,
	};
}
