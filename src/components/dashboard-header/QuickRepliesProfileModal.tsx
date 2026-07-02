"use client";

import Image from "next/image";
import { useReducer } from "react";
import { normalizeProfileStatus } from "@/lib/baileys/profile";
import { MailIcon, PhoneIcon, PlusIcon, TrashIcon, UserIcon } from "../Icons.tsx";

type QuickReply = { id: string; shortcut: string; text: string };

type BotProfile = {
	phone: string;
	profile_picture_url: string | null;
	status: unknown;
	business: {
		description: string;
		category: string;
		email: string;
		website: string[];
		address: string;
	} | null;
} | null;

type ModalState = {
	localQuickReplies: QuickReply[];
	newShortcut: string;
	newText: string;
	savingReplies: boolean;
	zoomImage: string | null;
	botAvatarError: boolean;
};

type ModalAction =
	| { type: "shortcutChanged"; value: string }
	| { type: "textChanged"; value: string }
	| { type: "replyAdded"; reply: QuickReply }
	| { type: "replyDeleted"; id: string }
	| { type: "savingStarted" }
	| { type: "savingFinished" }
	| { type: "zoomOpened"; image: string }
	| { type: "zoomClosed" }
	| { type: "avatarFailed" };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
	switch (action.type) {
		case "shortcutChanged":
			return { ...state, newShortcut: action.value.toLowerCase().replace(/[^a-z0-9]/g, "") };
		case "textChanged":
			return { ...state, newText: action.value };
		case "replyAdded":
			return {
				...state,
				localQuickReplies: [...state.localQuickReplies, action.reply],
				newShortcut: "",
				newText: "",
			};
		case "replyDeleted":
			return {
				...state,
				localQuickReplies: state.localQuickReplies.filter((reply) => reply.id !== action.id),
			};
		case "savingStarted":
			return { ...state, savingReplies: true };
		case "savingFinished":
			return { ...state, savingReplies: false };
		case "zoomOpened":
			return { ...state, zoomImage: action.image };
		case "zoomClosed":
			return { ...state, zoomImage: null };
		case "avatarFailed":
			return { ...state, botAvatarError: true };
		default:
			return state;
	}
}

interface QuickRepliesProfileModalProps {
	phone: string | null;
	botProfile: BotProfile;
	quickReplies: QuickReply[];
	onClose: () => void;
	onQuickRepliesUpdated: () => void;
}

export function QuickRepliesProfileModal({
	phone,
	botProfile,
	quickReplies,
	onClose,
	onQuickRepliesUpdated,
}: QuickRepliesProfileModalProps) {
	const [state, dispatch] = useReducer(modalReducer, {
		localQuickReplies: quickReplies,
		newShortcut: "",
		newText: "",
		savingReplies: false,
		zoomImage: null,
		botAvatarError: false,
	});

	const handleAddReply = (e: React.FormEvent) => {
		e.preventDefault();
		const normalizedShortcut = state.newShortcut.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
		if (!normalizedShortcut || !state.newText.trim()) return;

		if (state.localQuickReplies.some((reply) => reply.shortcut === normalizedShortcut)) {
			alert("Ya existe una respuesta rápida con este atajo.");
			return;
		}

		dispatch({
			type: "replyAdded",
			reply: {
				id: Date.now().toString(),
				shortcut: normalizedShortcut,
				text: state.newText.trim(),
			},
		});
	};

	const handleSaveReplies = async () => {
		dispatch({ type: "savingStarted" });
		try {
			const res = await fetch("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ quick_replies: state.localQuickReplies }),
			});
			if (res.ok) {
				onQuickRepliesUpdated();
				alert("Respuestas rápidas guardadas correctamente.");
			} else {
				console.error("[header] Error guardando respuestas rápidas.");
			}
		} catch (error) {
			console.error("[header] Error de red al guardar respuestas rápidas:", error);
		} finally {
			dispatch({ type: "savingFinished" });
		}
	};

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
				<button
					type="button"
					className="absolute inset-0 cursor-default"
					aria-label="Cerrar modal de perfil"
					onClick={onClose}
				/>
				<div
					className="relative bg-surface/95 border border-outline-variant rounded-3xl p-6 w-[90vw] max-w-[800px] max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row gap-6 animate-[scaleIn_0.2s_ease-out] backdrop-blur-xl text-on-surface"
				>
					<BotProfileSummary
						phone={phone}
						botProfile={botProfile}
						botAvatarError={state.botAvatarError}
						onAvatarError={() => dispatch({ type: "avatarFailed" })}
						onOpenZoom={(image) => dispatch({ type: "zoomOpened", image })}
					/>

					<QuickRepliesManager
						quickReplies={state.localQuickReplies}
						newShortcut={state.newShortcut}
						newText={state.newText}
						savingReplies={state.savingReplies}
						onAddReply={handleAddReply}
						onDeleteReply={(id) => dispatch({ type: "replyDeleted", id })}
						onShortcutChange={(value) => dispatch({ type: "shortcutChanged", value })}
						onTextChange={(value) => dispatch({ type: "textChanged", value })}
						onClose={onClose}
						onSave={handleSaveReplies}
					/>

					<button
						type="button"
						onClick={onClose}
						aria-label="Cerrar modal"
						className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface size-8 rounded-full flex items-center justify-center hover:bg-surface-bright transition-colors cursor-pointer"
					>
						×
					</button>
				</div>
			</div>

			{state.zoomImage && (
				<ImageZoomOverlay
					image={state.zoomImage}
					onClose={() => dispatch({ type: "zoomClosed" })}
				/>
			)}
		</>
	);
}

function BotProfileSummary({
	phone,
	botProfile,
	botAvatarError,
	onAvatarError,
	onOpenZoom,
}: {
	phone: string | null;
	botProfile: BotProfile;
	botAvatarError: boolean;
	onAvatarError: () => void;
	onOpenZoom: (image: string) => void;
}) {
	const profileStatus = normalizeProfileStatus(botProfile?.status);

	return (
		<div className="flex-1 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-outline-variant/30 pb-6 md:pb-0 md:pr-6">
			<h3 className="font-display text-sm font-bold text-primary uppercase tracking-wider mb-2">
				Perfil de WhatsApp
			</h3>

			<div className="flex flex-col items-center gap-3">
				<button
					type="button"
					onClick={() => botProfile?.profile_picture_url && onOpenZoom(botProfile.profile_picture_url)}
					aria-label={botProfile?.profile_picture_url ? "Ampliar foto de perfil" : "Foto de perfil no disponible"}
					className={`size-24 rounded-full overflow-hidden border-2 border-primary/50 bg-surface-bright flex items-center justify-center shadow-lg group relative ${botProfile?.profile_picture_url ? "cursor-pointer" : ""}`}
				>
					{botProfile?.profile_picture_url && !botAvatarError ? (
						<>
							<Image
								src={botProfile.profile_picture_url}
								alt="Bot profile"
								fill
								sizes="96px"
								className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
								onError={onAvatarError}
							/>
							<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] uppercase font-bold tracking-wider transition-opacity duration-200">
								Ampliar
							</div>
						</>
					) : (
						<UserIcon size={36} className="text-primary/70" />
					)}
				</button>

				<div className="text-center">
					<p className="font-mono text-sm font-semibold">{phone ? `+${phone}` : "Sin teléfono"}</p>
					{profileStatus && (
						<p className="text-[11px] text-on-surface-variant italic mt-1 bg-surface-bright px-3 py-1 rounded-full border border-outline-variant/35 inline-block">
							&quot;{profileStatus}&quot;
						</p>
					)}
				</div>
			</div>

			<BusinessProfileDetails business={botProfile?.business ?? null} />
		</div>
	);
}

function BusinessProfileDetails({ business }: { business: NonNullable<BotProfile>["business"] | null }) {
	if (!business) {
		return (
			<div className="mt-4 text-center p-4 border border-outline-variant/20 rounded-2xl bg-surface-bright/30">
				<p className="text-[10px] text-on-surface-variant/80 uppercase font-semibold">
					Perfil Comercial no configurado
				</p>
				<p className="text-[9px] text-on-surface-variant/60 mt-1">
					WhatsApp detectado como cuenta personal estándar.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-4 space-y-3 bg-surface-bright/50 border border-outline-variant/20 rounded-2xl p-4 text-xs">
			<p className="font-semibold text-primary uppercase tracking-wide text-[10px]">
				Perfil de Empresa
			</p>
			{business.category && (
				<div>
					<span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Categoría</span>
					<p className="font-medium mt-0.5">{business.category}</p>
				</div>
			)}
			{business.description && (
				<div>
					<span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Descripción</span>
					<p className="font-medium mt-0.5 whitespace-pre-wrap">{business.description}</p>
				</div>
			)}
			{business.email && (
				<div className="flex items-center gap-2 mt-1">
					<MailIcon size={12} className="text-primary/70" />
					<a href={`mailto:${business.email}`} className="hover:underline">{business.email}</a>
				</div>
			)}
			{business.address && (
				<div className="flex items-center gap-2 mt-1">
					<PhoneIcon size={12} className="text-primary/70" />
					<span>{business.address}</span>
				</div>
			)}
			{business.website.length > 0 && (
				<div className="mt-1">
					<span className="text-[9px] font-bold text-on-surface-variant/70 uppercase block mb-1">Sitios Web</span>
					<div className="flex flex-col gap-1">
						{business.website.map((web) => (
							<a
								key={web}
								href={web.startsWith("http") ? web : `https://${web}`}
								target="_blank"
								rel="noreferrer"
								className="text-primary hover:underline font-medium break-all block"
							>
								{web}
							</a>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function QuickRepliesManager({
	quickReplies,
	newShortcut,
	newText,
	savingReplies,
	onAddReply,
	onDeleteReply,
	onShortcutChange,
	onTextChange,
	onClose,
	onSave,
}: {
	quickReplies: QuickReply[];
	newShortcut: string;
	newText: string;
	savingReplies: boolean;
	onAddReply: (e: React.FormEvent) => void;
	onDeleteReply: (id: string) => void;
	onShortcutChange: (value: string) => void;
	onTextChange: (value: string) => void;
	onClose: () => void;
	onSave: () => void;
}) {
	return (
		<div className="flex-[1.2] flex flex-col gap-4">
			<h3 className="font-display text-sm font-bold text-primary uppercase tracking-wider">
				Respuestas Rápidas (/)
			</h3>

			<div className="flex-1 min-h-[150px] max-h-[250px] overflow-y-auto border border-outline-variant/20 rounded-2xl p-3 bg-surface-bright/40 space-y-2">
				{quickReplies.length > 0 ? (
					quickReplies.map((reply) => (
						<div
							key={reply.id}
							className="flex justify-between items-start gap-3 bg-surface border border-outline-variant/30 p-2.5 rounded-xl text-xs hover:border-primary/45 transition-colors"
						>
							<div className="flex-1 min-w-0">
								<span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
									/{reply.shortcut}
								</span>
								<p className="mt-2 text-on-surface-variant leading-relaxed break-words font-medium">
									{reply.text}
								</p>
							</div>
							<button
								type="button"
								onClick={() => onDeleteReply(reply.id)}
								className="text-error hover:bg-error/10 p-1.5 rounded-full transition-colors cursor-pointer shrink-0"
								title="Eliminar"
								aria-label="Eliminar respuesta rápida"
							>
								<TrashIcon size={14} />
							</button>
						</div>
					))
				) : (
					<div className="h-full flex flex-col items-center justify-center text-on-surface-variant/60 text-center py-8">
						<p className="font-semibold text-xs mb-1">No hay respuestas rápidas</p>
						<p className="text-[10px]">Agrega una abajo usando un atajo que comience con `/` en el chat.</p>
					</div>
				)}
			</div>

			<form onSubmit={onAddReply} className="bg-surface-bright/50 border border-outline-variant/30 rounded-2xl p-4 flex flex-col gap-3">
				<p className="font-semibold uppercase tracking-wide text-[10px] text-primary">
					Nueva Respuesta Rápida
				</p>
				<div className="flex items-center gap-2 bg-surface border border-outline-variant rounded-full px-3 py-1.5">
					<span className="text-primary font-mono font-bold">/</span>
					<input
						type="text"
						placeholder="atajo (ej. hola)"
						value={newShortcut}
						onChange={(e) => onShortcutChange(e.target.value)}
						className="bg-transparent border-0 outline-none text-xs w-full text-on-surface font-mono"
						required
						aria-label="Atajo de respuesta rápida"
					/>
				</div>
				<textarea
					placeholder="Texto de la respuesta rápida..."
					value={newText}
					onChange={(e) => onTextChange(e.target.value)}
					className="bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs outline-none focus:border-primary/50 text-on-surface min-h-[60px] resize-none"
					required
					aria-label="Contenido de la respuesta rápida"
				/>
				<button
					type="submit"
					className="py-2 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:bg-primary-bright"
				>
					<PlusIcon size={12} />
					Agregar Respuesta
				</button>
			</form>

			<div className="flex gap-3 mt-2 shrink-0">
				<button
					type="button"
					onClick={onClose}
					className="flex-1 py-2.5 bg-transparent border border-outline-variant hover:bg-surface-bright font-display text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
				>
					Cerrar
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={savingReplies}
					className="flex-1 py-2.5 bg-primary text-on-primary font-display text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 hover:bg-primary-bright disabled:opacity-50 cursor-pointer shadow-lg"
				>
					{savingReplies ? "Guardando..." : "Guardar Cambios"}
				</button>
			</div>
		</div>
	);
}

function ImageZoomOverlay({ image, onClose }: { image: string; onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-fade-in">
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				aria-label="Cerrar zoom de imagen"
				onClick={onClose}
			/>
			<div
				className="relative size-[90vw] max-w-[480px] max-h-[480px] p-1.5 bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center animate-[scaleIn_0.2s_ease-out]"
			>
				<Image
					src={image}
					alt="Bot foto grande"
					fill
					sizes="(max-width: 768px) 90vw, 480px"
					className="size-full object-cover rounded-2xl animate-fade-in"
				/>
				<button
					type="button"
					className="absolute top-4 right-4 size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white font-display text-xl font-bold focus:outline-none transition-all duration-200 hover:scale-105 active:scale-95 shadow-md cursor-pointer"
					onClick={onClose}
					aria-label="Cerrar zoom de imagen"
				>
					×
				</button>
			</div>
		</div>
	);
}
