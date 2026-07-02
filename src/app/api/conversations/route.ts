import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeConversationViewService } from "../../../lib/services/conversation-view.ts";

export function createConversationListRoute(deps: {
	requireViewer: (req: Request) => Promise<unknown>;
	listConversations: (options: {
		archived?: boolean;
		hasMessages?: boolean;
	}) => Promise<unknown>;
}) {
	return async function GET(req: Request) {
		try {
			await deps.requireViewer(req);
			const { searchParams } = new URL(req.url);
			const archived = searchParams.get("archived") === "true";
			const hasMessages = searchParams.get("hasMessages") === "true";
			const conversations = await deps.listConversations({ archived, hasMessages });
			return NextResponse.json(conversations);
		} catch (error: any) {
			const authResponse = authErrorToResponse(error);
			if (authResponse) return authResponse;
			console.error("[api] Error en GET /api/conversations:", error);
			return NextResponse.json(
				{ error: "Internal Server Error", message: error.message },
				{ status: 500 },
			);
		}
	};
}

export const GET = createConversationListRoute({
	requireViewer: (req) => requireRequestRole(req, authDeps, "viewer"),
	listConversations: (options) => runtimeConversationViewService.listConversations(options),
});
