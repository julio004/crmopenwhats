import type { Metadata } from "next";
import HomeClient from "./HomeClient.tsx";

export const metadata: Metadata = {
	title: "Dashboard - WOpen",
	description: "Gestioná tus conversaciones, prompts y configuraciones de WOpen.",
};

export default function Home() {
	return <HomeClient />;
}
