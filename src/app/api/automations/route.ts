import { NextResponse } from "next/server";

import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import {
	deleteAutomation,
	listAutomations,
	saveAutomation,
	setAutomationEnabled,
	updateAutomation,
} from "@/lib/db";

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "viewer");
		return NextResponse.json(await listAutomations());
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en GET /api/automations:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const body = await req.json();
		const automation = await saveAutomation(body);
		return NextResponse.json(automation);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en POST /api/automations:", error);
		return badRequest(error.message || "Invalid automation");
	}
}

export async function PUT(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const body = await req.json();
		const id = Number(body.id);
		if (!Number.isInteger(id) || id <= 0) return badRequest("Invalid automation ID");

		if (body.action === "set_enabled") {
			const automation = await setAutomationEnabled(id, body.enabled === true);
			if (!automation) {
				return NextResponse.json({ error: "Automation not found" }, { status: 404 });
			}
			return NextResponse.json(automation);
		}

		const automation = await updateAutomation(id, body);
		if (!automation) {
			return NextResponse.json({ error: "Automation not found" }, { status: 404 });
		}
		return NextResponse.json(automation);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en PUT /api/automations:", error);
		return badRequest(error.message || "Invalid automation");
	}
}

export async function DELETE(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const id = Number(new URL(req.url).searchParams.get("id"));
		if (!Number.isInteger(id) || id <= 0) return badRequest("Invalid automation ID");

		await deleteAutomation(id);
		return NextResponse.json({ ok: true });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en DELETE /api/automations:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 },
		);
	}
}
