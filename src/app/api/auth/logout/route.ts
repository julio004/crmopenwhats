import { NextResponse } from "next/server";

import {
	clearSessionCookie,
	createSessionService,
	type SessionRouteDeps,
} from "@/lib/auth/session";
import { runtimeSessionDeps } from "@/lib/auth/runtime";

export function createLogoutRoute(deps: SessionRouteDeps) {
	return async function POST(request: Request) {
		await createSessionService(deps).revokeFromRequest(request);
		return clearSessionCookie(NextResponse.json({ success: true }));
	};
}

export const POST = createLogoutRoute(runtimeSessionDeps);
