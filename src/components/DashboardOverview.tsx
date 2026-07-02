import React from "react";
import {
	MessagesIcon,
	ZapIcon,
	UserIcon,
	HourglassIcon,
	RobotIcon,
	TargetIcon,
	TrendingUpIcon,
	TrendingDownIcon
} from "./Icons.tsx";
import type { ConversationListRow } from "../lib/db.ts";

interface DashboardOverviewProps {
	conversations?: ConversationListRow[];
}

const EMPTY_CONVOS: ConversationListRow[] = [];
const shortTimeFormatter = new Intl.DateTimeFormat("es-AR", { timeStyle: "short" });
const leadLabels = [
	{ key: "frio", label: "Fríos" },
	{ key: "neutro", label: "Neutros" },
	{ key: "caliente", label: "Calientes" },
	{ key: "cliente_potencial", label: "Potenciales" },
] as const;

export default function DashboardOverview({ conversations = EMPTY_CONVOS }: DashboardOverviewProps) {
	// 1. Conversaciones Activas
	const activeCount = conversations.length;

	// 2. Porcentaje de modo IA
	const aiConversations = conversations.filter((c) => c.mode === "AI").length;
	const aiRate = activeCount > 0 ? Math.round((aiConversations / activeCount) * 100) : 0;

	// 3. Soporte Humano (chats en modo MANUAL)
	const humanCount = conversations.filter((c) => c.mode === "HUMAN").length;

	// 4. Respuestas Pendientes (último mensaje de un usuario)
	const pendingCount = conversations.filter((c) => c.last_message_role === "user").length;

	// 5. Actividad en Vivo real
	const sortedForActivity = [...conversations]
		.filter((c) => c.last_message_at)
		.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime())
		.slice(0, 5);
	const leadCounts = leadLabels.map((item) => ({
		...item,
		count: conversations.filter((conversation) =>
			conversation.lead_labels?.includes(item.key),
		).length,
	}));
	const maxLeadCount = Math.max(1, ...leadCounts.map((item) => item.count));
	const scoredLeads = conversations.filter(
		(conversation) => typeof conversation.lead_score === "number",
	);
	const averageLeadScore =
		scoredLeads.length > 0
			? Math.round(
				scoredLeads.reduce(
					(total, conversation) => total + (conversation.lead_score ?? 0),
					0,
				) / scoredLeads.length,
			)
			: 0;
	const scoreBuckets = [
		{
			label: "0-39",
			count: scoredLeads.filter((conversation) => (conversation.lead_score ?? 0) <= 39).length,
		},
		{
			label: "40-69",
			count: scoredLeads.filter(
				(conversation) =>
					(conversation.lead_score ?? 0) >= 40 &&
					(conversation.lead_score ?? 0) <= 69,
			).length,
		},
		{
			label: "70-100",
			count: scoredLeads.filter((conversation) => (conversation.lead_score ?? 0) >= 70).length,
		},
	];
	const maxScoreBucket = Math.max(1, ...scoreBuckets.map((bucket) => bucket.count));

	return (
		<div className="flex-1 overflow-y-auto pr-1">
			<div className="max-w-[1440px] mx-auto space-y-6">
				
				{/* KPI Bento Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
					
					{/* KPI 1: Active Conversations */}
					<div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
						<div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
						<div className="flex justify-between items-start mb-4">
							<span className="font-display text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Conversaciones Activas</span>
							<MessagesIcon className="text-primary" size={18} />
						</div>
						<div>
							<div className="font-display text-4xl font-bold text-on-surface mb-2">{activeCount}</div>
							<div className="flex items-center gap-2">
								<span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-semibold">
									<TrendingUpIcon size={12} /> Real
								</span>
								<span className="text-xs text-on-surface-variant">chats en CRM</span>
							</div>
						</div>
						
						{/* Sparkline */}
						<div className="mt-4 h-8 flex items-end gap-1 opacity-60">
							<div className="w-full bg-primary/20 rounded-t-sm h-1/4"></div>
							<div className="w-full bg-primary/40 rounded-t-sm h-2/4"></div>
							<div className="w-full bg-primary/30 rounded-t-sm h-1/3"></div>
							<div className="w-full bg-primary/60 rounded-t-sm h-3/4"></div>
							<div className="w-full bg-primary/50 rounded-t-sm h-2/3"></div>
							<div className="w-full bg-primary rounded-t-sm h-full glow-active"></div>
						</div>
					</div>

					{/* KPI 2: AI Resolution Rate */}
					<div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
						<div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
						<div className="flex justify-between items-start mb-4">
							<span className="font-display text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Resolución de IA</span>
							<ZapIcon className="text-primary" size={18} />
						</div>
						<div>
							<div className="font-display text-4xl font-bold text-on-surface mb-2">{aiRate}%</div>
							<div className="flex items-center gap-2">
								<span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-semibold">
									<TrendingUpIcon size={12} /> Activo
								</span>
								<span className="text-xs text-on-surface-variant">tasa de autogestión</span>
							</div>
						</div>
						
						{/* Sparkline */}
						<div className="mt-4 h-8 flex items-end gap-1 opacity-60">
							<div className="w-full bg-primary/50 rounded-t-sm h-2/3"></div>
							<div className="w-full bg-primary/60 rounded-t-sm h-3/4"></div>
							<div className="w-full bg-primary/70 rounded-t-sm h-4/5"></div>
							<div className="w-full bg-primary/60 rounded-t-sm h-3/4"></div>
							<div className="w-full bg-primary/80 rounded-t-sm h-5/6"></div>
							<div className="w-full bg-primary rounded-t-sm h-full glow-active"></div>
						</div>
					</div>

					{/* KPI 3: Human Assisted */}
					<div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-secondary/40 transition-all duration-300">
						<div className="flex justify-between items-start mb-4">
							<span className="font-display text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Soporte Humano</span>
							<UserIcon className="text-secondary" size={18} />
						</div>
						<div>
							<div className="font-display text-4xl font-bold text-on-surface mb-2">{humanCount}</div>
							<div className="flex items-center gap-2">
								<span className="flex items-center gap-1 text-secondary bg-secondary/10 px-2 py-0.5 rounded text-xs font-semibold">
									<TrendingDownIcon size={12} /> Manual
								</span>
								<span className="text-xs text-on-surface-variant">chats transferidos</span>
							</div>
						</div>
						
						{/* Sparkline */}
						<div className="mt-4 h-8 flex items-end gap-1 opacity-60">
							<div className="w-full bg-secondary/80 rounded-t-sm h-5/6"></div>
							<div className="w-full bg-secondary/70 rounded-t-sm h-4/5"></div>
							<div className="w-full bg-secondary/50 rounded-t-sm h-2/3"></div>
							<div className="w-full bg-secondary/60 rounded-t-sm h-3/4"></div>
							<div className="w-full bg-secondary/40 rounded-t-sm h-1/2"></div>
							<div className="w-full bg-secondary rounded-t-sm h-1/3"></div>
						</div>
					</div>

					{/* KPI 4: Pending Responses */}
					<div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-error/40 transition-all duration-300">
						<div className="flex justify-between items-start mb-4">
							<span className="font-display text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Respuestas Pendientes</span>
							<HourglassIcon className="text-error" size={18} />
						</div>
						<div>
							<div className="font-display text-4xl font-bold text-on-surface mb-2">{pendingCount}</div>
							<div className="flex items-center gap-2">
								<span className="flex items-center gap-1 text-error bg-error/10 px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">
									<HourglassIcon size={10} /> Requiere Acción
								</span>
							</div>
						</div>
						
						{/* Sparkline */}
						<div className="mt-4 h-8 flex items-end gap-1 opacity-60">
							<div className="w-full bg-error/20 rounded-t-sm h-1/4"></div>
							<div className="w-full bg-error/30 rounded-t-sm h-1/3"></div>
							<div className="w-full bg-error/40 rounded-t-sm h-1/2"></div>
							<div className="w-full bg-error/20 rounded-t-sm h-1/4"></div>
							<div className="w-full bg-error/60 rounded-t-sm h-2/3"></div>
							<div className="w-full bg-error rounded-t-sm h-full shadow-[0_0_10px_rgba(255,180,171,0.2)]"></div>
						</div>
					</div>
				</div>

				{/* Lower Section Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					
					{/* Activity Timeline */}
					<div className="glass-panel rounded-2xl p-0 flex flex-col lg:col-span-1">
						<div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30 rounded-t-2xl">
							<h2 className="font-display text-sm font-bold text-on-surface">Actividad en Vivo</h2>
							<button type="button" className="text-primary text-xs hover:underline font-semibold">Ver Todo</button>
						</div>
						<div className="p-6 flex-1 overflow-y-auto space-y-6 max-h-[360px]">
							{sortedForActivity.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant/60 py-8">
									<p className="text-xs">Sin actividad registrada en los chats reales.</p>
								</div>
							) : (
								sortedForActivity.map((convo, idx) => {
									const isLastUser = convo.last_message_role === "user";
									const isLastAssistant = convo.last_message_role === "assistant";
									const isLastHuman = convo.last_message_role === "human";
									
									let itemTitle = "Mensaje en el chat";
									let iconColorClass = "bg-surface-variant/10 border-outline-variant/20 text-on-surface-variant";
									let Icon = TargetIcon;

									if (isLastAssistant) {
										itemTitle = "IA respondió a cliente";
										iconColorClass = "bg-primary/10 border-primary/20 text-primary glow-active";
										Icon = RobotIcon;
									} else if (isLastHuman) {
										itemTitle = "Agente intervino chat";
										iconColorClass = "bg-secondary/10 border-secondary/20 text-secondary";
										Icon = UserIcon;
									} else if (isLastUser) {
										itemTitle = "Cliente envió mensaje";
										iconColorClass = "bg-tertiary-container/10 border-tertiary-container/20 text-tertiary-container";
										Icon = TargetIcon;
									}

									const nameOrPhone = convo.name?.trim() || `+${convo.phone}`;
									const timeStr = convo.last_message_at 
										? shortTimeFormatter.format(new Date(convo.last_message_at))
										: "";

									return (
										<div key={convo.id} className="flex gap-4 relative">
											{idx < sortedForActivity.length - 1 && (
												<div className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-outline-variant/20"></div>
											)}
											<div className={`size-8 rounded-full border flex items-center justify-center shrink-0 z-10 ${iconColorClass}`}>
												<Icon size={14} />
											</div>
											<div className="min-w-0 flex-1">
												<div className="text-xs text-on-surface font-semibold mb-1 flex justify-between items-center gap-2">
													<span className="truncate">{itemTitle} ({nameOrPhone})</span>
													<span className="text-[10px] text-on-surface-variant/60 shrink-0 font-mono">{timeStr}</span>
												</div>
												<div className="text-xs text-on-surface-variant truncate">
													{convo.last_message_content || "Sin mensajes todavía"}
												</div>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>

					{/* AI Performance Panel */}
					<div className="glass-panel rounded-2xl p-0 flex flex-col lg:col-span-2">
						<div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30 rounded-t-2xl">
							<h2 className="font-display text-sm font-bold text-on-surface">Métricas de Rendimiento de IA</h2>
							<div className="flex items-center gap-4">
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-primary"></span>
									<span className="text-xs text-on-surface-variant font-medium">Volumen</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="size-2 rounded-full bg-secondary"></span>
									<span className="text-xs text-on-surface-variant font-medium">Precisión</span>
								</div>
							</div>
						</div>
						<div className="p-6 flex-1 min-h-[280px]">
							<div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
								<div className="flex flex-col gap-4">
									<div>
										<p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
											Etiquetas asignadas
										</p>
										<p className="mt-1 text-xs text-on-surface-variant">
											Distribución actual de clasificación comercial del bot y ajustes manuales.
										</p>
									</div>
									<div className="flex flex-1 flex-col justify-end gap-3">
										{leadCounts.map((item) => (
											<div key={item.key} className="grid grid-cols-[110px_1fr_32px] items-center gap-3">
												<span className="text-[11px] font-bold text-on-surface">{item.label}</span>
												<div className="h-7 overflow-hidden rounded-full border border-outline-variant/35 bg-surface-container-lowest">
													<div
														className="h-full rounded-full bg-primary/80 transition-all"
														style={{ width: `${(item.count / maxLeadCount) * 100}%` }}
													/>
												</div>
												<span className="text-right font-mono text-xs font-bold text-primary">{item.count}</span>
											</div>
										))}
									</div>
								</div>

								<div className="rounded-2xl border border-outline-variant/25 bg-background/50 p-4">
									<div className="mb-4">
										<p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
											Calificación promedio
										</p>
										<div className="mt-2 flex items-end gap-2">
											<span className="font-display text-4xl font-bold text-primary">{averageLeadScore}</span>
											<span className="pb-1 text-xs text-on-surface-variant">/100</span>
										</div>
									</div>
									<div className="flex h-32 items-end gap-3">
										{scoreBuckets.map((bucket) => (
											<div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
												<div className="flex h-24 w-full items-end rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-2">
													<div
														className="w-full rounded-t-lg bg-secondary"
														style={{ height: `${Math.max(8, (bucket.count / maxScoreBucket) * 100)}%` }}
													/>
												</div>
												<span className="font-mono text-[10px] text-on-surface-variant">{bucket.label}</span>
												<span className="text-[10px] font-bold text-on-surface">{bucket.count}</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
					
				</div>
			</div>
		</div>
	);
}
