import { NextResponse } from "next/server";
import fs from "node:fs";
import { getActiveWhatsAppInstance, setConnectionState } from "../../../../lib/db.ts";
import {
	getDestructiveRestartFlagPath,
	getInstanceAuthDir,
	runtimePaths,
	clearDirectoryContents,
} from "../../../../lib/runtime-paths.ts";

export async function POST() {
	try {
		console.log("[api] Petición de desconexión manual recibida.");

		// 1. Limpiamos el estado de conexión en la base de datos
		await setConnectionState({
			status: "disconnected",
			qr_string: null,
			phone: null,
		});

		const activeInstance = await getActiveWhatsAppInstance();
		const authDir = getInstanceAuthDir(activeInstance.id);
		const restartFlagPath = getDestructiveRestartFlagPath();
		const dataDir = runtimePaths.dataDir;

		// 2. Vaciamos la carpeta auth/
		if (fs.existsSync(authDir)) {
			clearDirectoryContents(authDir);
			console.log("[api] Directorio auth/ vaciado.");
		}

		// Aseguramos que la carpeta data/ existe
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		// 3. Escribimos la bandera de reinicio
		fs.writeFileSync(restartFlagPath, "");
		console.log("[api] Bandera .reset-auth creada con éxito.");

		return NextResponse.json({
			ok: true,
			message: "Disconnecting and resetting WhatsApp auth session...",
		});
	} catch (error: any) {
		console.error("[api] Error en POST /api/connection/disconnect:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}
