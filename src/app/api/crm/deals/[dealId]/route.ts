import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";

export function createDealDetailRoute(deps: {
	requireAgent: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async PATCH(req: Request, { params }: { params: Promise<{ dealId: string }> | { dealId: string } }) {
			try {
				const context = await deps.requireAgent(req);
				const resolvedParams = await params;
				const dealId = Number(resolvedParams.dealId);

				if (Number.isNaN(dealId)) {
					return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
				}

				const body = await req.json().catch(() => ({}));

				const updated = await deps.crmRepo.updateDeal(dealId, {
					title: body.title,
					description: body.description,
					amount: body.amount !== undefined && body.amount !== null ? Number(body.amount) : undefined,
					currency: body.currency,
					stage: body.stage,
					contact_id: body.contactId,
					account_id: body.accountId,
					expected_close_date: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
					actor_user_id: context.user.id,
					team_id: context.teamId,
				});

				return NextResponse.json(updated);
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error(`[api] Error en PATCH /api/crm/deals:`, error);
				return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
			}
		},

		async DELETE(req: Request, { params }: { params: Promise<{ dealId: string }> | { dealId: string } }) {
			try {
				const context = await deps.requireAgent(req);
				const resolvedParams = await params;
				const dealId = Number(resolvedParams.dealId);

				if (Number.isNaN(dealId)) {
					return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
				}

				const success = await deps.crmRepo.deleteDeal(dealId, {
					actor_user_id: context.user.id,
					team_id: context.teamId,
				});

				if (!success) {
					return NextResponse.json({ error: "Deal not found" }, { status: 404 });
				}

				return NextResponse.json({ ok: true });
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error(`[api] Error en DELETE /api/crm/deals:`, error);
				return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
			}
		}
	};
}

const routes = createDealDetailRoute({
	requireAgent: (req) => requireRequestRole(req, authDeps, "agent"),
	crmRepo,
});

export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
