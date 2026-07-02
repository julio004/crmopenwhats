"use client";

import {
	Bot,
	Brain,
	Briefcase,
	CheckCircle2,
	FileText,
	Headphones,
	MessageSquareText,
	ShieldCheck,
	SquareKanban,
	UserCircle,
	Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const sections = [
	{
		title: "1. Bandeja de conversaciones",
		icon: MessageSquareText,
		items: [
			"Entrá a Conversaciones para ver los chats reales de WhatsApp ordenados por actividad reciente.",
			"El contacto seleccionado queda fijo arriba para que no se pierda mientras llegan mensajes nuevos.",
			"Usá Archivar para sacar conversaciones resueltas del frente sin borrar historial.",
		],
	},
	{
		title: "2. Modos IA y Humano",
		icon: Bot,
		items: [
			"Modo IA: el bot responde automáticamente con el prompt activo y las reglas configuradas.",
			"Modo Humano: la IA deja de responder y el equipo toma la conversación manualmente.",
			"El switch del chat persiste el modo en servidor; no es visual ni temporal.",
		],
	},
	{
		title: "3. Perfil del cliente",
		icon: UserCircle,
		items: [
			"Hacé click en el nombre o avatar del cliente para abrir su ficha sin tapar el chat.",
			"Guardá nombre comercial, etiquetas de lead, score y motivo de calificación.",
			"Desde la ficha podés crear y mover oportunidades comerciales vinculadas al contacto.",
		],
	},
	{
		title: "4. Deals y pipeline comercial",
		icon: Briefcase,
		items: [
			"Deals muestra oportunidades por etapa: Lead, Contactado, Propuesta, Ganado y Perdido.",
			"El tablero resume cantidad y monto total para medir avance comercial.",
			"Cada oportunidad puede moverse de etapa desde el perfil del cliente.",
		],
	},
	{
		title: "5. Tareas CRM",
		icon: SquareKanban,
		items: [
			"Creá llamadas, seguimientos, evaluaciones o tareas personalizadas.",
			"Asigná cliente, etiqueta, prioridad y fecha para convertir conversaciones en acciones.",
			"Mové tareas entre Pendientes, En progreso y Hechas para operar como tablero Kanban.",
		],
	},
	{
		title: "6. Sugerencias IA",
		icon: Brain,
		items: [
			"La IA califica señales del cliente y propone acciones CRM.",
			"Las acciones importantes requieren aprobación humana antes de afectar el CRM.",
			"Usá Aprobar o Rechazar para mantener control humano sobre decisiones comerciales.",
		],
	},
	{
		title: "7. Prompts y respuestas rápidas",
		icon: FileText,
		items: [
			"AI Prompts define cómo habla, califica y decide la IA.",
			"Las respuestas rápidas se gestionan desde el perfil de WhatsApp del header.",
			"En modo humano escribí / en el input para insertar una respuesta rápida.",
		],
	},
	{
		title: "8. Automatizaciones seguras",
		icon: Workflow,
		items: [
			"Automatizaciones usa bloques predefinidos; no ejecuta SQL libre ni acciones peligrosas.",
			"Creá flujos simples para mensajes entrantes, etiquetas y respuestas operativas.",
			"Mantené reglas cortas, medibles y revisables por el equipo.",
		],
	},
	{
		title: "9. Audio, imágenes y adjuntos",
		icon: Headphones,
		items: [
			"El cliente puede enviar audio; la IA puede usar esa transcripción para entenderlo.",
			"Los audios del dueño o agente no se transcriben para IA.",
			"En modo humano podés enviar imágenes y notas de voz desde el composer.",
		],
	},
	{
		title: "10. Seguridad operativa",
		icon: ShieldCheck,
		items: [
			"Las sesiones están protegidas por autenticación y roles.",
			"Las acciones sensibles del CRM quedan auditadas cuando cambian datos importantes.",
			"La regla profesional es simple: la IA propone y automatiza; el humano gobierna.",
		],
	},
];

export default function CrmDocumentation() {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
			<div className="flex flex-col gap-2">
				<Badge variant="secondary" className="w-fit">
					Document Review
				</Badge>
				<h2 className="font-display text-2xl font-bold text-on-surface">
					Manual operativo del CRM
				</h2>
				<p className="max-w-3xl text-sm leading-relaxed text-on-surface-variant">
					Guía práctica para usar conversaciones, modo IA/Humano, calificación de
					leads, tareas, deals y automatizaciones sin perder control humano.
				</p>
			</div>

			<ScrollArea className="min-h-0 flex-1 pr-3">
				<div className="grid gap-4 pb-8 xl:grid-cols-[1.2fr_0.8fr]">
					<Card className="border-primary/20 bg-primary/5">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckCircle2 className="size-5 text-primary" />
								Flujo recomendado diario
							</CardTitle>
							<CardDescription>
								La forma correcta de trabajar el CRM sin quemar horas calificando leads.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ol className="grid gap-3 text-sm text-muted-foreground">
								<li>
									<strong className="text-foreground">1.</strong> Revisá
									conversaciones nuevas y dejá la IA contestar preguntas repetibles.
								</li>
								<li>
									<strong className="text-foreground">2.</strong> Cambiá a modo
									Humano cuando haya negociación, reclamo o decisión sensible.
								</li>
								<li>
									<strong className="text-foreground">3.</strong> Abrí el perfil,
									guardá score, etiquetas y motivo de calificación.
								</li>
								<li>
									<strong className="text-foreground">4.</strong> Convertí leads
									buenos en Deals y tareas concretas con fecha.
								</li>
								<li>
									<strong className="text-foreground">5.</strong> Aprobá o rechazá
									sugerencias IA para mantener datos limpios.
								</li>
							</ol>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Regla de oro</CardTitle>
							<CardDescription>
								El CRM funciona mejor cuando la IA opera lo repetible y el humano decide lo importante.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							<Badge>IA responde</Badge>
							<Badge variant="secondary">Humano aprueba</Badge>
							<Badge variant="outline">CRM registra</Badge>
							<Badge variant="outline">Pipeline mide</Badge>
						</CardContent>
					</Card>

					<div className="grid gap-4 xl:col-span-2 md:grid-cols-2">
						{sections.map((section) => {
							const Icon = section.icon;
							return (
								<Card key={section.title} className="border-outline-variant/20 bg-surface-container-low/70">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-base">
											<Icon className="size-4 text-primary" />
											{section.title}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
											{section.items.map((item) => (
												<li key={item} className="flex gap-2">
													<span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
													<span>{item}</span>
												</li>
											))}
										</ul>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}
