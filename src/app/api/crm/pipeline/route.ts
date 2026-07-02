import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";
import type { CrmDealRow } from "@/lib/db-contract";

const STAGES = ["lead", "contacted", "proposal_sent", "won", "lost"] as const;
const STAGE_SET = new Set<string>(STAGES);

function amountOf(deal: CrmDealRow) {
	return typeof deal.amount === "number" ? deal.amount : Number(deal.amount ?? 0);
}

export function buildPipeline(deals: CrmDealRow[]) {
	const stages = Object.fromEntries(
		STAGES.map((stage) => [
			stage,
			{
				count: 0,
				amount: 0,
				deals: [] as CrmDealRow[],
			},
		]),
	) as Record<(typeof STAGES)[number], { count: number; amount: number; deals: CrmDealRow[] }>;

	for (const deal of deals) {
		const stage = STAGE_SET.has(deal.stage) ? deal.stage : "lead";
		stages[stage].count += 1;
		stages[stage].amount += amountOf(deal);
		stages[stage].deals.push(deal);
	}

	return {
		total_count: deals.length,
		total_amount: deals.reduce((total, deal) => total + amountOf(deal), 0),
		stages,
	};
}

export function createPipelineRoute(deps: {
	requireViewer: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async GET(req: Request) {
			try {
				await deps.requireViewer(req);
				const deals = await deps.crmRepo.listDealsPipeline();
				return NextResponse.json(buildPipeline(deals));
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error("[api] Error en GET /api/crm/pipeline:", error);
				return NextResponse.json(
					{ error: "Internal Server Error", message: error.message },
					{ status: 500 },
				);
			}
		},
	};
}

const routes = createPipelineRoute({
	requireViewer: (req) => requireRequestRole(req, authDeps, "viewer"),
	crmRepo,
});

export const GET = routes.GET;
