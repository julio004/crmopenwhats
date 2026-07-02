"use client";

import { m } from "framer-motion";
import { BotIcon, CheckCheckIcon, ExternalLinkIcon, ImageIcon, MicIcon, UserIcon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MessageRow } from "../lib/db-contract.ts";

interface MessageBubbleProps {
	message: MessageRow;
}

function mediaUrlFrom(metadata: Record<string, unknown>): string | null {
	const mediaUrl = metadata.mediaUrl;
	return typeof mediaUrl === "string" && mediaUrl.trim() ? mediaUrl : null;
}

function isMediaPlaceholder(content: string, mediaType: MessageRow["media_type"]): boolean {
	const normalized = content.trim();
	if (mediaType === "audio") {
		return normalized === "Nota de voz" || normalized === "[Audio: Nota de voz]";
	}
	if (mediaType === "image") {
		return normalized === "Imagen recibida" || normalized === "[Imagen]";
	}
	return false;
}

const waveformBars = [28, 46, 34, 60, 42, 76, 54, 38, 64, 44, 70, 52, 32, 58, 40, 74, 48, 36];

export default function MessageBubble({ message }: MessageBubbleProps) {
	const { role, content, media_type, created_at, metadata } = message;

	const isUser = role === "user";
	const isAssistant = role === "assistant";
	const mediaUrl = mediaUrlFrom(metadata);
	const mediaAvailable = metadata.mediaAvailable !== false;

	const timeStr = created_at
		? new Date(created_at).toLocaleTimeString("es-ES", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";

	const sender = isUser
		? { label: "Cliente", icon: UserIcon, badge: "default" as const }
		: isAssistant
			? { label: "IA", icon: BotIcon, badge: "secondary" as const }
			: { label: "Tú", icon: UserIcon, badge: "outline" as const };
	const SenderIcon = sender.icon;

	return (
		<m.div
			layout
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18 }}
			className={cn("flex w-full", isUser ? "justify-start" : "justify-end")}
		>
			<Card
				size="sm"
				className={cn(
					"max-w-[min(78%,42rem)] gap-3 border py-3 shadow-md",
					isUser
						? "rounded-bl-md border-primary/35 bg-card/95"
						: "rounded-br-md border-border/80 bg-surface-container-high/90",
					isAssistant && "border-primary/25 bg-primary/15",
				)}
			>
				<CardContent className="space-y-3 px-3">
					<div className="flex items-center justify-between gap-4">
						<Badge variant={sender.badge} className="gap-1.5 uppercase tracking-wider">
							<SenderIcon className="size-3" />
							{sender.label}
						</Badge>
						<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
							{timeStr}
							{!isUser && <CheckCheckIcon className="size-3 text-primary" />}
						</span>
					</div>

					{media_type === "image" && (
						<div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
							{mediaUrl ? (
								<button
									type="button"
									className="group relative block w-full"
									onClick={() => window.open(mediaUrl, "_blank", "noopener,noreferrer")}
									aria-label="Ver imagen completa de WhatsApp"
								>
									<div className="relative h-72 w-full">
										<Image
											src={mediaUrl}
											alt="Imagen de WhatsApp"
											fill
											className="object-contain transition duration-200 group-hover:scale-[1.01]"
											sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
										/>
									</div>
									<span className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
										<ExternalLinkIcon className="size-3.5" />
									</span>
								</button>
							) : (
								<div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
									<ImageIcon className="size-4 text-primary" />
									<span>Imagen recibida. El archivo todavía no está disponible.</span>
								</div>
							)}
						</div>
					)}

					{media_type === "audio" && (
						<div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-background/85 to-secondary/10 p-3 shadow-inner">
							<div className="mb-3 flex items-center justify-between gap-3">
								<div className="flex items-center gap-2 text-xs font-medium text-foreground">
									<span className="flex size-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_0_24px_rgba(0,200,160,0.35)]">
										<MicIcon className="size-4" />
									</span>
									<div>
										<p className="leading-none">Nota de voz</p>
										<p className="mt-1 text-[10px] text-muted-foreground">Audio recibido por WhatsApp</p>
									</div>
								</div>
								{mediaUrl && mediaAvailable && (
									<Button variant="ghost" size="icon-sm" asChild>
										<a href={mediaUrl} target="_blank" rel="noreferrer" aria-label="Abrir audio en otra pestaña">
											<ExternalLinkIcon className="size-4" />
										</a>
									</Button>
								)}
							</div>
							<div className="mb-3 flex h-9 items-center gap-1 rounded-full border border-primary/15 bg-black/15 px-3">
								{waveformBars.map((height, index) => (
									<span
										key={`${height}-${index}`}
										className="w-1 rounded-full bg-primary/80"
										style={{ height: `${height}%` }}
									/>
								))}
							</div>
							{mediaUrl && mediaAvailable ? (
								<audio
									src={mediaUrl}
									controls
									preload="metadata"
									className="h-9 w-full accent-primary opacity-95"
									aria-label="Nota de voz de WhatsApp"
								>
									<track kind="captions" />
								</audio>
							) : (
								<p className="text-xs italic text-on-surface-variant">
									Audio recibido, pero el archivo ya no está disponible en el servidor.
								</p>
							)}
						</div>
					)}

					{content && !isMediaPlaceholder(content, media_type) && (
						<p className="m-0 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-foreground">
							{content}
						</p>
					)}
				</CardContent>
			</Card>
		</m.div>
	);
}
