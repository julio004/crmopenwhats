import type { Metadata } from "next";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

export const metadata: Metadata = {
	title: "WOpen",
	description: "Administrá tus conversaciones de WhatsApp y automatizaciones con IA.",
	icons: {
		icon: "/favicon.ico",
		shortcut: "/favicon.ico",
		apple: "/logoWOPEN.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="es">
			<head>
				<meta charSet="utf-8" />
			</head>
			<body>
				<MotionProvider>{children}</MotionProvider>
			</body>
		</html>
	);
}
