import type { Metadata } from "next";
import LoginForm from "./LoginForm.tsx";

export const metadata: Metadata = {
	title: "Iniciar sesión - WOpen",
	description: "Iniciá sesión en el panel de administración de WOpen.",
};

export default function LoginPage() {
	return <LoginForm />;
}
