import Image from "next/image";
import { useMemo, useState } from "react";
import { RobotIcon, UserIcon } from "./Icons.tsx";
import type { ConversationListRow } from "../lib/db.ts";

interface ContactsOverviewProps {
	conversations: ConversationListRow[];
}

const lastInteractionFormatter = new Intl.DateTimeFormat("es-AR", {
	dateStyle: "medium",
	timeStyle: "short",
});

function formatLastInteraction(
	value: Date | string | null | undefined,
): string {
	if (!value) return "Sin mensajes";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Sin fecha válida";
	return lastInteractionFormatter.format(date);
}

function contactDisplayName(conversation: ConversationListRow) {
	return conversation.contact_name ?? conversation.name ?? "Sin nombre";
}

function contactDisplayPhone(conversation: ConversationListRow) {
	return conversation.contact_phone ?? conversation.phone;
}

function contactDisplayJid(conversation: ConversationListRow) {
	return conversation.contact_jid ?? conversation.jid;
}

export default function ContactsOverview({
	conversations,
}: ContactsOverviewProps) {
	const [query, setQuery] = useState("");
	const [modeFilter, setModeFilter] = useState<"ALL" | "AI" | "HUMAN">("ALL");
	const [zoomImage, setZoomImage] = useState<string | null>(null);
	const [failedAvatarUrls, setFailedAvatarUrls] = useState<Set<string>>(new Set());

	const handleAvatarError = (url: string) => {
		setFailedAvatarUrls((prev) => {
			const next = new Set(prev);
			next.add(url);
			return next;
		});
	};

	const contacts = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return conversations.filter((conversation) => {
			const matchesMode =
				modeFilter === "ALL" || conversation.mode === modeFilter;
			const haystack =
				`${contactDisplayName(conversation)} ${contactDisplayPhone(conversation)} ${contactDisplayJid(conversation) ?? ""} ${conversation.account_name ?? ""}`.toLocaleLowerCase();
			return matchesMode && (!normalized || haystack.includes(normalized));
		});
	}, [conversations, modeFilter, query]);

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			<div className="flex justify-between items-center mb-6 shrink-0">
				<div>
					<h2 className="font-display text-lg font-bold text-on-surface">
						Gestión de Contactos CRM
					</h2>
					<p className="text-xs text-on-surface-variant mt-1">
						Contactos persistidos desde conversaciones reales de WhatsApp.
					</p>
				</div>
				<div className="text-xs text-on-surface-variant">
					<strong className="text-primary font-semibold">
						{contacts.length}
					</strong>{" "}
					contactos reales
				</div>
			</div>

			<div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
				<div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low/70 flex justify-between items-center shrink-0">
					<div className="flex items-center gap-4">
						<input
							type="text"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Buscar por nombre o teléfono..."
							aria-label="Buscar contactos"
							className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all w-64 placeholder-on-surface-variant/60 text-on-surface"
						/>
						<select
							value={modeFilter}
							onChange={(event) =>
								setModeFilter(event.target.value as "ALL" | "AI" | "HUMAN")
							}
							aria-label="Filtrar por modo de chat"
							className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
						>
							<option value="ALL">Todos los modos</option>
							<option value="AI">AI</option>
							<option value="HUMAN">HUMAN</option>
						</select>
					</div>
					<div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
						Fuente: /api/conversations
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{contacts.length === 0 ? (
						<div className="h-full flex flex-col items-center justify-center text-center p-8 text-on-surface-variant">
							<h3 className="font-display text-sm font-bold text-on-surface mb-1">
								Sin contactos persistidos
							</h3>
							<p className="text-xs max-w-sm">
								Cuando entren conversaciones reales, van a aparecer acá sin
								datos ficticios ni etiquetas inventadas.
							</p>
						</div>
					) : (
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-outline-variant/20 text-on-surface-variant text-[10px] font-bold uppercase tracking-wider bg-surface-container-lowest/60">
									<th className="px-6 py-4">Contacto</th>
									<th className="px-6 py-4">Teléfono</th>
									<th className="px-6 py-4">JID</th>
									<th className="px-6 py-4">Modo Bot</th>
									<th className="px-6 py-4">Último mensaje</th>
									<th className="px-6 py-4">Última charla</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/10 text-xs">
								{contacts.map((contact) => (
									<tr
										key={contact.id}
										className="hover:bg-surface-container-low/50 transition-colors"
									>
										<td className="px-6 py-4 font-semibold text-on-surface flex items-center gap-3">
											{contact.profile_picture_url && !failedAvatarUrls.has(contact.profile_picture_url) ? (
												<Image
													src={contact.profile_picture_url}
													alt={contactDisplayName(contact)}
													width={32}
													height={32}
													className="size-8 rounded-full object-cover border border-primary/30 shrink-0 cursor-pointer hover:scale-105 hover:brightness-95 transition-all"
													onClick={() => setZoomImage(contact.profile_picture_url)}
													onError={() => contact.profile_picture_url && handleAvatarError(contact.profile_picture_url)}
													title="Ver imagen en grande"
												/>
											) : (
												<div className="size-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-display text-primary text-xs font-bold shrink-0">
													{contactDisplayName(contact)
														.charAt(0)
														.toLocaleUpperCase()}
												</div>
											)}
											<div>
												<div>{contactDisplayName(contact)}</div>
												{contact.account_name ? (
													<div className="text-[10px] font-normal text-on-surface-variant">
														{contact.account_name}
													</div>
												) : null}
											</div>
										</td>
										<td className="px-6 py-4 text-on-surface-variant font-mono">
											{contactDisplayPhone(contact)}
										</td>
										<td className="px-6 py-4 text-on-surface-variant/80 font-mono max-w-[220px] truncate">
											{contactDisplayJid(contact) ?? "—"}
										</td>
										<td className="px-6 py-4">
											<span
												className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 w-fit ${
													contact.mode === "AI"
														? "bg-primary/15 border border-primary/30 text-primary"
														: "bg-secondary/15 border border-secondary/30 text-secondary"
												}`}
											>
												{contact.mode === "AI" ? (
													<RobotIcon size={12} />
												) : (
													<UserIcon size={12} />
												)}
												{contact.mode}
											</span>
										</td>
										<td className="px-6 py-4 text-on-surface-variant/90 max-w-xs truncate">
											{contact.last_message_content ?? "Sin mensajes"}
										</td>
										<td className="px-6 py-4 text-on-surface-variant/80">
											{formatLastInteraction(contact.last_message_at)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{zoomImage && (
				<div 
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-opacity duration-300"
					onClick={() => setZoomImage(null)}
				>
					<div 
						className="relative size-[90vw] max-w-[480px] max-h-[480px] p-1.5 bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center animate-[scaleIn_0.2s_ease-out]"
						onClick={(e) => e.stopPropagation()}
					>
						<Image 
							src={zoomImage} 
							alt="Contacto foto" 
							fill
							className="size-full object-cover rounded-2xl animate-fade-in"
						/>
						<button 
							type="button"
							className="absolute top-4 right-4 size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white font-display text-xl font-bold focus:outline-none transition-all duration-200 hover:scale-105 active:scale-95 shadow-md"
							onClick={() => setZoomImage(null)}
							aria-label="Cerrar zoom de imagen"
						>
							×
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
