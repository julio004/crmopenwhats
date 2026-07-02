import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: [
		"@whiskeysockets/baileys",
		"pino",
		"@tailwindcss/postcss",
		"tailwindcss",
		"@tailwindcss/node",
		"@tailwindcss/oxide",
		"lightningcss"
	],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.whatsapp.net",
			},
		],
	},
};

export default nextConfig;
