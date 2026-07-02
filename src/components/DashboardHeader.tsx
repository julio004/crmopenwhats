"use client";

import Image from "next/image";
import { useState } from "react";
import { normalizeProfileStatus } from "@/lib/baileys/profile";
import { QuickRepliesProfileModal } from "./dashboard-header/QuickRepliesProfileModal";
import { SearchIcon, UserIcon } from "./Icons.tsx";

interface DashboardHeaderProps {
	phone: string | null;
	onDisconnect: () => void;
	botProfile: {
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
	quickReplies: Array<{ id: string; shortcut: string; text: string }>;
	onQuickRepliesUpdated: () => void;
}

export default function DashboardHeader({
	phone,
	onDisconnect,
	botProfile,
	quickReplies,
	onQuickRepliesUpdated,
}: DashboardHeaderProps) {
	const [loading, setLoading] = useState(false);
	const [profileModalOpen, setProfileModalOpen] = useState(false);
	const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
	const currentAvatarUrl = botProfile?.profile_picture_url ?? null;
	const canShowAvatar = currentAvatarUrl && failedAvatarUrl !== currentAvatarUrl;
	const profileStatus = normalizeProfileStatus(botProfile?.status);

	const handleDisconnect = async () => {
		if (loading || !confirm("¿Estás seguro de que querés desconectar tu WhatsApp? Se cerrará la sesión y tendrás que escanear un nuevo QR.")) return;
		setLoading(true);
		try {
			const res = await fetch("/api/connection/disconnect", { method: "POST" });
			if (res.ok) {
				onDisconnect();
			} else {
				console.error("[header] Error desconectando la sesión.");
			}
		} catch (error) {
			console.error("[header] Error de red desconectando la sesión:", error);
		} finally {
			setLoading(false);
		}
	};

	const openProfileModal = () => {
		setProfileModalOpen(true);
	};

	return (
		<>
			<header className="bg-background border-b border-outline-variant flex justify-end items-center h-16 px-6 shrink-0 z-40">
				<div className="flex items-center gap-4">
					<SearchBar />
					<ConnectionStatus
						phone={phone}
						loading={loading}
						onDisconnect={handleDisconnect}
					/>
					<button
						type="button"
						onClick={openProfileModal}
						title={profileStatus ? `Abrir perfil: ${profileStatus}` : "Abrir perfil"}
						aria-label="Abrir perfil de WhatsApp"
						className="size-8 rounded-full overflow-hidden border border-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-center bg-transparent"
					>
						{canShowAvatar ? (
							<Image
								src={currentAvatarUrl}
								width={32}
								height={32}
								className="size-full object-cover"
								alt="Bot avatar"
								onError={() => setFailedAvatarUrl(currentAvatarUrl)}
							/>
						) : (
							<UserIcon className="text-primary hover:text-primary transition-colors" size={14} />
						)}
					</button>
				</div>
			</header>

			{profileModalOpen && (
				<QuickRepliesProfileModal
					phone={phone}
					botProfile={botProfile}
					quickReplies={quickReplies}
					onClose={() => setProfileModalOpen(false)}
					onQuickRepliesUpdated={onQuickRepliesUpdated}
				/>
			)}
		</>
	);
}

function SearchBar() {
	return (
		<div className="relative hidden md:block">
			<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
			<input
				type="text"
				placeholder="Buscar en el panel...        Ctrl + K"
				aria-label="Buscar en el panel"
				className="bg-surface border border-outline-variant rounded-full pl-8 pr-4 py-1.5 text-xs focus:outline-none focus:border-primary/50 transition-all w-64 placeholder-on-surface-variant/50 text-on-surface"
				disabled
			/>
		</div>
	);
}

function ConnectionStatus({
	phone,
	loading,
	onDisconnect,
}: {
	phone: string | null;
	loading: boolean;
	onDisconnect: () => void;
}) {
	if (!phone) {
		return (
			<div className="flex items-center gap-2 bg-error/10 border border-error/20 px-3 py-1 rounded-full text-[11px] text-error font-semibold">
				<span className="size-2 rounded-full bg-error animate-pulse"></span>
				<span>WhatsApp Desconectado</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-2 bg-transparent border border-primary text-primary px-4 py-1 rounded-full text-[11px] font-mono shadow-inner">
				<span className="relative flex size-2 shrink-0">
					<span className="animate-ping absolute inline-flex size-2 rounded-full bg-primary opacity-75"></span>
					<span className="relative inline-flex rounded-full size-2 bg-primary"></span>
				</span>
				<span>+{phone}</span>
			</div>

			<button
				type="button"
				onClick={onDisconnect}
				disabled={loading}
				className="px-4 py-1 bg-transparent hover:bg-error/10 border border-error text-error font-display text-[10px] font-bold uppercase tracking-wider rounded-full transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
				aria-label={loading ? "Desconectando WhatsApp" : "Desconectar WhatsApp"}
			>
				{loading ? "Saliendo..." : "Desconectar"}
			</button>
		</div>
	);
}
