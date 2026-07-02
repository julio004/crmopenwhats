import type { ConversationRow } from "./db-contract.ts";

export function outboxDestinationForConversation(
	conversation: Pick<ConversationRow, "phone" | "jid">,
) {
	const jid = conversation.jid?.trim();
	if (jid) return jid;
	const phone = conversation.phone.trim();
	return phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
}
