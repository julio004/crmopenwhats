import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";

type SuggestionResolutionStatus = "approved" | "rejected" | "expired";

const RESOLUTION_STATUSES = new Set<SuggestionResolutionStatus>([
	"approved",
	"rejected",
	"expired",
]);

export function createSuggestionDetailRoute(deps: {
	requireAgent: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async PATCH(
			req: Request,
			{ params }: { params: Promise<{ suggestionId: string }> | { suggestionId: string } },
		) {
			try {
				const context = await deps.requireAgent(req);
				const resolvedParams = await params;
				const suggestionId = Number(resolvedParams.suggestionId);
				if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
					return NextResponse.json({ error: "Invalid suggestion ID" }, { status: 400 });
				}

				const body = await req.json().catch(() => ({}));
				if (!RESOLUTION_STATUSES.has(body.status)) {
					return NextResponse.json({ error: "Invalid suggestion status" }, { status: 400 });
				}

				const suggestion = await deps.crmRepo.updateAiSuggestionStatus(suggestionId, {
					status: body.status,
					actor_user_id: context.user.id,
					team_id: context.teamId,
					resolution_note:
						typeof body.resolutionNote === "string" ? body.resolutionNote : null,
				});

				return NextResponse.json(suggestion);
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				if (String(error.message ?? "").includes("not found")) {
					return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
				}
				console.error("[api] Error en PATCH /api/crm/suggestions/[suggestionId]:", error);
				return NextResponse.json(
					{ error: "Internal Server Error", message: error.message },
					{ status: 500 },
				);
			}
		},
	};
}

const routes = createSuggestionDetailRoute({
	requireAgent: (req) => requireRequestRole(req, authDeps, "agent"),
	crmRepo,
});

export const PATCH = routes.PATCH;
