import { NextResponse } from "next/server";

import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { deleteCrmTask, updateCrmTask } from "@/lib/db";

interface Ctx {
	params: Promise<{ taskId: string }>;
}

function parseTaskId(taskId: string) {
	const id = Number.parseInt(taskId, 10);
	return Number.isInteger(id) && id > 0 ? id : null;
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(req: Request, { params }: Ctx) {
	try {
		await requireRequestRole(req, authDeps, "agent");
		const { taskId } = await params;
		const parsedId = parseTaskId(taskId);
		if (!parsedId) return badRequest("Invalid task ID");

		const body = await req.json().catch(() => ({}));
		const task = await updateCrmTask(parsedId, body);
		if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

		return NextResponse.json(task);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en PATCH /api/tasks/[taskId]:", error);
		return badRequest(error.message || "Invalid task");
	}
}

export async function DELETE(_req: Request, { params }: Ctx) {
	try {
		await requireRequestRole(_req, authDeps, "agent");
		const { taskId } = await params;
		const parsedId = parseTaskId(taskId);
		if (!parsedId) return badRequest("Invalid task ID");

		await deleteCrmTask(parsedId);
		return NextResponse.json({ ok: true });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en DELETE /api/tasks/[taskId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}
