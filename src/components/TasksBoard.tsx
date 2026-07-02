"use client";

import { useEffect, useMemo, useState } from "react";
import {
	CalendarClock,
	Check,
	Phone,
	Plus,
	Tag,
	Trash2,
	ChevronDown,
} from "lucide-react";

import { LEAD_LABELS, type LeadLabel } from "@/domain/whatsapp-rules.ts";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConversationListRow } from "@/lib/db.ts";
import type {
	CrmTaskListRow,
	CrmTaskPriority,
	CrmTaskStatus,
	CrmTaskType,
} from "@/lib/crm-tasks.ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COLUMNS: Array<{ status: CrmTaskStatus; title: string; description: string }> = [
	{ status: "pending", title: "Pendientes", description: "Próximas acciones" },
	{ status: "in_progress", title: "En progreso", description: "Ya están en gestión" },
	{ status: "done", title: "Hechas", description: "Cerradas o resueltas" },
];

const TASK_TYPES: Array<{ value: CrmTaskType; label: string }> = [
	{ value: "call_client", label: "Llamar cliente" },
	{ value: "follow_up", label: "Seguimiento" },
	{ value: "evaluate_lead", label: "Evaluar lead" },
	{ value: "set_label", label: "Poner etiqueta" },
	{ value: "custom", label: "Personalizada" },
];

const PRIORITIES: Array<{ value: CrmTaskPriority; label: string }> = [
	{ value: "low", label: "Baja" },
	{ value: "medium", label: "Media" },
	{ value: "high", label: "Alta" },
];

const priorityLabel: Record<CrmTaskPriority, string> = {
	low: "Baja",
	medium: "Media",
	high: "Alta",
};

const typeLabel = Object.fromEntries(
	TASK_TYPES.map((type) => [type.value, type.label]),
) as Record<CrmTaskType, string>;

interface TasksBoardProps {
	conversations: ConversationListRow[];
	onConversationUpdated: (conversation: ConversationListRow) => void;
}

interface AiSuggestionRow {
	id: number;
	conversation_id: number;
	action_type: string;
	payload: Record<string, unknown>;
	confidence: number | null;
	reason: string;
	requires_confirmation: boolean;
	status: "pending" | "approved" | "rejected" | "expired";
}

interface DealRow {
	id: number;
	title: string;
	amount: number | null;
	currency: string;
	stage: "lead" | "contacted" | "proposal_sent" | "won" | "lost";
}

interface PipelineStage {
	count: number;
	amount: number;
	deals: DealRow[];
}

interface PipelineSummary {
	total_count: number;
	total_amount: number;
	stages: Record<DealRow["stage"], PipelineStage>;
}

const DEAL_STAGES: Array<{ key: DealRow["stage"]; label: string }> = [
	{ key: "lead", label: "Lead" },
	{ key: "contacted", label: "Contactado" },
	{ key: "proposal_sent", label: "Propuesta" },
	{ key: "won", label: "Ganado" },
	{ key: "lost", label: "Perdido" },
];

function selectClassName() {
	return "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

function formatDate(value: string | Date | null) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat("es", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function conversationLabel(conversation: ConversationListRow) {
	return conversation.name?.trim() || `+${conversation.phone}`;
}

interface CustomSelectProps<T> {
	value: T;
	onChange: (value: T) => void;
	options: Array<{ value: T; label: string }>;
	placeholder?: string;
	className?: string;
}

function CustomSelect<T extends string | number>({
	value,
	onChange,
	options,
	placeholder = "Seleccionar...",
	className,
}: CustomSelectProps<T>) {
	const selected = options.find((opt) => opt.value === value);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className={cn(
						"w-full justify-between text-left font-normal h-8 px-3 text-xs bg-transparent border-input text-muted-foreground hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50",
						selected && "text-foreground font-medium",
						className,
					)}
				>
					<span className="truncate">{selected ? selected.label : placeholder}</span>
					<ChevronDown className="size-3.5 opacity-50 shrink-0 ml-1" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="max-h-60 overflow-y-auto min-w-[200px] bg-popover border border-border text-popover-foreground shadow-md"
				align="start"
			>
				{options.map((opt) => (
					<DropdownMenuItem
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						className={cn(
							"text-xs cursor-pointer focus:bg-accent focus:text-accent-foreground",
							opt.value === value && "bg-accent/40 text-foreground font-semibold",
						)}
					>
						{opt.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default function TasksBoard({
	conversations,
	onConversationUpdated,
}: TasksBoardProps) {
	const [tasks, setTasks] = useState<CrmTaskListRow[]>([]);
	const [suggestions, setSuggestions] = useState<AiSuggestionRow[]>([]);
	const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [conversationId, setConversationId] = useState("");
	const [taskType, setTaskType] = useState<CrmTaskType>("call_client");
	const [leadLabel, setLeadLabel] = useState<"" | LeadLabel>("");
	const [priority, setPriority] = useState<CrmTaskPriority>("medium");
	const [dueAt, setDueAt] = useState("");
	const [error, setError] = useState<string | null>(null);

	const conversationById = useMemo(
		() => new Map(conversations.map((conversation) => [conversation.id, conversation])),
		[conversations],
	);

	const clientOptions = useMemo(
		() => [
			{ value: "", label: "Sin cliente" },
			...conversations.map((c) => ({ value: String(c.id), label: conversationLabel(c) })),
		],
		[conversations],
	);

	const labelOptions = useMemo<Array<{ value: "" | LeadLabel; label: string }>>(
		() => [
			{ value: "", label: "Sin etiqueta" },
			...LEAD_LABELS.map((l) => ({ value: l, label: l.replace("_", " ") })),
		],
		[],
	);

	const loadTasks = async () => {
		setError(null);
		try {
			const res = await fetch("/api/tasks");
			if (!res.ok) throw new Error("No se pudieron cargar las tareas");
			setTasks(await res.json());
		} catch (loadError: any) {
			setError(loadError.message || "No se pudieron cargar las tareas");
		} finally {
			setIsLoading(false);
		}
	};

	const loadSuggestions = async () => {
		try {
			const res = await fetch("/api/crm/suggestions?status=pending");
			if (!res.ok) throw new Error("No se pudieron cargar las sugerencias IA");
			setSuggestions(await res.json());
		} catch (loadError: any) {
			setError(loadError.message || "No se pudieron cargar las sugerencias IA");
		}
	};

	const loadPipeline = async () => {
		try {
			const res = await fetch("/api/crm/pipeline");
			if (!res.ok) throw new Error("No se pudo cargar el pipeline");
			setPipeline(await res.json());
		} catch (loadError: any) {
			setError(loadError.message || "No se pudo cargar el pipeline");
		}
	};

	useEffect(() => {
		loadTasks();
		loadSuggestions();
		loadPipeline();
	}, []);

	const createTask = async () => {
		setIsSaving(true);
		setError(null);
		try {
			const res = await fetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					description,
					conversation_id: conversationId || null,
					task_type: taskType,
					lead_label: leadLabel || null,
					priority,
					due_at: dueAt || null,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || "No se pudo crear la tarea");
			}
			setTitle("");
			setDescription("");
			setConversationId("");
			setTaskType("call_client");
			setLeadLabel("");
			setPriority("medium");
			setDueAt("");
			await loadTasks();
		} catch (saveError: any) {
			setError(saveError.message || "No se pudo crear la tarea");
		} finally {
			setIsSaving(false);
		}
	};

	const updateTask = async (taskId: number, patch: Record<string, unknown>) => {
		const res = await fetch(`/api/tasks/${taskId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(patch),
		});
		if (!res.ok) throw new Error("No se pudo actualizar la tarea");
		const updated = await res.json();
		setTasks((current) =>
			current.map((task) => (task.id === taskId ? { ...task, ...updated } : task)),
		);
	};

	const deleteTask = async (taskId: number) => {
		const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
		if (!res.ok) throw new Error("No se pudo eliminar la tarea");
		setTasks((current) => current.filter((task) => task.id !== taskId));
	};

	const applyLeadLabel = async (task: CrmTaskListRow) => {
		if (!task.conversation_id || !task.lead_label) return;
		const conversation = conversationById.get(task.conversation_id);
		if (!conversation) return;
		const labels = [...new Set([...conversation.lead_labels, task.lead_label])];
		const res = await fetch(`/api/conversations/${task.conversation_id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lead_labels: labels }),
		});
		if (!res.ok) throw new Error("No se pudo aplicar la etiqueta");
		const updatedConversation = await res.json();
		onConversationUpdated(updatedConversation);
		await updateTask(task.id, { status: "done" });
	};

	const resolveSuggestion = async (
		suggestionId: number,
		status: "approved" | "rejected",
	) => {
		const res = await fetch(`/api/crm/suggestions/${suggestionId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
		if (!res.ok) throw new Error("No se pudo resolver la sugerencia IA");
		setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-8">
			<div className="flex flex-col gap-1">
				<h2 className="font-display text-2xl font-bold text-on-surface">
					Tareas CRM
				</h2>
				<p className="text-sm text-on-surface-variant">
					Organizá llamadas, seguimientos y evaluación de clientes como un tablero Trello.
				</p>
			</div>

			<Card className="shrink-0 border-outline-variant/20 bg-surface-container-low/70">
				<CardHeader>
					<CardTitle>Nueva tarea</CardTitle>
					<CardDescription>
						Creá acciones concretas vinculadas a contactos o conversaciones.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr]">
						<Input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Ej: llamar para cerrar presupuesto"
						/>
						<CustomSelect
							value={conversationId}
							onChange={setConversationId}
							options={clientOptions}
							placeholder="Cliente"
						/>
						<CustomSelect
							value={taskType}
							onChange={setTaskType}
							options={TASK_TYPES}
							placeholder="Tipo de tarea"
						/>
						<CustomSelect
							value={leadLabel}
							onChange={setLeadLabel}
							options={labelOptions}
							placeholder="Etiqueta de evaluación"
						/>
						<Button onClick={createTask} disabled={isSaving || !title.trim()}>
							<Plus data-icon="inline-start" />
							Crear
						</Button>
					</div>
					<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.35fr_0.35fr]">
						<Textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Notas internas para ejecutar la tarea..."
						/>
						<CustomSelect
							value={priority}
							onChange={setPriority}
							options={PRIORITIES}
							placeholder="Prioridad"
						/>
						<Input
							type="datetime-local"
							value={dueAt}
							onChange={(event) => setDueAt(event.target.value)}
						/>
					</div>
					{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				</CardContent>
			</Card>

			<Card className="shrink-0 border-outline-variant/20 bg-surface-container-low/70">
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-2">
						<span>Pipeline comercial</span>
						<Badge variant="secondary">
							{pipeline?.total_count ?? 0} deals · US${Math.round(pipeline?.total_amount ?? 0)}
						</Badge>
					</CardTitle>
					<CardDescription>
						Etapas reales de oportunidad: desde lead hasta ganado o perdido.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 xl:grid-cols-5">
						{DEAL_STAGES.map((stage) => {
							const summary = pipeline?.stages?.[stage.key] ?? {
								count: 0,
								amount: 0,
								deals: [],
							};
							return (
								<div
									key={stage.key}
									className="rounded-xl border border-outline-variant/20 bg-background/40 p-3"
								>
									<div className="mb-3 flex items-center justify-between gap-2">
										<div>
											<p className="text-sm font-semibold text-on-surface">{stage.label}</p>
											<p className="text-xs text-muted-foreground">
												{summary.count} · US${Math.round(summary.amount)}
											</p>
										</div>
										<Badge variant="outline">{summary.count}</Badge>
									</div>
									<div className="space-y-2">
										{summary.deals.slice(0, 3).map((deal) => (
											<div
												key={deal.id}
												className="rounded-lg border border-outline-variant/20 bg-card/70 p-2"
											>
												<p className="truncate text-xs font-semibold">{deal.title}</p>
												<p className="text-[11px] text-muted-foreground">
													{deal.currency} {Number(deal.amount ?? 0).toLocaleString("es")}
												</p>
											</div>
										))}
										{summary.deals.length === 0 && (
											<p className="rounded-lg border border-dashed border-outline-variant/25 p-2 text-xs text-muted-foreground">
												Sin oportunidades.
											</p>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<Card className="shrink-0 border-primary/20 bg-primary/5">
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-2">
						<span>Sugerencias IA para calificar leads</span>
						<Badge variant="secondary">{suggestions.length}</Badge>
					</CardTitle>
					<CardDescription>
						La IA propone acciones; el equipo humano aprueba lo importante.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{suggestions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Sin sugerencias pendientes. Los leads de baja confianza quedan para revisión manual.
						</p>
					) : (
						<div className="grid gap-3 xl:grid-cols-3">
							{suggestions.slice(0, 6).map((suggestion) => (
								<Card key={suggestion.id} size="sm" className="bg-card/90">
									<CardHeader>
										<CardTitle className="text-sm">
											{String(suggestion.payload.title ?? suggestion.action_type)}
										</CardTitle>
										<CardDescription className="flex flex-wrap gap-2">
											<Badge variant="outline">{suggestion.action_type}</Badge>
											<Badge variant={suggestion.requires_confirmation ? "destructive" : "secondary"}>
												{suggestion.requires_confirmation ? "Requiere aprobación" : "Bajo riesgo"}
											</Badge>
											{typeof suggestion.confidence === "number" && (
												<Badge variant="secondary">
													{Math.round(suggestion.confidence * 100)}% confianza
												</Badge>
											)}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<p className="text-sm text-muted-foreground">{suggestion.reason}</p>
										<div className="flex gap-2">
											<Button
												size="sm"
												onClick={() => resolveSuggestion(suggestion.id, "approved")}
											>
												<Check data-icon="inline-start" />
												Aprobar
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => resolveSuggestion(suggestion.id, "rejected")}
											>
												Rechazar
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<div className="grid min-h-[28rem] gap-4 lg:grid-cols-3">
				{COLUMNS.map((column) => {
					const columnTasks = tasks.filter((task) => task.status === column.status);
					return (
						<Card key={column.status} className="min-h-0 border-outline-variant/20 bg-surface-container-low/60">
							<CardHeader>
								<CardTitle className="flex items-center justify-between gap-2">
									<span>{column.title}</span>
									<Badge variant="secondary">{columnTasks.length}</Badge>
								</CardTitle>
								<CardDescription>{column.description}</CardDescription>
							</CardHeader>
							<CardContent className="min-h-0">
								<ScrollArea className="h-[24rem] pr-2">
									<div className="flex flex-col gap-3">
										{isLoading && (
											<p className="text-sm text-muted-foreground">Cargando tareas...</p>
										)}
										{!isLoading && columnTasks.length === 0 && (
											<p className="rounded-lg border border-dashed border-outline-variant/30 p-4 text-sm text-muted-foreground">
												No hay tareas en esta columna.
											</p>
										)}
										{columnTasks.map((task) => (
											<Card key={task.id} size="sm" className="bg-card/90">
												<CardHeader>
													<CardTitle className="text-sm">{task.title}</CardTitle>
													<CardDescription className="flex flex-wrap gap-2">
														<Badge variant="outline">{typeLabel[task.task_type]}</Badge>
														<Badge
															variant={task.priority === "high" ? "destructive" : "secondary"}
														>
															{priorityLabel[task.priority]}
														</Badge>
														{task.lead_label && (
															<Badge variant="outline">
																<Tag data-icon="inline-start" />
																{task.lead_label.replace("_", " ")}
															</Badge>
														)}
													</CardDescription>
												</CardHeader>
												<CardContent className="flex flex-col gap-3">
													{task.description && (
														<p className="text-sm text-muted-foreground">{task.description}</p>
													)}
													<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
														{task.conversation_phone && (
															<span className="inline-flex items-center gap-1">
																<Phone className="size-3" />
																{task.conversation_name || `+${task.conversation_phone}`}
															</span>
														)}
														{formatDate(task.due_at) && (
															<span className="inline-flex items-center gap-1">
																<CalendarClock className="size-3" />
																{formatDate(task.due_at)}
															</span>
														)}
													</div>
													<div className="flex flex-wrap gap-2">
														{COLUMNS.filter((item) => item.status !== task.status).map((item) => (
															<Button
																key={item.status}
																size="sm"
																variant="outline"
																onClick={() => updateTask(task.id, { status: item.status })}
															>
																{item.title}
															</Button>
														))}
														{task.lead_label && task.conversation_id && task.status !== "done" && (
															<Button
																size="sm"
																variant="secondary"
																onClick={() => applyLeadLabel(task)}
															>
																<Check data-icon="inline-start" />
																Aplicar etiqueta
															</Button>
														)}
														<Button
															size="sm"
															variant="ghost"
															className={cn("ml-auto")}
															onClick={() => deleteTask(task.id)}
															aria-label="Eliminar tarea"
														>
															<Trash2 data-icon="inline-start" />
														</Button>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</ScrollArea>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
