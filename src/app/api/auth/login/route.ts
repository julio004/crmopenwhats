import { NextResponse } from "next/server";

import { bootstrapAuthOwner } from "@/lib/auth/bootstrap";
import {
	createSessionService,
	setSessionCookie,
	type SessionRouteDeps,
} from "@/lib/auth/session";
import { runtimeSessionDeps } from "@/lib/auth/runtime";

export function createLoginRoute(deps: SessionRouteDeps) {
	return async function POST(request: Request) {
		try {
			const body = await request.json().catch(() => ({}));
			const email = typeof body.email === "string" ? body.email : "";
			const password = typeof body.password === "string" ? body.password : "";

			await bootstrapAuthOwner({
				repo: deps.repo,
				adminEmail: process.env.ADMIN_EMAIL,
				adminPassword: process.env.ADMIN_PASSWORD,
				teamName: "Bot Personal",
			});

			const sessionService = createSessionService(deps);
			const result = await sessionService.login({ email, password });
			if (result.status !== "authenticated") {
				return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
			}

			const response = NextResponse.json({ success: true });
			return setSessionCookie(response, result.token, {
				secure: deps.secureCookies,
				maxAgeSeconds: Math.floor((deps.sessionTtlMs ?? 7 * 24 * 60 * 60 * 1000) / 1000),
			});
		} catch (error) {
			return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
		}
	};
}

export const POST = createLoginRoute(runtimeSessionDeps);
