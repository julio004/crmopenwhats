import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeProfileStatus } from "../src/lib/baileys/profile.ts";

describe("Baileys profile normalization", () => {
	it("extracts a render-safe status string from Baileys status objects", () => {
		assert.equal(
			normalizeProfileStatus({ setAt: new Date("2026-06-03T00:00:00Z"), status: "Disponible" }),
			"Disponible",
		);
		assert.equal(
			normalizeProfileStatus([{ setAt: "2026-06-03", status: { status: "Ocupado" } }]),
			"Ocupado",
		);
		assert.equal(normalizeProfileStatus({ setAt: "2026-06-03" }), null);
	});
});
