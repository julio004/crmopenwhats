"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleLogin = async (e: { preventDefault: () => void }) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			if (res.ok) {
				router.push("/");
				router.refresh();
			} else {
				const data = await res.json();
				setError(data.error || "Credenciales inválidas");
			}
		} catch (err) {
			setError("Error de conexión");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-black flex items-center justify-center p-4">
			<div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
				<div className="text-center mb-8 flex flex-col items-center">
					<Image
						src="/logoWOPEN.png"
						width={96}
						height={96}
						className="mb-4 object-contain"
						alt="Logo WOpen"
						priority
						unoptimized
					/>
					<h1 className="text-2xl font-bold text-white mb-2">
						Acceso al Sistema
					</h1>
					<p className="text-sm text-zinc-400">
						Panel de Administración - WOpen
					</p>
				</div>

				{error && (
					<div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
						{error}
					</div>
				)}

				<form onSubmit={handleLogin} className="space-y-4">
					<div>
						<label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1">
							Correo Electrónico
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
							placeholder="admin@ejemplo.com"
							required
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1">
							Contraseña
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
							placeholder="••••••••"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-emerald-400 text-emerald-950 font-bold rounded-xl py-2.5 mt-4 hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(52,211,153,0.25)]"
					>
						{loading ? "Entrando..." : "Ingresar"}
					</button>
				</form>
			</div>
		</div>
	);
}
