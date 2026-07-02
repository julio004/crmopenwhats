import { NextResponse } from "next/server";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeCrmRepository as crmRepo } from "@/lib/repositories/runtime-crm";

export function createContact360Route(deps: {
	requireViewer: (req: Request) => Promise<any>;
	crmRepo: any;
}) {
	return {
		async GET(
			req: Request,
			{ params }: { params: Promise<{ contactId: string }> | { contactId: string } },
		) {
			try {
				await deps.requireViewer(req);
				const resolvedParams = await params;
				const contactId = Number(resolvedParams.contactId);
				if (!Number.isInteger(contactId) || contactId <= 0) {
					return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
				}

				const profile = await deps.crmRepo.getContact360(contactId);
				if (!profile) {
					return NextResponse.json({ error: "Contact not found" }, { status: 404 });
				}
				return NextResponse.json(profile);
			} catch (error: any) {
				const authResponse = authErrorToResponse(error);
				if (authResponse) return authResponse;
				console.error("[api] Error en GET /api/crm/contacts/[contactId]:", error);
				return NextResponse.json(
					{ error: "Internal Server Error", message: error.message },
					{ status: 500 },
				);
			}
		},
	};
}

const routes = createContact360Route({
	requireViewer: (req) => requireRequestRole(req, authDeps, "viewer"),
	crmRepo,
});

export const GET = routes.GET;
