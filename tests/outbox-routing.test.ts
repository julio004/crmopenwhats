import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { outboxDestinationForConversation } from "../src/lib/outbox-routing.ts";

describe("outbox routing", () => {
	it("prefers the stored WhatsApp JID over the phone field", () => {
		assert.equal(
			outboxDestinationForConversation({
				phone: "106266785509549",
				jid: "171855029772514@lid",
			}),
			"171855029772514@lid",
		);
	});

	it("falls back to a WhatsApp phone JID when no stored JID exists", () => {
		assert.equal(
			outboxDestinationForConversation({
				phone: "18496294358",
				jid: null,
			}),
			"18496294358@s.whatsapp.net",
		);
	});
});
