import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";

export function createDealsRoute(deps: {
	requireViewer: (req: Request) => Promise<any>;
	requireAgent: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async GET(req: Request) {
			try {
				await deps.requireViewer(req);
				const { searchParams } = new URL(req.url);
				const contactId = searchParams.get("contactId") ? Number(searchParams.get("contactId")) : undefined;
				const accountId = searchParams.get("accountId") ? Number(searchParams.get("accountId")) : undefined;

				if (!contactId && !accountId) {
					return NextResponse.json({ error: "contactId or accountId is required" }, { status: 400 });
				}

				let deals = [];
				if (contactId) {
					deals = await deps.crmRepo.listDealsByContactId(contactId);
				} else if (accountId) {
					deals = await deps.crmRepo.listDealsByAccountId(accountId);
				}
				return NextResponse.json(deals);
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error("[api] Error en GET /api/crm/deals:", error);
				return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
			}
		},

		async POST(req: Request) {
			try {
				const context = await deps.requireAgent(req);
				const body = await req.json().catch(() => ({}));

				if (!body.title || (!body.contactId && !body.accountId)) {
					return NextResponse.json({ error: "Title and contactId or accountId are required" }, { status: 400 });
				}

				const deal = await deps.crmRepo.createDeal({
					team_id: context.teamId,
					title: body.title.trim(),
					description: body.description ?? null,
					amount: body.amount !== undefined && body.amount !== null ? Number(body.amount) : null,
					currency: body.currency ?? "USD",
					stage: body.stage ?? "lead",
					contact_id: body.contactId ?? null,
					account_id: body.accountId ?? null,
					owner_user_id: context.user.id,
					expected_close_date: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
					actor_user_id: context.user.id,
				});

				return NextResponse.json(deal, { status: 201 });
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error("[api] Error en POST /api/crm/deals:", error);
				return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
			}
		}
	};
}

const routes = createDealsRoute({
	requireViewer: (req) => requireRequestRole(req, authDeps, "viewer"),
	requireAgent: (req) => requireRequestRole(req, authDeps, "agent"),
	crmRepo,
});

export const GET = routes.GET;
export const POST = routes.POST;
