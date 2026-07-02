import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function readProjectFile(filePath: string): string {
	return readFileSync(path.join(root, filePath), "utf8");
}

function readJson<T>(filePath: string): T {
	return JSON.parse(readProjectFile(filePath)) as T;
}

describe("shadcn/ui redesign foundation contract", () => {
	it("declares a Tailwind v4 shadcn configuration with app aliases", () => {
		const config = readJson<{
			rsc: boolean;
			tsx: boolean;
			tailwind: {
				config: string;
				css: string;
				baseColor: string;
				cssVariables: boolean;
			};
			aliases: Record<string, string>;
			style: string;
		}>("components.json");

		assert.equal(config.rsc, true);
		assert.equal(config.tsx, true);
		assert.equal(config.tailwind.config, "");
		assert.equal(config.tailwind.css, "src/app/globals.css");
		assert.equal(config.style, "radix-nova");
		assert.equal(config.tailwind.baseColor, "neutral");
		assert.equal(config.tailwind.cssVariables, true);
		assert.deepEqual(config.aliases, {
			components: "@/components",
			hooks: "@/hooks",
			lib: "@/lib",
			ui: "@/components/ui",
			utils: "@/lib/utils",
		});
	});

	it("configures the @/* TypeScript import alias", () => {
		const tsconfig = readJson<{
			compilerOptions: { baseUrl?: string; paths?: Record<string, string[]> };
		}>("tsconfig.json");

		assert.equal(tsconfig.compilerOptions.baseUrl, undefined);
		assert.deepEqual(tsconfig.compilerOptions.paths?.["@/*"], ["./src/*"]);
	});

	it("provides the shadcn class name utility", () => {
		const utils = readProjectFile("src/lib/utils.ts");

		assert.match(utils, /from "clsx"/);
		assert.match(utils, /from "tailwind-merge"/);
		assert.match(utils, /export function cn/);
		assert.match(utils, /twMerge\(clsx\(inputs\)\)/);
	});

	it("wraps the app with a reduced-motion-aware MotionProvider", () => {
		const provider = readProjectFile("src/components/MotionProvider.tsx");
		const layout = readProjectFile("src/app/layout.tsx");

		assert.match(provider, /^"use client";?/);
		assert.match(provider, /import \{ MotionConfig \} from "framer-motion"/);
		assert.match(provider, /reducedMotion="user"/);
		assert.match(readProjectFile("src/app/globals.css"), /@import "tw-animate-css"/);
		assert.match(layout, /import \{ MotionProvider \} from "@\/components\/MotionProvider"/);
		assert.match(layout, /<MotionProvider>\s*\{children\}\s*<\/MotionProvider>/);
		assert.match(layout, /<html lang="es">/);
	});

	it("creates the selected shadcn primitives for the first redesign slice", () => {
		const requiredFiles = [
			"src/components/ui/avatar.tsx",
			"src/components/ui/badge.tsx",
			"src/components/ui/button.tsx",
			"src/components/ui/card.tsx",
			"src/components/ui/dialog.tsx",
			"src/components/ui/dropdown-menu.tsx",
			"src/components/ui/input.tsx",
			"src/components/ui/neon-button.tsx",
			"src/components/ui/scroll-area.tsx",
			"src/components/ui/separator.tsx",
			"src/components/ui/sheet.tsx",
			"src/components/ui/skeleton.tsx",
			"src/components/ui/switch.tsx",
			"src/components/ui/tabs.tsx",
			"src/components/ui/textarea.tsx",
		];

		for (const filePath of requiredFiles) {
			assert.equal(existsSync(path.join(root, filePath)), true, filePath);
		}

		const dialog = readProjectFile("src/components/ui/dialog.tsx");
		assert.match(dialog, /from "radix-ui"/);
		assert.match(dialog, /data-slot="dialog-content"/);
		assert.match(dialog, /data-open:animate-in/);

		const switchComponent = readProjectFile("src/components/ui/switch.tsx");
		assert.match(switchComponent, /from "react-aria-components"/);
		assert.match(switchComponent, /composeRenderProps/);
		assert.match(switchComponent, /group-data-\[selected\]:bg-primary/);

		const neonButton = readProjectFile("src/components/ui/neon-button.tsx");
		assert.match(neonButton, /class-variance-authority/);
		assert.match(neonButton, /group-hover:opacity-100/);
	});

	it("uses the design-system foundation in chat message bubbles", () => {
		const bubble = readProjectFile("src/components/MessageBubble.tsx");

		assert.match(bubble, /from "@\/components\/ui\/card"/);
		assert.match(bubble, /from "@\/components\/ui\/badge"/);
		assert.match(bubble, /from "framer-motion"/);
		assert.match(bubble, /<audio/);
		assert.match(bubble, /preload="metadata"/);
		assert.match(bubble, /Nota de voz/);
		assert.match(bubble, /isMediaPlaceholder/);
		assert.match(bubble, /!\s*isMediaPlaceholder\(content, media_type\)/);
	});

	it("uses a single header profile trigger instead of a separate profile and logout icon", () => {
		const header = readProjectFile("src/components/DashboardHeader.tsx");

		assert.match(header, /aria-label="Abrir perfil de WhatsApp"/);
		assert.match(header, /normalizeProfileStatus/);
		assert.match(header, /\{profileStatus\}/);
		assert.doesNotMatch(header, /\{botProfile\.status\}/);
		assert.doesNotMatch(header, />\s*Perfil\s*<\/button>/);
		assert.doesNotMatch(header, /aria-label="Cerrar Sesión del Panel"/);
	});

	it("removes decorative sidebar and header status labels", () => {
		const header = readProjectFile("src/components/DashboardHeader.tsx");
		const sidebar = readProjectFile("src/components/Sidebar.tsx");

		assert.doesNotMatch(header, /Consola de Control/);
		assert.doesNotMatch(header, /Motor IA Activo/);
		assert.doesNotMatch(sidebar, /Sistema/);
		assert.doesNotMatch(sidebar, /Online/);
	});

	it("keeps chat contrast readable and image previews high fidelity", () => {
		const globals = readProjectFile("src/app/globals.css");
		const bubble = readProjectFile("src/components/MessageBubble.tsx");

		assert.match(globals, /--on-surface-variant: #A7B4BD;/);
		assert.match(globals, /--border: #31424D;/);
		assert.doesNotMatch(bubble, /max-w-\[480px\]/);
		assert.doesNotMatch(bubble, /max-h-\[480px\]/);
		assert.match(bubble, /object-contain/);
		assert.match(bubble, /Ver imagen completa de WhatsApp/);
	});

	it("uses a stable latest-message order for sidebar previews", () => {
		const db = readProjectFile("src/lib/db.ts");
		const list = readProjectFile("src/components/ConversationList.tsx");
		const bubble = readProjectFile("src/components/MessageBubble.tsx");

		assert.match(db, /ORDER BY created_at DESC, id DESC/);
		assert.match(list, /formatConversationPreview/);
		assert.match(list, /last_message_role/);
		assert.match(list, /Modo IA/);
		assert.match(list, /Tú:/);
		assert.doesNotMatch(list, /Vos:/);
		assert.match(bubble, /label: "Tú"/);
		assert.doesNotMatch(bubble, /label: "Agente"/);
	});

	it("persists the current UI location across browser refreshes", () => {
		const home = readProjectFile("src/app/HomeClient.tsx");

		assert.match(home, /UI_STATE_STORAGE_KEY/);
		assert.match(home, /readStoredUiState/);
		assert.match(home, /window\.localStorage\.getItem\(UI_STATE_STORAGE_KEY\)/);
		assert.match(home, /window\.localStorage\.setItem\(UI_STATE_STORAGE_KEY, JSON\.stringify\(uiState\)\)/);
		assert.match(home, /selectedId/);
		assert.match(home, /showArchived/);
	});

	it("keeps active prompts first and edits prompts in a large responsive dialog", () => {
		const prompts = readProjectFile("src/components/PromptsManager.tsx");
		const db = readProjectFile("src/lib/db.ts");

		assert.match(db, /ORDER BY is_active DESC, id ASC/);
		assert.match(prompts, /function sortPrompts/);
		assert.match(prompts, /<Dialog open=\{formVisible\}/);
		assert.match(prompts, /<DialogTitle/);
		assert.match(prompts, /w-\[min\(96vw,1100px\)\]/);
		assert.match(prompts, /h-\[min\(88vh,780px\)\]/);
		assert.match(prompts, /min-h-\[360px\] flex-1 resize-none/);
		assert.match(prompts, /aria-label=\{`Editar prompt \$\{prompt\.title\}`\}/);
		assert.doesNotMatch(prompts, /rows=\{8\}/);
		assert.doesNotMatch(prompts, /\{prompt\.content\}/);
		assert.doesNotMatch(prompts, /max-h-32 overflow-y-auto whitespace-pre-wrap/);
		assert.doesNotMatch(prompts, /EditIcon/);
		assert.doesNotMatch(prompts, /TrashIcon/);
		assert.doesNotMatch(prompts, /RobotIcon/);
	});

	it("turns automations into safe saved flows instead of a decorative canvas", () => {
		const automations = readProjectFile("src/components/AutomationsOverview.tsx");
		const api = readProjectFile("src/app/api/automations/route.ts");

		assert.match(automations, /fetch\("\/api\/automations"\)/);
		assert.match(automations, /Bloques seguros, sin SQL libre/);
		assert.match(automations, /Mensaje entrante/);
		assert.match(automations, /message_contains/);
		assert.match(automations, /send_whatsapp/);
		assert.doesNotMatch(automations, /cursor-grab/);
		assert.doesNotMatch(automations, /node_01/);
		assert.match(api, /saveAutomation/);
		assert.match(api, /listAutomations/);
		assert.match(api, /setAutomationEnabled/);
	});

	it("keeps CRM profile, deals, and documentation screens usable without clipping", () => {
		const home = readProjectFile("src/app/HomeClient.tsx");
		const sidebar = readProjectFile("src/components/Sidebar.tsx");
		const panel = readProjectFile("src/components/ConversationPanel.tsx");
		const tasks = readProjectFile("src/components/TasksBoard.tsx");
		const docs = readProjectFile("src/components/CrmDocumentation.tsx");

		assert.match(home, /import CrmDocumentation/);
		assert.match(home, /activeTab === "docs"/);
		assert.match(home, /id="conversation-profile-sidebar-root"/);
		assert.match(sidebar, /value: "docs", label: "Document Review"/);
		assert.match(panel, /from "react-dom"/);
		assert.match(panel, /createPortal/);
		assert.match(panel, /conversation-profile-sidebar-root/);
		assert.match(panel, /from "@\/components\/ui\/neon-button"/);
		assert.doesNotMatch(panel, /absolute inset-0 z-40 flex justify-end bg-black\/20/);
		assert.match(panel, /flex min-h-0 flex-1/);
		assert.match(panel, /w-\[min\(420px,38vw\)\]/);
		assert.match(panel, /rounded-2xl border border-outline-variant\/30/);
		assert.doesNotMatch(panel, /border-l border-outline-variant\/30/);
		assert.match(tasks, /overflow-y-auto/);
		assert.match(tasks, /h-\[24rem\]/);
		assert.match(docs, /Manual operativo del CRM/);
		assert.match(docs, /modo IA\/Humano/);
		assert.match(docs, /Sugerencias IA/);
		assert.match(docs, /Automatizaciones seguras/);
	});

	it("uses a persisted switch for AI/HUMAN mode instead of local-only buttons", () => {
		const modeToggle = readProjectFile("src/components/ModeToggle.tsx");
		const panel = readProjectFile("src/components/ConversationPanel.tsx");

		assert.match(modeToggle, /from "@\/components\/ui\/switch"/);
		assert.match(modeToggle, /isSelected=\{currentMode === "HUMAN"\}/);
		assert.match(modeToggle, /onChange=\{handleSwitchChange\}/);
		assert.match(modeToggle, /fetch\(`\/api\/mode\/\$\{conversationId\}`/);
		assert.doesNotMatch(modeToggle, />\s*.*MODO IA.*\s*<\/button>[\s\S]*>\s*.*HUMANO.*\s*<\/button>/);
		assert.doesNotMatch(panel, /onClick=\{\(\) => onModeChanged\("HUMAN"\)\}/);
		assert.match(panel, /<ModeToggle[\s\S]*currentMode=\{conversation\.mode\}/);
	});
});
