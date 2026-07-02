import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import {
	getAllSystemPrompts,
	saveSystemPrompt,
	setActiveSystemPrompt,
	pool,
} from "../../../lib/db.ts";

// Lista todos los prompts cargados en el sistema
export async function GET(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "viewer");
		const prompts = await getAllSystemPrompts();
		return NextResponse.json(prompts);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en GET /api/prompts:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

// Crea un nuevo prompt del sistema
export async function POST(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const body = await req.json();
		const { title, content } = body;

		if (!title || typeof title !== "string" || !title.trim()) {
			return NextResponse.json({ error: "Title is required" }, { status: 400 });
		}
		if (!content || typeof content !== "string" || !content.trim()) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}

		const prompt = await saveSystemPrompt(title.trim(), content.trim());
		return NextResponse.json(prompt);
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en POST /api/prompts:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

// Actualiza un prompt: activarlo o editarlo
export async function PUT(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const body = await req.json();
		const { action, id, title, content } = body;

		if (!id) {
			return NextResponse.json({ error: "Prompt ID is required" }, { status: 400 });
		}

		if (action === "set_active") {
			await setActiveSystemPrompt(Number(id));
			const prompts = await getAllSystemPrompts();
			return NextResponse.json({ ok: true, message: "Prompt set active successfully.", prompts });
		}

		// Si no es acción de activar, asumimos que es edición de título/contenido
		if (!title || typeof title !== "string" || !title.trim()) {
			return NextResponse.json({ error: "Title is required" }, { status: 400 });
		}
		if (!content || typeof content !== "string" || !content.trim()) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}

		const res = await pool.query(
			`UPDATE system_prompts
			 SET title = $2, content = $3
			 WHERE id = $1
			 RETURNING *`,
			[Number(id), title.trim(), content.trim()]
		);

		if (res.rows.length === 0) {
			return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
		}

		return NextResponse.json({ ok: true, prompt: res.rows[0] });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en PUT /api/prompts:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

// Elimina un prompt del sistema (pasándole id por query param ?id=X)
export async function DELETE(req: Request) {
	try {
		await requireRequestRole(req, authDeps, "manager");
		const { searchParams } = new URL(req.url);
		const idStr = searchParams.get("id");

		if (!idStr) {
			return NextResponse.json({ error: "Prompt ID is required in query params" }, { status: 400 });
		}

		const id = Number.parseInt(idStr, 10);
		if (Number.isNaN(id)) {
			return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
		}

		// Evitamos que borren el prompt activo si es el único
		const check = await pool.query("SELECT is_active FROM system_prompts WHERE id = $1", [id]);
		if (check.rows[0]?.is_active) {
			return NextResponse.json(
				{ error: "Cannot delete the active prompt. Please set another prompt active first." },
				{ status: 400 }
			);
		}

		await pool.query("DELETE FROM system_prompts WHERE id = $1", [id]);
		return NextResponse.json({ ok: true, message: "Prompt deleted successfully." });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en DELETE /api/prompts:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}
