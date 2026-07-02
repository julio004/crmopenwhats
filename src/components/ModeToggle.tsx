"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
	conversationId: number;
	currentMode: "AI" | "HUMAN";
	onModeChange: (newMode: "AI" | "HUMAN") => void;
}

export default function ModeToggle({
	conversationId,
	currentMode,
	onModeChange,
}: ModeToggleProps) {
	const [loading, setLoading] = useState(false);

	const handleSwitchChange = async (isHumanMode: boolean) => {
		if (loading) return;
		const nextMode = isHumanMode ? "HUMAN" : "AI";
		if (nextMode === currentMode) return;

		setLoading(true);
		try {
			const res = await fetch(`/api/mode/${conversationId}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: nextMode }),
			});
			if (res.ok) {
				onModeChange(nextMode);
			} else {
				console.error("[toggle] Error cambiándole el modo al bot.");
			}
		} catch (error) {
			console.error("[toggle] Fallo de red cambiándole el modo:", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface/70 px-2 py-1 shadow-sm">
			<span
				className={cn(
					"font-display text-[10px] font-bold uppercase tracking-wider transition-colors",
					currentMode === "AI" ? "text-primary" : "text-on-surface-variant",
				)}
			>
				IA
			</span>
			<Switch
				isSelected={currentMode === "HUMAN"}
				isDisabled={loading}
				onChange={handleSwitchChange}
				className="gap-0"
				aria-label={
					currentMode === "HUMAN"
						? "Cambiar conversación a modo IA"
						: "Cambiar conversación a modo humano"
				}
			>
				<span className="sr-only">
					{currentMode === "HUMAN" ? "Modo humano" : "Modo IA"}
				</span>
			</Switch>
			<span
				className={cn(
					"font-display text-[10px] font-bold uppercase tracking-wider transition-colors",
					currentMode === "HUMAN"
						? "text-primary"
						: "text-on-surface-variant",
				)}
			>
				Humano
			</span>
		</div>
	);
}
