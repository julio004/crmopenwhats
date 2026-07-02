"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { PhoneIcon } from "./Icons.tsx";

interface QRScreenProps {
	status: "disconnected" | "qr" | "connecting" | "connected";
	qrPng: string | null;
	updatedAt: Date | string | null;
}

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
	timeStyle: "medium",
});

export default function QRScreen({ status, qrPng, updatedAt }: QRScreenProps) {
	const [secondsDisconnected, setSecondsDisconnected] = useState(0);
	const [prevStatus, setPrevStatus] = useState(status);
	const [prevQrPng, setPrevQrPng] = useState(qrPng);

	if (status !== prevStatus || qrPng !== prevQrPng) {
		setPrevStatus(status);
		setPrevQrPng(qrPng);
		if (status !== "disconnected" || !!qrPng) {
			setSecondsDisconnected(0);
		}
	}

	// Contador para detectar inactividad prolongada en la DB
	useEffect(() => {
		let interval: NodeJS.Timeout | null = null;

		if (status === "disconnected" && !qrPng) {
			interval = setInterval(() => {
				setSecondsDisconnected((prev) => prev + 1);
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [status, qrPng]);

	const showWarning =
		status === "disconnected" && !qrPng && secondsDisconnected >= 10;
	const lastUpdatedLabel = updatedAt
		? timeFormatter.format(new Date(updatedAt))
		: null;

	return (
		<div className="glass-panel rounded-3xl p-8 max-w-md w-full mx-auto text-center shadow-2xl relative border-outline-variant/20 bg-surface/80 backdrop-blur-xl">
			<div className="mb-6 size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shrink-0 glow-active">
				<PhoneIcon className="text-primary" size={24} />
			</div>

			<h2 className="font-display text-base font-bold text-on-surface mb-2">
				Vincular Dispositivo WhatsApp
			</h2>
			<p className="text-[11px] text-on-surface-variant/80 mb-6 px-4 leading-relaxed">
				Escaneá el código QR desde la sección{" "}
				<strong className="text-on-surface font-semibold">
					"Dispositivos vinculados"
				</strong>{" "}
				en la aplicación móvil de WhatsApp de tu teléfono.
			</p>

			{/* Caja de renderizado del QR: fondo claro neutro sólo para garantizar lectura por cámaras */}
			<div className="relative size-64 bg-[#f1ead7] border border-primary/30 rounded-2xl flex flex-col items-center justify-center overflow-hidden mb-6 p-4 mx-auto shadow-inner">
				{status === "qr" && qrPng ? (
					<Image
						src={qrPng}
						alt="WhatsApp Web QR Code"
						width={256}
						height={256}
						className="size-full object-contain animate-fade-in"
					/>
				) : status === "connecting" ? (
					<div className="flex flex-col items-center gap-3 bg-slate-900/5 p-4 rounded-xl">
						<span className="relative flex size-2">
							<span className="animate-ping absolute inline-flex size-2 rounded-full bg-primary opacity-75"></span>
							<span className="relative inline-flex rounded-full size-2 bg-primary"></span>
						</span>
						<span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest animate-pulse">
							Vinculand…
						</span>
					</div>
				) : (
					<div className="flex flex-col items-center gap-3">
						<div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin glow-active"></div>
						<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
							Esperando credenciale…
						</span>
					</div>
				)}
			</div>

			{/* Barra informativa de estado */}
			<div className="flex items-center justify-center gap-2.5 bg-surface-container-low/40 px-4 py-2 rounded-xl border border-outline-variant/10 text-[10px] mb-4 w-fit mx-auto">
				{status === "qr" && (
					<>
						<span className="relative flex size-2">
							<span className="animate-ping absolute inline-flex size-2 rounded-full bg-secondary opacity-75"></span>
							<span className="relative inline-flex rounded-full size-2 bg-secondary"></span>
						</span>
						<span className="font-semibold text-secondary uppercase tracking-wider">
							Esperando escaneo Q…
						</span>
					</>
				)}
				{status === "connecting" && (
					<>
						<span className="relative flex size-2">
							<span className="animate-ping absolute inline-flex size-2 rounded-full bg-primary opacity-75"></span>
							<span className="relative inline-flex rounded-full size-2 bg-primary"></span>
						</span>
						<span className="font-semibold text-primary uppercase tracking-wider">
							Iniciando sesió…
						</span>
					</>
				)}
				{status === "disconnected" && (
					<>
						<span className="relative flex size-2">
							<span className="relative inline-flex rounded-full size-2 bg-on-surface-variant/40"></span>
						</span>
						<span className="font-semibold text-on-surface-variant uppercase tracking-wider">
							Desconectado ({secondsDisconnected}s)
						</span>
					</>
				)}
			</div>

			{lastUpdatedLabel && (
				<p className="text-[9px] text-on-surface-variant/60 mb-4 font-mono uppercase tracking-wider">
					Última actualización: {lastUpdatedLabel}
				</p>
			)}

			{/* Alerta de inactividad de daemon */}
			{showWarning && (
				<div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-error text-[10px] leading-relaxed animate-fade-in text-left">
					⚠️ <b>¿Lleva demasiado tiempo desconectado?</b>
					<br />
					Si el código QR no se genera, asegúrate de que el daemon del bot de
					WhatsApp esté encendido en tu servidor ejecutando el script{" "}
					<code>npm run start:bot</code>.
				</div>
			)}
		</div>
	);
}
