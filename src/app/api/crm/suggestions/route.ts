import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";
import type { AiSuggestionStatus } from "@/lib/db-contract";

const STATUSES = new Set<AiSuggestionStatus>([
	"pending",
	"approved",
	"rejected",
	"expired",
]);

export function createSuggestionsRoute(deps: {
	requireViewer: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async GET(req: Request) {
			try {
				await deps.requireViewer(req);
				const { searchParams } = new URL(req.url);
				const statusParam = searchParams.get("status");
				const conversationIdParam = searchParams.get("conversationId");
				const status =
					statusParam && STATUSES.has(statusParam as AiSuggestionStatus)
						? (statusParam as AiSuggestionStatus)
						: undefined;
				const conversation_id =
					conversationIdParam === null ? undefined : Number(conversationIdParam);

				if (
					conversationIdParam &&
					(!Number.isInteger(conversation_id) || Number(conversation_id) <= 0)
				) {
					return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
				}

				const suggestions = await deps.crmRepo.listAiSuggestions({
					status,
					conversation_id,
				});
				return NextResponse.json(suggestions);
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error("[api] Error en GET /api/crm/suggestions:", error);
				return NextResponse.json(
					{ error: "Internal Server Error", message: error.message },
					{ status: 500 },
				);
			}
		},
	};
}

const routes = createSuggestionsRoute({
	requireViewer: (req) => requireRequestRole(req, authDeps, "viewer"),
	crmRepo,
});

export const GET = routes.GET;
