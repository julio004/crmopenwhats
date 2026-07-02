import { NextResponse } from "next/server";
import { setMode } from "../../../../lib/db.ts";

interface Ctx {
	params: Promise<{ conversationId: string }>;
}

export async function POST(req: Request, { params }: Ctx) {
	try {
		const { conversationId } = await params;
		const parsedId = Number.parseInt(conversationId, 10);
		
		if (Number.isNaN(parsedId)) {
			return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
		}

		const body = await req.json();
		const { mode } = body;

		if (mode !== "AI" && mode !== "HUMAN") {
			return NextResponse.json({ error: "Invalid mode. Must be 'AI' or 'HUMAN'" }, { status: 400 });
		}

		await setMode(parsedId, mode, {
			reason: "dashboard_toggle",
			changedBy: "dashboard",
			eventType: mode === "AI" ? "bot_enabled" : "bot_disabled",
		});

		return NextResponse.json({ ok: true, mode });
	} catch (error: any) {
		console.error("[api] Error en POST /api/mode/[conversationId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}
