"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ImagePlusIcon, MicIcon, PaperclipIcon, SquareIcon, XIcon, BriefcaseIcon, Trash2Icon, ChevronDown } from "lucide-react";
import { TrashIcon, MessagesIcon, RobotIcon, ArrowRightIcon, ArrowDownIcon, UserIcon, PhoneIcon, EditIcon, ArchiveIcon } from "./Icons.tsx";
import type { ConversationListRow } from "../lib/db.ts";
import type { MessageRow } from "../lib/db-contract.ts";
import { LEAD_LABELS, type LeadLabel } from "../domain/whatsapp-rules.ts";
import MessageBubble from "./MessageBubble.tsx";
import ModeToggle from "./ModeToggle.tsx";
import { Button } from "@/components/ui/button";
import { Button as NeonButton } from "@/components/ui/neon-button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationPanelProps {
	conversation: ConversationListRow;
	onModeChanged: (newMode: "AI" | "HUMAN") => void;
	onDeleted: () => void;
	onConversationUpdated?: (conversation: ConversationListRow) => void;
	quickReplies?: Array<{ id: string; shortcut: string; text: string }>;
}

const EMPTY_REPLIES: any[] = [];

export default function ConversationPanel({
	conversation,
	onModeChanged,
	onDeleted,
	onConversationUpdated,
	quickReplies = EMPTY_REPLIES,
}: ConversationPanelProps) {
	const [messages, setMessages] = useState<MessageRow[]>([]);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [recording, setRecording] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [showScrollDown, setShowScrollDown] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const [profilePortalElement, setProfilePortalElement] = useState<HTMLElement | null>(null);
	const [profileName, setProfileName] = useState(conversation.name?.trim() || "");
	const [profileLeadLabels, setProfileLeadLabels] = useState<LeadLabel[]>(conversation.lead_labels ?? []);
	const [profileLeadScore, setProfileLeadScore] = useState(
		typeof conversation.lead_score === "number" ? String(conversation.lead_score) : "",
	);
	const [profileLeadReason, setProfileLeadReason] = useState(conversation.lead_score_reason ?? "");
	const [savingProfile, setSavingProfile] = useState(false);
	const [avatarError, setAvatarError] = useState(false);
	const [drawerAvatarError, setDrawerAvatarError] = useState(false);

	useEffect(() => {
		setProfilePortalElement(document.getElementById("conversation-profile-sidebar-root"));
	}, []);

	useEffect(() => {
		setProfileName(conversation.name?.trim() || "");
		setProfileLeadLabels(conversation.lead_labels ?? []);
		setProfileLeadScore(typeof conversation.lead_score === "number" ? String(conversation.lead_score) : "");
		setProfileLeadReason(conversation.lead_score_reason ?? "");
	}, [
		conversation.id,
		conversation.name,
		conversation.lead_labels,
		conversation.lead_score,
		conversation.lead_score_reason,
	]);

	// Oportunidades de Venta (Deals)
	const [deals, setDeals] = useState<any[]>([]);
	const [loadingDeals, setLoadingDeals] = useState(false);
	const [newDealTitle, setNewDealTitle] = useState("");
	const [newDealAmount, setNewDealAmount] = useState("");
	const [showAddDeal, setShowAddDeal] = useState(false);
	const [creatingDeal, setCreatingDeal] = useState(false);

	const chatEndRef = useRef<HTMLDivElement>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const isFirstLoadRef = useRef(true);
	const prevMessagesLengthRef = useRef(0);

	// Respuestas rápidas (/)
	const [showRepliesDropdown, setShowRepliesDropdown] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const [filterText, setFilterText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	// Detectar trigger de /
	useEffect(() => {
		const lastSlashIdx = text.lastIndexOf("/");
		if (lastSlashIdx !== -1) {
			const charBefore = lastSlashIdx > 0 ? text[lastSlashIdx - 1] : "";
			if (charBefore === "" || charBefore === " ") {
				const query = text.slice(lastSlashIdx + 1);
				if (!query.includes(" ")) {
					setFilterText(query);
					setShowRepliesDropdown(true);
					setActiveIndex(0);
					return;
				}
			}
		}
		setShowRepliesDropdown(false);
	}, [text]);

	const filteredReplies = quickReplies.filter((reply) =>
		reply.shortcut.toLowerCase().startsWith(filterText.toLowerCase())
	);

	const handleSelectReply = (replyText: string) => {
		const lastSlashIdx = text.lastIndexOf("/");
		if (lastSlashIdx !== -1) {
			const prefix = text.slice(0, lastSlashIdx);
			setText(prefix + replyText + " ");
		}
		setShowRepliesDropdown(false);
		setTimeout(() => {
			inputRef.current?.focus();
		}, 10);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (showRepliesDropdown && filteredReplies.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((prev) => (prev + 1) % filteredReplies.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((prev) => (prev - 1 + filteredReplies.length) % filteredReplies.length);
			} else if (e.key === "Enter") {
				e.preventDefault();
				handleSelectReply(filteredReplies[activeIndex].text);
			} else if (e.key === "Escape") {
				e.preventDefault();
				setShowRepliesDropdown(false);
			}
		}
	};
const [prevConversationId, setPrevConversationId] = useState(conversation.id);

if (conversation.id !== prevConversationId) {
	setPrevConversationId(conversation.id);
	isFirstLoadRef.current = true;
	prevMessagesLengthRef.current = 0;
	setShowScrollDown(false);
	setProfileName(conversation.name?.trim() || "");
	setProfileLeadLabels(conversation.lead_labels ?? []);
	setProfileLeadScore(typeof conversation.lead_score === "number" ? String(conversation.lead_score) : "");
	setProfileLeadReason(conversation.lead_score_reason ?? "");
	setText("");
	setSelectedFile(null);
	setAvatarError(false);
	setDrawerAvatarError(false);
}

// Polling de 2 segundos
	// Endpoint para recargar el historial de mensajes
	const loadMessages = async () => {
		try {
			const res = await fetch(`/api/messages/${conversation.id}`);
			if (res.ok) {
				const data = await res.json();
				setMessages(data);
			}
		} catch (error) {
			console.error("[panel] Error cargando mensajes del chat:", error);
		}
	};

	// Carga las oportunidades de venta (Deals) del contacto
	const loadDeals = async () => {
		if (!conversation.contact_id) return;
		setLoadingDeals(true);
		try {
			const res = await fetch(`/api/crm/deals?contactId=${conversation.contact_id}`);
			if (res.ok) {
				const data = await res.json();
				setDeals(data);
			}
		} catch (err) {
			console.error("Error cargando deals:", err);
		} finally {
			setLoadingDeals(false);
		}
	};

	// Crear trato comercial nuevo
	const handleCreateDeal = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newDealTitle.trim() || !conversation.contact_id) return;
		setCreatingDeal(true);
		try {
			const res = await fetch("/api/crm/deals", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: newDealTitle.trim(),
					amount: newDealAmount ? Number(newDealAmount) : null,
					contactId: conversation.contact_id,
					stage: "lead",
				}),
			});
			if (res.ok) {
				setNewDealTitle("");
				setNewDealAmount("");
				setShowAddDeal(false);
				await loadDeals();
			}
		} catch (err) {
			console.error("Error creando deal:", err);
		} finally {
			setCreatingDeal(false);
		}
	};

	// Cambiar etapa comercial del trato
	const handleUpdateDealStage = async (dealId: number, newStage: string) => {
		try {
			const res = await fetch(`/api/crm/deals/${dealId}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ stage: newStage }),
			});
			if (res.ok) {
				await loadDeals();
			}
		} catch (err) {
			console.error("Error actualizando stage del deal:", err);
		}
	};

	// Eliminar trato comercial
	const handleDeleteDeal = async (dealId: number) => {
		if (!confirm("¿Seguro que querés eliminar esta oportunidad de venta?")) return;
		try {
			const res = await fetch(`/api/crm/deals/${dealId}`, {
				method: "DELETE",
			});
			if (res.ok) {
				await loadDeals();
			}
		} catch (err) {
			console.error("Error eliminando deal:", err);
		}
	};

	// Cargar deals cuando se abre el perfil o cambia el contacto
	useEffect(() => {
		if (profileOpen && conversation.contact_id) {
			loadDeals();
		} else {
			setDeals([]);
		}
	}, [profileOpen, conversation.contact_id]);

	// Polling de 2 segundos
	useEffect(() => {
		loadMessages();
		const interval = setInterval(loadMessages, 2000);
		return () => clearInterval(interval);
	}, [conversation.id]);

	useEffect(() => {
		return () => {
			mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
		};
	}, []);

	// Escuchar scroll del contenedor para mostrar/ocultar el botón flotante
	const handleScroll = () => {
		const container = chatContainerRef.current;
		if (!container) return;

		const isFarFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight > 200;
		setShowScrollDown(isFarFromBottom);
	};

	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container) return;

		container.addEventListener("scroll", handleScroll);

		return () => {
			container.removeEventListener("scroll", handleScroll);
		};
	}, [conversation.id]);

	// Bajar al fondo
	const scrollToBottom = () => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
		setShowScrollDown(false);
	};

	// Auto-scroll respetuoso pero inmediato si llega un mensaje nuevo
	useEffect(() => {
		const lengthChanged = messages.length > prevMessagesLengthRef.current;
		prevMessagesLengthRef.current = messages.length;

		if (isFirstLoadRef.current || lengthChanged) {
			chatEndRef.current?.scrollIntoView({
				behavior: isFirstLoadRef.current ? "auto" : "smooth",
			});
			isFirstLoadRef.current = false;
		}
	}, [messages]);

	const focusComposer = () => {
		window.requestAnimationFrame(() => inputRef.current?.focus());
	};

	const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		setSelectedFile(file);
		focusComposer();
	};

	const clearSelectedFile = () => {
		setSelectedFile(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
		focusComposer();
	};

	const stopRecording = () => {
		mediaRecorderRef.current?.stop();
	};

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			audioChunksRef.current = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunksRef.current.push(event.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
				const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
				setSelectedFile(file);
				setRecording(false);
				stream.getTracks().forEach((track) => track.stop());
				focusComposer();
			};
			mediaRecorderRef.current = recorder;
			recorder.start();
			setRecording(true);
		} catch (error) {
			console.error("[composer] Error iniciando grabación de audio:", error);
			setRecording(false);
		}
	};

	const toggleRecording = () => {
		if (recording) {
			stopRecording();
			return;
		}
		void startRecording();
	};

	// Enviar mensaje manual
	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if ((!text.trim() && !selectedFile) || sending || conversation.mode === "AI") return;
		setSending(true);
		try {
			const body = selectedFile
				? (() => {
						const formData = new FormData();
						formData.append("content", text);
						formData.append("file", selectedFile);
						return formData;
					})()
				: JSON.stringify({ content: text });
			const res = await fetch(`/api/messages/${conversation.id}`, {
				method: "POST",
				headers: selectedFile ? undefined : { "content-type": "application/json" },
				body,
			});
			if (res.ok) {
				setText("");
				clearSelectedFile();
				await loadMessages();
			} else {
				console.error("[send] Error enviando mensaje manual.");
			}
		} catch (error) {
			console.error("[send] Error de red enviando mensaje:", error);
		} finally {
			setSending(false);
			focusComposer();
		}
	};

	// Eliminar conversación completa
	const handleDelete = async () => {
		if (deleting || !confirm("¿Estás seguro de que querés borrar esta conversación? Esta acción no se puede deshacer.")) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/conversations/${conversation.id}`, {
				method: "DELETE",
			});
			if (res.ok) {
				onDeleted();
			} else {
				console.error("[delete] Error eliminando conversación.");
			}
		} catch (error) {
			console.error("[delete] Error de red eliminando conversación:", error);
		} finally {
			setDeleting(false);
		}
	};

	// Archivar conversación
	const handleArchive = async () => {
		if (archiving) return;
		setArchiving(true);
		try {
			const res = await fetch(`/api/conversations/${conversation.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ is_archived: !conversation.is_archived }),
			});
			if (res.ok) {
				onDeleted();
			} else {
				console.error("[archive] Error actualizando estado de archivado.");
			}
		} catch (error) {
			console.error("[archive] Error de red actualizando estado de archivado:", error);
		} finally {
			setArchiving(false);
		}
	};

	const isAi = conversation.mode === "AI";
	const cleanPhone = conversation.phone.replace(/@.*/, "");
	const displayName = conversation.name?.trim() || `+${cleanPhone}`;
	const technicalJid = conversation.jid || `${cleanPhone}@s.whatsapp.net`;
	const initials = (conversation.name?.trim() || cleanPhone).slice(0, 1).toLocaleUpperCase();
	const profilePictureUrl = conversation.profile_picture_url;
	const leadScore = typeof conversation.lead_score === "number" ? conversation.lead_score : null;

	const toggleLeadLabel = (label: LeadLabel) => {
		setProfileLeadLabels((current) =>
			current.includes(label)
				? current.filter((item) => item !== label)
				: [...current, label],
		);
	};

	const handleSaveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (savingProfile) return;
		setSavingProfile(true);
		try {
			const res = await fetch(`/api/conversations/${conversation.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: profileName,
					lead_labels: profileLeadLabels,
					lead_score: profileLeadScore.trim()
						? Number(profileLeadScore)
						: null,
					lead_score_reason: profileLeadReason,
				}),
			});
			if (res.ok) {
				const updated = await res.json();
				onConversationUpdated?.(updated);
				setProfileOpen(false); // Cerrar panel lateral en caso de éxito como feedback de guardado
			} else {
				const errData = await res.json().catch(() => ({}));
				console.error("[profile] Error guardando perfil:", res.statusText);
				alert(`No se pudo guardar el cliente: ${errData.error || res.statusText}`);
			}
		} catch (error: any) {
			console.error("[profile] Error de red guardando perfil:", error);
			alert(`Error de red al guardar cliente: ${error.message || "Error desconocido"}`);
		} finally {
			setSavingProfile(false);
		}
	};

	const hasChanges =
		profileName.trim() !== (conversation.name?.trim() || "") ||
		profileLeadScore.trim() !==
			(typeof conversation.lead_score === "number" ? String(conversation.lead_score) : "") ||
		profileLeadReason.trim() !== (conversation.lead_score_reason?.trim() || "") ||
		(() => {
			const orig = conversation.lead_labels ?? [];
			if (orig.length !== profileLeadLabels.length) return true;
			const origSorted = [...orig].sort();
			const currSorted = [...profileLeadLabels].sort();
			return origSorted.some((val, idx) => val !== currSorted[idx]);
		})();

	return (
		<div className="relative flex flex-col h-full bg-background rounded-r-3xl overflow-hidden">
			
			{/* Cabecera del Panel de Conversación */}
			<div className="p-3 sm:p-4 bg-background border-b border-outline-variant flex flex-wrap items-center justify-between gap-3 shrink-0">
				<button
					type="button"
					onClick={() => setProfileOpen(true)}
					className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-2xl hover:bg-surface px-2 py-1 transition-colors"
					title="Abrir perfil del contacto"
					aria-label={`Perfil de ${displayName}`}
				>
					{profilePictureUrl && !avatarError ? (
						<Image
							src={profilePictureUrl}
							alt={displayName}
							width={32}
							height={32}
							className="size-8 rounded-full object-cover border border-primary/30"
							onError={() => setAvatarError(true)}
						/>
					) : (
						<div className="size-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display font-bold">
							{initials || <UserIcon size={16} />}
						</div>
					)}
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-display text-sm font-bold text-on-surface">{displayName}</span>
					<span className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant/80 tracking-wider mt-0.5">
						<span className="size-2 rounded-full bg-primary"></span>
						+{cleanPhone}
					</span>
					{(conversation.lead_labels?.length > 0 || leadScore !== null) && (
						<span className="mt-1 flex flex-wrap items-center gap-1">
							{conversation.lead_labels?.slice(0, 2).map((label) => (
								<span
									key={label}
									className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary"
								>
									{label.replace("_", " ")}
								</span>
							))}
							{leadScore !== null && (
								<span className="rounded-full border border-secondary/35 bg-secondary/10 px-1.5 py-0.5 text-[8px] font-bold text-secondary">
									{leadScore}/100
								</span>
							)}
						</span>
					)}
				</div>
				</button>
				
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
					<ModeToggle
						conversationId={conversation.id}
						currentMode={conversation.mode}
						onModeChange={onModeChanged}
					/>
					
					<button type="button"
						onClick={handleArchive}
						disabled={archiving}
						className="px-3 py-1.5 text-primary hover:bg-primary/10 border border-primary rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
						title={conversation.is_archived ? "Desarchivar conversación para verla al frente" : "Archivar conversación para no verla al frente"}
					>
						<ArchiveIcon size={12} /> {conversation.is_archived ? "Desarchivar" : "Archivar"}
					</button>

					<button type="button"
						onClick={handleDelete}
						disabled={deleting}
						className="px-3 py-1.5 text-error hover:bg-error/10 border border-error rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
						title="Borrar conversación completa de la DB"
					>
						<TrashIcon size={12} /> Borrar
					</button>
				</div>
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="flex min-w-0 flex-1 flex-col">
			{/* Contenedor de Mensajes con Scroll y Botón Flotante */}
			<div className="flex-1 min-h-0 relative">
				<div
					ref={chatContainerRef}
					className="h-full overflow-y-auto p-6 flex flex-col gap-4 bg-background/50"
				>
					{messages.length === 0 ? (
						<div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/60 text-xs gap-2">
							<MessagesIcon className="text-on-surface-variant/30 animate-pulse mb-1" size={32} />
							<p>No hay mensajes en este chat. Escribí un mensaje para iniciar.</p>
						</div>
					) : (
						messages.map((message) => <MessageBubble key={message.id} message={message} />)
					)}
					<div ref={chatEndRef} />
				</div>

				{/* Botón Flotante para bajar */}
				{showScrollDown && (
					<button type="button"
						onClick={scrollToBottom}
						className="absolute bottom-4 right-6 size-10 rounded-full bg-surface border border-outline-variant text-primary hover:text-primary-bright hover:bg-surface-bright flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 animate-fade-in z-20"
						title="Ir al final de la conversación"
					>
						<ArrowDownIcon size={18} />
					</button>
				)}
			</div>

			{/* Composer / Input Inferior */}
			<div className="p-4 bg-background border-t border-outline-variant shrink-0">
				{isAi ? (
					<div className="flex flex-wrap items-center justify-center gap-3 p-3 border border-outline-variant rounded-full text-on-surface-variant text-[11px] font-medium">
						<RobotIcon className="text-primary" size={14} />
						<span>El bot responde automaticamente. Cambiá a humano para intervenir manualmente.</span>
						<ModeToggle
							conversationId={conversation.id}
							currentMode={conversation.mode}
							onModeChange={onModeChanged}
						/>
					</div>
				) : (
					<form onSubmit={handleSend} className="flex w-full flex-col gap-2">
						{selectedFile && (
							<div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-on-surface">
								<div className="flex min-w-0 items-center gap-2">
									{selectedFile.type.startsWith("audio/") ? (
										<MicIcon className="size-4 shrink-0 text-primary" />
									) : (
										<ImagePlusIcon className="size-4 shrink-0 text-primary" />
									)}
									<span className="truncate font-medium">{selectedFile.name}</span>
									<span className="shrink-0 text-[10px] text-on-surface-variant">
										{Math.max(1, Math.round(selectedFile.size / 1024))} KB
									</span>
								</div>
								<button
									type="button"
									onClick={clearSelectedFile}
									className="rounded-full p-1 text-on-surface-variant hover:bg-surface hover:text-on-surface"
									aria-label="Quitar adjunto"
								>
									<XIcon className="size-4" />
								</button>
							</div>
						)}
						<div className="flex gap-2.5">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg,image/webp"
								className="hidden"
								onChange={handleFileSelected}
							/>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={sending || recording}
								className="size-10 flex shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
								title="Adjuntar imagen"
								aria-label="Adjuntar imagen"
							>
								<PaperclipIcon className="size-4" />
							</button>
							<button
								type="button"
								onClick={toggleRecording}
								disabled={sending}
								className={`size-10 flex shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-50 ${
									recording
										? "border-error bg-error/15 text-error"
										: "border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50 hover:text-primary"
								}`}
								title={recording ? "Detener grabacion" : "Grabar audio"}
								aria-label={recording ? "Detener grabacion" : "Grabar audio"}
							>
								{recording ? <SquareIcon className="size-4 fill-current" /> : <MicIcon className="size-4" />}
							</button>
							<div className="relative flex-1">
								{showRepliesDropdown && filteredReplies.length > 0 && (
									<div className="absolute bottom-full mb-2.5 left-0 w-full bg-surface-bright/95 border border-outline-variant/60 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden max-h-[200px] overflow-y-auto z-30 animate-fade-in flex flex-col py-1.5 text-on-surface">
										{filteredReplies.map((reply, idx) => (
											<div
												key={reply.id}
												onClick={() => handleSelectReply(reply.text)}
												className={`px-4 py-2 text-xs flex justify-between items-center cursor-pointer transition-colors ${
													idx === activeIndex
														? "bg-primary/10 text-primary font-bold"
														: "text-on-surface-variant hover:bg-surface-bright"
												}`}
											>
												<span className="font-semibold">{reply.text}</span>
												<span className="text-[10px] font-mono text-primary/70 bg-primary/5 px-2 py-0.5 rounded border border-primary/15 font-bold">
													/{reply.shortcut}
												</span>
											</div>
										))}
									</div>
								)}
								<input
									ref={inputRef}
									type="text"
									value={text}
									onChange={(e) => setText(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Escribi un mensaje en modo Humano... (usa / para respuestas rapidas)"
									aria-label="Escribir mensaje"
									disabled={sending || recording}
									className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-full text-xs focus:outline-none focus:border-primary/50 transition-all duration-200 disabled:opacity-50 text-on-surface placeholder-on-surface-variant/50"
								/>
							</div>
							<button
								type="submit"
								disabled={sending || recording || (!text.trim() && !selectedFile)}
								className="size-10 flex items-center justify-center bg-transparent text-primary hover:bg-surface rounded-full transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
							>
								{sending ? "..." : <ArrowRightIcon size={18} />}
							</button>
						</div>
					</form>
				)}
			</div>
				</div>
				{profileOpen && profilePortalElement && createPortal((
					<aside className="flex h-full w-[min(420px,38vw)] min-w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-2xl animate-fade-in sm:p-5">
						<div className="mb-5 flex shrink-0 items-start justify-between gap-3 sm:mb-8">
							<div className="min-w-0">
								<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
									Perfil del cliente
								</p>
								<h3 className="mt-1 truncate font-display text-lg font-bold text-on-surface">
									{displayName}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setProfileOpen(false)}
								className="size-8 rounded-full border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
								aria-label="Cerrar perfil"
							>
								×
							</button>
						</div>

						<div className="mb-5 flex shrink-0 flex-col items-center sm:mb-8">
							{profilePictureUrl && !drawerAvatarError ? (
								<div className="relative mb-3 size-24 overflow-hidden rounded-full border border-primary/30">
									<Image
										src={profilePictureUrl}
										alt={displayName}
										fill
										className="size-full object-cover"
										onError={() => setDrawerAvatarError(true)}
									/>
								</div>
							) : (
								<div className="size-24 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display text-2xl font-bold mb-3">
									{initials || <UserIcon size={28} />}
								</div>
							)}
							<p className="font-semibold text-on-surface">{displayName}</p>
							<p className="font-mono text-xs text-on-surface-variant mt-1">+{cleanPhone}</p>
						</div>

						<form onSubmit={handleSaveProfile} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
							<label className="block">
								<span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">
									<EditIcon size={12} /> Nombre personalizado
								</span>
								<input
									value={profileName}
									onChange={(event) => setProfileName(event.target.value)}
									placeholder="Ej: Cliente mayorista Santo Domingo"
									className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
								/>
							</label>

							<div className="rounded-2xl border border-outline-variant/30 bg-background/60 p-4 space-y-3 text-xs">
								<div>
									<span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">
										<PhoneIcon size={12} /> Teléfono
									</span>
									<p className="font-mono text-on-surface">+{cleanPhone}</p>
								</div>
								<div>
									<span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
										ID técnico
									</span>
									<p className="font-mono text-on-surface-variant break-all mt-1">
										{technicalJid}
									</p>
								</div>
							</div>

							<div className="rounded-2xl border border-outline-variant/30 bg-background/60 p-4 text-xs">
								<span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
									Calificación de cliente
								</span>
								<div className="mt-3 flex flex-wrap gap-2">
									{LEAD_LABELS.map((label) => {
										const active = profileLeadLabels.includes(label);
										return (
											<button
												key={label}
												type="button"
												onClick={() => toggleLeadLabel(label)}
												className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
													active
														? "border-primary/50 bg-primary/15 text-primary"
														: "border-outline-variant/40 text-on-surface-variant hover:text-on-surface"
												}`}
											>
												{label.replace("_", " ")}
											</button>
										);
									})}
								</div>
								<label className="mt-4 block">
									<span className="mb-2 block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
										Score 0-100
									</span>
									<input
										type="number"
										min="0"
										max="100"
										value={profileLeadScore}
										onChange={(event) => setProfileLeadScore(event.target.value)}
										className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
									/>
								</label>
								<label className="mt-3 block">
									<span className="mb-2 block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
										Motivo
									</span>
									<textarea
										value={profileLeadReason}
										onChange={(event) => setProfileLeadReason(event.target.value)}
										placeholder="Ej: pidió precio, urgencia alta, comparando opciones..."
										className="min-h-20 w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
									/>
								</label>
							</div>

							{/* Sección de Oportunidades de Venta (Deals) */}
							<div className="border-t border-outline-variant/30 pt-4 mt-2 mb-6">
								<div className="flex items-center justify-between mb-3">
									<span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
										<BriefcaseIcon size={12} className="text-primary" /> Oportunidades de Venta
									</span>
									{!showAddDeal && conversation.contact_id && (
										<button
											type="button"
											onClick={() => setShowAddDeal(true)}
											className="text-[10px] font-bold text-primary hover:underline cursor-pointer bg-transparent border-0"
										>
											+ Agregar
										</button>
									)}
								</div>

								{/* Formulario para agregar Deal */}
								{showAddDeal && (
									<div className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
										<div>
											<span className="block text-[9px] uppercase tracking-wider font-bold text-on-surface-variant mb-1">Título</span>
											<input
												type="text"
												value={newDealTitle}
												onChange={(e) => setNewDealTitle(e.target.value)}
												placeholder="Ej: Suscripción Anual"
												className="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
											/>
										</div>
										<div>
											<span className="block text-[9px] uppercase tracking-wider font-bold text-on-surface-variant mb-1">Monto (USD)</span>
											<input
												type="number"
												value={newDealAmount}
												onChange={(e) => setNewDealAmount(e.target.value)}
												placeholder="Ej: 150"
												className="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
											/>
										</div>
										<div className="flex gap-2 justify-end">
											<button
												type="button"
												onClick={() => setShowAddDeal(false)}
												className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-outline-variant text-on-surface hover:bg-surface-bright cursor-pointer bg-transparent"
											>
												Cancelar
											</button>
											<button
												type="button"
												disabled={creatingDeal || !newDealTitle.trim()}
												onClick={handleCreateDeal}
												className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-primary text-on-primary hover:brightness-110 disabled:opacity-50 cursor-pointer border-0"
											>
												{creatingDeal ? "Creando..." : "Crear"}
											</button>
										</div>
									</div>
								)}

								{/* Listado de Deals */}
								{loadingDeals ? (
									<div className="text-center py-2 text-xs text-on-surface-variant/60">Cargando oportunidades...</div>
								) : !conversation.contact_id ? (
									<div className="text-center py-3 rounded-xl border border-dashed border-outline-variant/30 text-xs text-on-surface-variant/50">
										Guardá el cliente primero para poder asignarle oportunidades comerciales.
									</div>
								) : deals.length === 0 ? (
									<div className="text-center py-3 rounded-xl border border-dashed border-outline-variant/30 text-xs text-on-surface-variant/50">
										No hay oportunidades comerciales registradas.
									</div>
								) : (
									<div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
										{deals.map((deal) => (
											<div key={deal.id} className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-2 shadow-sm">
												<div className="flex justify-between items-start gap-2">
													<div className="min-w-0">
														<p className="font-semibold text-xs text-on-surface truncate" title={deal.title}>
															{deal.title}
														</p>
														<p className="text-[10px] text-primary font-bold mt-0.5">
															{deal.amount !== null ? `${deal.amount} ${deal.currency}` : "Monto sin definir"}
														</p>
													</div>
													<button
														type="button"
														onClick={() => handleDeleteDeal(deal.id)}
														className="text-on-surface-variant/60 hover:text-error transition p-1 hover:bg-error/5 rounded-full cursor-pointer bg-transparent border-0"
														title="Eliminar oportunidad"
													>
														<Trash2Icon size={12} />
													</button>
												</div>
												<div className="flex items-center justify-between gap-2 border-t border-outline-variant/10 pt-2 mt-0.5">
													<span className="text-[9px] uppercase tracking-wider font-bold text-on-surface-variant">Etapa</span>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="outline"
																className="text-[10px] font-bold bg-surface border border-outline-variant/40 rounded-lg px-2 py-1 h-auto flex items-center gap-1 cursor-pointer text-on-surface hover:bg-surface-bright"
															>
																{deal.stage === "lead" && "Prospecto"}
																{deal.stage === "contacted" && "Contactado"}
																{deal.stage === "proposal_sent" && "Propuesta Enviada"}
																{deal.stage === "won" && "Ganado"}
																{deal.stage === "lost" && "Perdido"}
																<ChevronDown className="size-3 opacity-60" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent className="bg-surface-container border border-outline-variant text-on-surface" align="end">
															<DropdownMenuItem className="text-[10px] cursor-pointer focus:bg-primary/10 focus:text-primary" onClick={() => handleUpdateDealStage(deal.id, "lead")}>Prospecto</DropdownMenuItem>
															<DropdownMenuItem className="text-[10px] cursor-pointer focus:bg-primary/10 focus:text-primary" onClick={() => handleUpdateDealStage(deal.id, "contacted")}>Contactado</DropdownMenuItem>
															<DropdownMenuItem className="text-[10px] cursor-pointer focus:bg-primary/10 focus:text-primary" onClick={() => handleUpdateDealStage(deal.id, "proposal_sent")}>Propuesta Enviada</DropdownMenuItem>
															<DropdownMenuItem className="text-[10px] cursor-pointer focus:bg-primary/10 focus:text-primary animate-pulse-once" onClick={() => handleUpdateDealStage(deal.id, "won")}>Ganado</DropdownMenuItem>
															<DropdownMenuItem className="text-[10px] cursor-pointer focus:bg-primary/10 focus:text-primary" onClick={() => handleUpdateDealStage(deal.id, "lost")}>Perdido</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<NeonButton
								type="submit"
								disabled={savingProfile || !hasChanges}
								variant="solid"
								size="lg"
								className="mt-1 w-full bg-primary text-on-primary border-primary/30 text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-primary/90 disabled:opacity-50"
							>
								{savingProfile ? "Guardando..." : "Guardar cliente"}
							</NeonButton>
						</form>
					</aside>
				), profilePortalElement)}

			</div>

		</div>
	);
}
