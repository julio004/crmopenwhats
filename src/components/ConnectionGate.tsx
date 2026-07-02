"use client";

import { useState, useEffect } from "react";

type ConnectionInfo = {
	status: "disconnected" | "qr" | "connecting" | "connected";
	qrPng: string | null;
	updatedAt: Date | string | null;
};

interface ConnectionGateProps {
	children: (
		phone: string | null,
		onDisconnect: () => void,
		botProfile: any,
		connection: ConnectionInfo,
	) => React.ReactNode;
}

export default function ConnectionGate({ children }: ConnectionGateProps) {
	const [status, setStatus] = useState<"disconnected" | "qr" | "connecting" | "connected">("disconnected");
	const [qrPng, setQrPng] = useState<string | null>(null);
	const [phone, setPhone] = useState<string | null>(null);
	const [botProfile, setBotProfile] = useState<any>(null);
	const [updatedAt, setUpdatedAt] = useState<Date | string | null>(null);
	const [loading, setLoading] = useState(true);

	const checkConnection = async () => {
		try {
			const res = await fetch("/api/connection/status");
			if (res.ok) {
				const data = await res.json();
				setStatus(data.status);
				setQrPng(data.qrPng);
				setPhone(data.phone);
				setUpdatedAt(data.updatedAt);
				setBotProfile(data.botProfile || null);
			}
		} catch (error) {
			console.error("[gate] Error verificando estado de conexión:", error);
		} finally {
			setLoading(false);
		}
	};

	// Polling de 2 segundos
	useEffect(() => {
		checkConnection();
		const interval = setInterval(checkConnection, 2000);
		return () => clearInterval(interval);
	}, []);

	const handleDisconnectLocal = () => {
		setStatus("disconnected");
		setQrPng(null);
		setPhone(null);
		setBotProfile(null);
		checkConnection();
	};

	if (loading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-surface-variant">
				<div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4 glow-active"></div>
				<span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">Cargando aplicació…</span>
			</div>
		);
	}

	return <>{children(phone, handleDisconnectLocal, botProfile, { status, qrPng, updatedAt })}</>;

}
