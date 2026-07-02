"use client";

import { useState, useEffect } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PlusIcon } from "./Icons.tsx";
import type { SystemPromptRow } from "../lib/db.ts";

function sortPrompts(prompts: SystemPromptRow[]): SystemPromptRow[] {
	return [...prompts].sort((a, b) => {
		if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
		return a.id - b.id;
	});
}

export default function PromptsManager() {
	const [prompts, setPrompts] = useState<SystemPromptRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [editId, setEditId] = useState<number | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [formVisible, setFormVisible] = useState(false);

	const loadPrompts = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/prompts");
			if (res.ok) {
				const data = await res.json();
				setPrompts(sortPrompts(data));
			}
		} catch (error) {
			console.error("[prompts] Error cargando prompts:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadPrompts();
	}, []);

	const closeForm = () => {
		setFormVisible(false);
		setEditId(null);
		setTitle("");
		setContent("");
	};

	const openCreateForm = () => {
		setEditId(null);
		setTitle("");
		setContent("");
		setFormVisible(true);
	};

	const startEdit = (prompt: SystemPromptRow) => {
		setEditId(prompt.id);
		setTitle(prompt.title);
		setContent(prompt.content);
		setFormVisible(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !content.trim()) return;

		try {
			const method = editId ? "PUT" : "POST";
			const body = editId
				? { id: editId, title: title.trim(), content: content.trim() }
				: { title: title.trim(), content: content.trim() };

			const res = await fetch("/api/prompts", {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res.ok) {
				closeForm();
				await loadPrompts();
			} else {
				const data = await res.json();
				alert(data.error || "Ocurri? un error al guardar el prompt.");
			}
		} catch (error) {
			console.error("[prompts] Error guardando prompt:", error);
		}
	};

	const handleSetActive = async (id: number) => {
		try {
			const res = await fetch("/api/prompts", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "set_active", id }),
			});
			if (res.ok) {
				await loadPrompts();
			}
		} catch (error) {
			console.error("[prompts] Error activando prompt:", error);
		}
	};

	const handleDelete = async (id: number) => {
		if (!confirm("?Seguro que quer?s borrar este prompt del sistema?")) return;
		try {
			const res = await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
			if (res.ok) {
				if (editId === id) closeForm();
				await loadPrompts();
			} else {
				const data = await res.json();
				alert(data.error || "No se pudo borrar el prompt.");
			}
		} catch (error) {
			console.error("[prompts] Error borrando prompt:", error);
		}
	};

	const currentPrompt = editId
		? prompts.find((prompt) => prompt.id === editId) ?? null
		: null;

	return (
		<div className="glass-panel mx-auto flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl p-6 shadow-2xl">
			<div className="flex shrink-0 items-center justify-between gap-4 border-b border-outline-variant/10 pb-4 mb-6">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="truncate font-display text-sm font-bold text-on-surface uppercase tracking-wider">Gestión de System Prompts</h2>
					<span className="text-[10px] text-on-surface-variant/80 font-medium">Configur? el comportamiento de la IA en tiempo real</span>
				</div>

				<button
					type="button"
					onClick={openCreateForm}
					className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-on-primary transition-all duration-200 active:scale-95 glow-active"
				>
					<PlusIcon size={12} /> Nuevo Prompt
				</button>
			</div>

			<Dialog open={formVisible} onOpenChange={(open: boolean) => !open && closeForm()}>
				<DialogContent className="flex h-[min(88vh,780px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden border-outline-variant bg-surface/95 p-0 text-on-surface">
					<DialogHeader className="border-b border-outline-variant/20 px-6 py-5">
						<DialogTitle className="font-display text-sm font-bold uppercase tracking-wider text-on-surface">
							{editId ? "Editar prompt" : "Crear nuevo prompt"}
						</DialogTitle>
						<DialogDescription className="text-xs text-on-surface-variant">
							Edit? instrucciones largas con espacio real de trabajo, sin que se escondan los controles.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
						<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
							<div className="flex flex-col gap-1.5">
								<label htmlFor="prompt_title" className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">T?tulo descriptivo</label>
								<input
									id="prompt_title"
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="Ej: Asistente inmobiliario - tono formal"
									className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-xs text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
									required
								/>
							</div>

							<div className="flex min-h-[360px] flex-1 flex-col gap-1.5">
								<label htmlFor="prompt_content" className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Instrucciones del sistema</label>
								<textarea
									id="prompt_content"
									value={content}
									onChange={(e) => setContent(e.target.value)}
									placeholder="Ej: Eres un asistente virtual que responde de forma amable..."
									className="min-h-[360px] flex-1 resize-none rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 font-mono text-xs leading-relaxed text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
									required
								/>
							</div>
						</div>

						<div className="flex shrink-0 flex-col-reverse gap-3 border-t border-outline-variant/20 bg-surface-container-low/50 px-6 py-4 sm:flex-row sm:justify-end">
							{currentPrompt && !currentPrompt.is_active && (
								<button
									type="button"
									onClick={() => handleSetActive(currentPrompt.id)}
									className="rounded-xl border border-primary px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-primary transition-all duration-200 hover:bg-primary/10"
								>
									Activar prompt
								</button>
							)}
							{currentPrompt && !currentPrompt.is_active && (
								<button
									type="button"
									onClick={() => handleDelete(currentPrompt.id)}
									className="rounded-xl border border-error/40 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-error transition-all duration-200 hover:bg-error/15"
								>
									Eliminar
								</button>
							)}
							<button
								type="button"
								onClick={closeForm}
								className="rounded-xl border border-outline-variant/30 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant transition-all duration-200 hover:bg-surface-bright hover:text-on-surface"
							>
								Cancelar
							</button>
							<button
								type="submit"
								className="rounded-xl bg-primary px-5 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-on-primary transition-all duration-200 active:scale-95 glow-active"
							>
								{editId ? "Actualizar" : "Crear"}
							</button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			<div className="flex-1 overflow-y-auto pr-1">
				{loading && prompts.length === 0 ? (
					<div className="flex items-center justify-center p-8 text-xs text-on-surface-variant/70 font-medium">
						Cargando prompt?
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{prompts.map((prompt) => (
							<button
								type="button"
								key={prompt.id}
								onClick={() => startEdit(prompt)}
								aria-label={`Editar prompt ${prompt.title}`}
								className={`rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
									prompt.is_active
										? "border-primary bg-primary/5 glow-active"
										: "border-outline-variant/10 bg-surface-container-low/20 hover:border-outline-variant/30"
								}`}
							>
								<h4 className="truncate text-xs font-bold text-on-surface">{prompt.title}</h4>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
