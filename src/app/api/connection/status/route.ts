import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState, getSettings, listWhatsAppInstances } from "../../../../lib/db.ts";

export async function GET() {
	try {
		const state = await getConnectionState();
		const instances = await listWhatsAppInstances();
		const settings = await getSettings();
		const botProfile = settings.bot_profile || null;
		
		const shouldShowQr =
			!!state.qr_string &&
			(state.status === "qr" || state.status === "connecting");
			
		if (shouldShowQr && state.qr_string) {
			const qrPng = await QRCode.toDataURL(state.qr_string, { width: 320, margin: 2 });
			return NextResponse.json({
				status: "qr",
				qrPng,
				phone: null,
				updatedAt: state.updated_at,
				botProfile,
				instance: { id: state.instance_id, name: state.instance_name },
				instances,
			});
		}

		return NextResponse.json({
			status: state.status,
			qrPng: null,
			phone: state.phone,
			updatedAt: state.updated_at,
			botProfile,
			instance: { id: state.instance_id, name: state.instance_name },
			instances,
		});
	} catch (error: any) {
		console.error("[api] Error en GET /api/connection/status:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

