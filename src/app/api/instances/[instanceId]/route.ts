import { NextResponse } from "next/server";
import fs from "node:fs";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import {
	deleteWhatsAppInstance,
	setActiveWhatsAppInstance,
} from "../../../../lib/db.ts";
import {
	clearDirectoryContents,
	getInstanceAuthDir,
	getSoftRestartFlagPath,
	runtimePaths,
} from "../../../../lib/runtime-paths.ts";

interface Ctx {
	params: Promise<{ instanceId: string }>;
}

function requestBotRestart() {
	if (!fs.existsSync(runtimePaths.dataDir)) fs.mkdirSync(runtimePaths.dataDir, { recursive: true });
	fs.writeFileSync(getSoftRestartFlagPath(), "");
}

function parseInstanceId(value: string) {
	const id = Number.parseInt(value, 10);
	if (!Number.isFinite(id)) throw new Error("invalid_instance_id");
	return id;
}

export async function PATCH(req: Request, { params }: Ctx) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const { instanceId } = await params;
		const id = parseInstanceId(instanceId);
		const body = await req.json().catch(() => ({}));
		if (body.active !== true) {
			return NextResponse.json({ error: "Only active=true is supported" }, { status: 400 });
		}
		const instance = await setActiveWhatsAppInstance(id);
		requestBotRestart();
		return NextResponse.json(instance);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en PATCH /api/instances/[instanceId]:", error);
		const status = error.message?.startsWith("whatsapp_instance_not_found") ? 404 : 500;
		return NextResponse.json({ error: "Could not update instance", message: error.message }, { status });
	}
}

export async function DELETE(_req: Request, { params }: Ctx) {
	try {
		await requireRequestRole(_req, authDeps, "manager");
		const { instanceId } = await params;
		const id = parseInstanceId(instanceId);
		await deleteWhatsAppInstance(id);
		const authDir = getInstanceAuthDir(id);
		if (fs.existsSync(authDir)) clearDirectoryContents(authDir);
		requestBotRestart();
		return NextResponse.json({ ok: true });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en DELETE /api/instances/[instanceId]:", error);
		const status = error.message === "cannot_delete_last_instance" ? 400 : error.message?.startsWith("whatsapp_instance_not_found") ? 404 : 500;
		return NextResponse.json({ error: "Could not delete instance", message: error.message }, { status });
	}
}
