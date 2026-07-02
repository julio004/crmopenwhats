import { NextResponse } from "next/server";

import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { listCrmTasks, saveCrmTask } from "@/lib/db";

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "viewer");
		return NextResponse.json(await listCrmTasks());
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en GET /api/tasks:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "agent");
		const body = await req.json();
		const task = await saveCrmTask(body);
		return NextResponse.json(task);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en POST /api/tasks:", error);
		return badRequest(error.message || "Invalid task");
	}
}
