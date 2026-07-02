import { NextResponse } from "next/server";
import { deleteConversation, getConversationById, updateConversation } from "../../../../lib/db.ts";
import { normalizeLeadLabels } from "../../../../domain/whatsapp-rules.ts";
import { authErrorToResponse, requireRequestRole } from "@/lib/auth/session";
import { runtimeSessionDeps as authDeps } from "@/lib/auth/runtime";
import { runtimeConversationViewService } from "@/lib/services/conversation-view";
import type { CrmRepository } from "@/lib/repositories/crm-repository";
import { runtimeCrmRepository } from "@/lib/repositories/runtime-crm";

interface Ctx {
	params: Promise<{ conversationId: string }>;
}

function mergePatchedConversationResponse(updatedBase: any, updatedView: any) {
	if (!updatedView) return updatedBase;
	return {
		...updatedView,
		name: updatedBase?.name ?? updatedView.name,
	};
}

export function createConversationPatchRoute(deps: {
	requireAgent: (req: Request) => Promise<unknown>;
	getConversationById: (conversationId: number) => Promise<any>;
	updateConversation: (conversationId: number, patch: Record<string, unknown>) => Promise<any>;
	getConversationViewById: (conversationId: number) => Promise<unknown | null>;
	crmRepo?: CrmRepository;
}) {
	return async function PATCH(req: Request, { params }: Ctx) {
		try {
			await deps.requireAgent(req);
			const { conversationId } = await params;
			const parsedId = Number.parseInt(conversationId, 10);

			if (Number.isNaN(parsedId)) {
				return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
			}

			const body = await req.json().catch(() => ({}));
			const patch: any = {};

			if (typeof body.name === "string") {
				const rawName = body.name.trim();
				patch.name = rawName.length > 0 ? rawName.slice(0, 120) : null;
			}
			if (typeof body.is_archived === "boolean") {
				patch.is_archived = body.is_archived;
			}
			if (Array.isArray(body.lead_labels)) {
				patch.lead_labels = normalizeLeadLabels(body.lead_labels);
				patch.lead_updated_by = "dashboard";
				patch.lead_updated_at = new Date();
			}
			if (
				body.lead_score === null ||
				(typeof body.lead_score === "number" &&
					Number.isFinite(body.lead_score) &&
					body.lead_score >= 0 &&
					body.lead_score <= 100)
			) {
				patch.lead_score =
					body.lead_score === null ? null : Math.round(body.lead_score);
				patch.lead_updated_by = "dashboard";
				patch.lead_updated_at = new Date();
			}
			if (typeof body.lead_score_reason === "string") {
				patch.lead_score_reason =
					body.lead_score_reason.trim().slice(0, 240) || null;
				patch.lead_updated_by = "dashboard";
				patch.lead_updated_at = new Date();
			}

			const existing = await deps.getConversationById(parsedId);
			if (!existing) {
				return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
			}

			if (deps.crmRepo && typeof body.name === "string" && body.name.trim().length > 0) {
				const link = await deps.crmRepo.getConversationCrmLink(parsedId);
				if (!link) {
					const contact = await deps.crmRepo.createContact({
						display_name: body.name.trim(),
					});
					if (existing.phone) {
						await deps.crmRepo.addContactMethod({
							contact_id: contact.id,
							method_type: "whatsapp_phone",
							value: existing.phone,
							normalized_value: existing.phone,
							is_primary: true,
						});
					}
					if (existing.jid) {
						await deps.crmRepo.addContactMethod({
							contact_id: contact.id,
							method_type: "whatsapp_jid",
							value: existing.jid,
							normalized_value: existing.jid,
							is_primary: false,
						});
					}
					await deps.crmRepo.setConversationCrmLink({
						conversation_id: parsedId,
						contact_id: contact.id,
					});
				} else if (link.contact_id) {
					await deps.crmRepo.updateContact(link.contact_id, {
						display_name: body.name.trim(),
					});
				}
			}

			const updatedBase = await deps.updateConversation(parsedId, patch);
			const updated = await deps.getConversationViewById(parsedId);
			return NextResponse.json(mergePatchedConversationResponse(updatedBase, updated));
		} catch (error: any) {
			const authResponse = authErrorToResponse(error);
			if (authResponse) return authResponse;
			console.error("[api] Error en PATCH /api/conversations/[conversationId]:", error);
			return NextResponse.json(
				{ error: "Internal Server Error", message: error.message },
				{ status: 500 },
			);
		}
	};
}

export async function DELETE(_req: Request, { params }: Ctx) {
	try {
		await requireRequestRole(_req, authDeps, "agent");
		const { conversationId } = await params;
		const parsedId = Number.parseInt(conversationId, 10);
		
		if (Number.isNaN(parsedId)) {
			return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
		}

		await deleteConversation(parsedId);
		return NextResponse.json({ ok: true, message: "Conversation deleted successfully." });
	} catch (error: any) {
		const authResponse = authErrorToResponse(error);
		if (authResponse) return authResponse;
		console.error("[api] Error en DELETE /api/conversations/[conversationId]:", error);
		return NextResponse.json(
			{ error: "Internal Server Error", message: error.message },
			{ status: 500 }
		);
	}
}

export const PATCH = createConversationPatchRoute({
	requireAgent: (req) => requireRequestRole(req, authDeps, "agent"),
	getConversationById,
	updateConversation,
	getConversationViewById: (conversationId) =>
		runtimeConversationViewService.getConversationById(conversationId),
	crmRepo: runtimeCrmRepository,
});
