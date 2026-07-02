# CONTEXTO DEL PROYECTO

Vas a construir un agente de WhatsApp local que se conecta a un número
real vía Baileys (no Meta API, no Twilio) y responde mensajes con un
LLM (DeepSeek). El bot debe soportar capacidades multimodales: poder procesar texto, pero también leer imágenes y transcribir notas de voz, enviando estos medios a la API correspondiente de DeepSeek. Incluye un dashboard local para ver las conversaciones, leer el
historial, intervenir manualmente y togglear cada chat entre modo IA
(responde el bot) y modo Humano (responde la persona desde el
dashboard). También se debe incluir una pestaña en el dashboard para gestionar "System Prompts", permitiendo al usuario crear, editar, guardar y seleccionar qué prompt usar de forma dinámica. Además, el bot debe tener un sistema automático de seguimiento (follow-ups) para usuarios que dejan de responder.

Todo corre de manera orquestada con Docker Compose. La data vive en PostgreSQL. La
sesión de WhatsApp Web la guarda Baileys en una carpeta local (mapeada a un volumen en Docker).

# OBJETIVO FINAL

Cuando termines, debe funcionar esto:

1. El proyecto se levanta con `docker-compose up --build`. Esto iniciará tanto la base de datos PostgreSQL como el servicio de la aplicación (Next.js + Bot). Si NO hay sesión guardada en
   `./auth/`, queda esperando a que el usuario escanee el QR desde
   el frontend.
2. El servicio web levanta el dashboard Next.js accesible en localhost:3000.
   Cuando el usuario abre la página por primera vez:
   - Si NO hay sesión Baileys conectada, el dashboard muestra una
     pantalla "Conectar número" con el QR renderizado como imagen
     PNG en grande.
   - Cuando Baileys detecta la conexión exitosa, la pantalla
     transiciona automáticamente al dashboard real (lista de
     conversaciones + panel) sin que el usuario tenga que recargar.
   - Header del dashboard muestra el número conectado y un botón
     "Desconectar" que borra la sesión y vuelve a la pantalla de QR.
3. Después del escaneo, Baileys guarda la sesión en `./auth/`. En
   reinicios posteriores del proceso bot, NO se vuelve a pedir QR
   mientras la sesión siga viva en WhatsApp.
4. Cuando alguien escribe al WhatsApp del usuario:
   - Tratar cada mensaje válido como un **turno de procesamiento**: persistir primero, leer historial reciente, decidir modo, responder si corresponde y cerrar el turno limpiando estado transitorio. Cerrar el turno NO significa cerrar Baileys, borrar `./auth/` ni pedir QR nuevo.
   - Guardar el mensaje en PostgreSQL antes de cualquier llamada a DeepSeek.
   - Si el mensaje viene del cliente, guardarlo como `role='user'`. Si viene desde el WhatsApp conectado del dueño (`fromMe === true`), guardarlo como `role='human'` y usarlo para controles administrativos.
   - **Palabras configurables de control del dueño:** desde Ajustes se configuran una palabra para apagar/bloquear el bot por chat y una palabra para activarlo, por ejemplo `ok.`. Solo funcionan si las escribe el dueño desde su WhatsApp. Si las escribe un cliente, son texto normal y NO cambian el modo administrativo.
   - Si el dueño envía la palabra de apagado, el chat pasa a modo `HUMAN`, el bot no responde y se registra/notifica el cambio.
   - Si el dueño envía la palabra de activación, el chat vuelve a modo `AI`. Si el dueño responde en un chat `HUMAN` después de 3 días de intervención/inactividad, también debe reactivarse el bot para ese chat y registrarse el evento.
   - Si el mensaje contiene imagen o audio, Baileys debe descargar el media y enviarlo a DeepSeek para su análisis o transcripción antes de generar contexto.
   - Si la conversación está en modo `AI`, llamar a DeepSeek con el historial reciente persistido y el system prompt ACTIVO seleccionado en la base de datos.
   - **Herramienta Humano:** si DeepSeek detecta que la conversación necesita una persona —cliente listo para cerrar, pide humano/asesor, está molesto, hay objeción crítica o falta información que el bot no debe inventar— debe devolver una señal de handoff. El sistema cambia el chat a `HUMAN`, apaga el bot para ese chat, guarda el evento y manda una notificación por Telegram al dueño.
   - **Respuesta en partes:** El bot no debe responder en un solo bloque gigante de texto. Debe solicitar a DeepSeek que estructure la respuesta en un JSON con partes (`part_1`, `part_2`, `part_3`) y opcionalmente `handoff`. El bot enviará cada parte como un mensaje individual, aplicando un `delay` proporcional a la longitud del texto (ej. `2000ms + (text.length * 10)`) para simular que está escribiendo de forma natural.
   - Si la conversación está en modo `HUMAN`, solo guardar y NO responder automáticamente.
5. Dashboard real (después de conectar):
   - lista de conversaciones a la izquierda (ordenadas por último
     mensaje, más reciente arriba);
   - panel de conversación a la derecha (mensajes user/bot/human con
     timestamp, soportando la visualización de si hubo imagen o audio);
   - toggle AI/HUMAN por chat (arriba del panel derecho);
   - input de texto + botón "Enviar" cuando el chat está en HUMAN;
   - botón "Borrar" en el panel para borrar una conversación;
   - polling cada 2 segundos a un endpoint que devuelve mensajes
     nuevos.
6. Pestaña de Prompts en el Dashboard:
   - CRUD (Crear, Leer, Actualizar, Borrar) para System Prompts.
   - Selector (Radio button o Dropdown) para marcar un prompt específico como "Activo".
7. Pestaña de Ajustes:
   - Permite configurar `bot_off_keyword` y `bot_on_keyword` por defecto global.
   - Permite configurar sensibilidad de mayúsculas/minúsculas y coincidencia exacta.
   - Permite configurar días para reactivación automática por respuesta del dueño (default 3), ventana de follow-ups, máximo de intentos y bloqueo fuera de 24h.
   - Permite configurar Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` vía entorno; UI solo muestra estado/configuración no secreta).
8. **Sistema Automático de Seguimientos (Follow-Ups):**
   - El proceso bot debe ejecutar una tarea programada (cron) periódicamente (ej. cada X horas).
   - Debe buscar conversaciones en modo `AI` donde el último mensaje visible haya sido del bot (`assistant`), el cliente no haya respondido después, no exista cola/lock/debounce activo, haya pasado el tiempo mínimo configurado y el número de intentos sea menor a 2.
   - El bot enviará a DeepSeek el historial de la conversación pidiendo que decida si amerita un seguimiento con JSON estricto: `{ "respuesta": "SI" | "NO", "mensaje": "..." }`.
   - Si DeepSeek dice `SI`, el mensaje es válido y la conversación está dentro de la ventana permitida de 24 horas desde el último mensaje del cliente, se envía, se guarda en BD y se incrementa el contador.
   - Si pasaron más de 24 horas y la configuración bloquea mensajes free-form fuera de ventana, NO enviar seguimiento automático: registrar bloqueo por riesgo de spam/política y opcionalmente notificar/derivar a humano.
   - Si el cliente responde a un seguimiento, el flujo de seguimiento se cancela/reinicia y vuelve a ejecutarse el flujo normal de mensaje entrante.

# STACK OBLIGATORIO

- Next.js 16 App Router + TypeScript + React 19. Turbopack default.
- Tailwind CSS 4
- @whiskeysockets/baileys 6.7+ — cliente WhatsApp Web vía QR
- `pg` (node-postgres) — base de datos PostgreSQL
- Docker y Docker Compose — orquestación de la aplicación y la BD
- pino — logger requerido por Baileys (level: silent)
- node-cron (o setInterval robusto) — para programar las tareas de seguimiento (follow-ups)
- `ioredis` — cliente para Redis
- qrcode — genera el QR como Data URL (PNG base64) en el server
- qrcode-terminal — fallback ASCII en la consola del bot
- Usar fetch nativo o cualquier cliente HTTP para llamar a la API de DeepSeek. NO usar el SDK de OpenAI ni nada de GPT.
- tsx — para ejecutar scripts TS directamente
- concurrently — para levantar bot + Next.js juntos en producción
- Node.js 20+ (Baileys, Next.js 16, Tailwind 4 lo requieren)

NO usar Prisma, Drizzle, Supabase, WebSockets, Vercel,
Meta API oficial ni Twilio.

# ESTRUCTURA DE CARPETAS

```
agente-whatsapp/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # renderiza ConnectionGate
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── connection/
│   │       │   ├── status/route.ts   # GET estado + QR PNG
│   │       │   └── disconnect/route.ts
│   │       ├── conversations/
│   │       │   ├── route.ts          # GET lista
│   │       │   └── [conversationId]/route.ts  # DELETE
│   │       ├── messages/
│   │       │   └── [conversationId]/route.ts  # GET + POST
│   │       ├── mode/
│   │       │   └── [conversationId]/route.ts  # POST cambia AI/HUMAN
│   │       ├── settings/
│   │       │   └── route.ts          # GET / PUT keywords, followups y ventana 24h
│   │       └── prompts/
│   │           └── route.ts          # GET / POST / PUT para system prompts
│   ├── components/
│   │   ├── ConnectionGate.tsx
│   │   ├── QRScreen.tsx
│   │   ├── DashboardHeader.tsx
│   │   ├── ConversationList.tsx
│   │   ├── ConversationPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ModeToggle.tsx
│   │   ├── PromptsManager.tsx
│   │   └── SettingsPanel.tsx
│   └── lib/
│       ├── db.ts
│       ├── Deepseek.ts
│       ├── system-prompt.ts
│       └── baileys/
│           ├── client.ts
│           └── handler.ts
├── scripts/
│   ├── env-loader.ts                 # CRÍTICO: side-effect import
│   ├── followups-cron.ts             # CRÍTICO: Tarea programada para seguimientos
│   └── start-bot.ts
├── data/                             # gitignored, runtime
├── auth/                             # gitignored, sesión Baileys
├── .env.local
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── README.md
```

# VARIABLES DE ENTORNO

`.env.example`:
```
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
DATABASE_URL=postgresql://user:password@db:5432/whatsapp_bot
REDIS_URL=redis://redis:6379
TELEGRAM_BOT_TOKEN=123456:abc...
TELEGRAM_CHAT_ID=123456789
```

Exige al usuario el uso de una cuenta de DeepSeek de pago (con saldo recargado). Los tiers gratuitos o de prueba tienen rate limits muy estrictos y van a fallar en producción real con error 429. NO uses OpenAI ni alternativas gratuitas.

Telegram se usa solo para notificar al dueño cuando la herramienta Humano apaga el bot o cuando un seguimiento queda bloqueado por ventana 24h. Si `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID` faltan, el sistema debe registrar el evento en logs/BD y continuar sin romper el turno.

# PACKAGE.JSON

Campo `engines` OBLIGATORIO:
```json
"engines": {
  "node": ">=20.9.0"
}
```

Scripts:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "start:bot": "tsx scripts/start-bot.ts",
  "start:all": "concurrently --kill-others --names BOT,WEB --prefix-colors yellow,cyan \"npm run start:bot\" \"npm run start\""
}
```

`tsx` y `concurrently` van en `dependencies` (no devDependencies),
porque si no fallan en producción cuando el buildpack ejecuta
`npm ci --omit=dev`.

# SCHEMA POSTGRESQL

`src/lib/db.ts` debe inicializar el pool de conexiones de `pg` usando
`process.env.DATABASE_URL` y ejecutar este DDL al arrancar:

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  jid TEXT UNIQUE,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  mode_reason TEXT,
  mode_changed_at TIMESTAMP WITH TIME ZONE,
  mode_changed_by TEXT CHECK(mode_changed_by IN ('system','owner','dashboard','assistant')),
  followup_attempts INTEGER NOT NULL DEFAULT 0,
  last_followup_at TIMESTAMP WITH TIME ZONE,
  followup_blocked_at TIMESTAMP WITH TIME ZONE,
  followup_blocked_reason TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_user_message_at TIMESTAMP WITH TIME ZONE,
  last_assistant_message_at TIMESTAMP WITH TIME ZONE,
  last_human_message_at TIMESTAMP WITH TIME ZONE,
  last_owner_intervention_at TIMESTAMP WITH TIME ZONE,
  last_ai_reactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_prompts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insertar un prompt por defecto si la tabla está vacía
INSERT INTO system_prompts (title, content, is_active)
VALUES ('Asistente Default', 'Eres un asistente virtual amable...', TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT,
  direction TEXT CHECK(direction IN ('inbound','outbound')) NOT NULL,
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT CHECK(media_type IN ('text', 'image', 'audio', 'unknown')) DEFAULT 'text',
  source TEXT CHECK(source IN ('whatsapp','dashboard','bot','scheduler','system')) NOT NULL DEFAULT 'whatsapp',
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  raw_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id
  ON messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected')) NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO connection_state (id, status)
VALUES (1, 'disconnected')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS outbox (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('bot_off_keyword', '"bot off"'::jsonb),
  ('bot_on_keyword', '"ok."'::jsonb),
  ('keyword_match_mode', '"exact"'::jsonb),
  ('keyword_case_sensitive', 'false'::jsonb),
  ('owner_reactivation_days', '3'::jsonb),
  ('debounce_ms', '12000'::jsonb),
  ('processing_lock_ttl_ms', '90000'::jsonb),
  ('dedupe_ttl_seconds', '86400'::jsonb),
  ('conversation_queue_ttl_seconds', '300'::jsonb),
  ('followup_interval_hours', '6'::jsonb),
  ('followup_min_hours_after_assistant', '24'::jsonb),
  ('followup_max_attempts', '2'::jsonb),
  ('whatsapp_freeform_window_hours', '24'::jsonb),
  ('block_outside_24h_followups', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_role TEXT CHECK(actor_role IN ('user','assistant','human','system')) NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conv_created
  ON conversation_events(conversation_id, created_at);
```

`connection_state` es una fila única que sirve de "buzón" entre
el proceso bot y el de Next.js (corren en procesos separados).
`outbox` también — los mensajes humanos del dashboard se encolan
ahí, el bot los lee cada 2s y los envía vía Baileys.

Helpers que `db.ts` debe exportar:
- `getOrCreateConversation(phone, jid?, name?)` — `{ id, phone, jid, name, mode, ... }`.
- `getConversationById(id)` — `Conversation | null`.
- `insertMessageAndTouchConversation(input)` — TRANSACCIONAL: inserta en `messages` y actualiza `last_message_at`, `last_user_message_at`, `last_assistant_message_at` o `last_human_message_at` según `role`. Si `role='user'`, reinicia/cancela `followup_attempts` porque el cliente volvió a responder.
- `messageExistsByWhatsappId(whatsappMessageId)` — respaldo persistente para dedupe además de Redis.
- `getPendingFollowUps({ minHoursAfterAssistant, maxAttempts, freeformWindowHours })` — trae conversaciones en `AI` donde el último mensaje visible es `assistant`, no hay `user` posterior, no superan intentos y respetan ventana 24h si aplica.
- `incrementFollowUpAttempt(conversationId)` y `markFollowUpBlocked(conversationId, reason)`.
- `getMessages(conversationId, limit = 50)`.
- `getRecentHistory(conversationId, limit = 20)` — devuelve roles `user`, `assistant`, `human` con timestamps; para el LLM puede mapear `human` como contexto del asesor, no como respuesta del bot.
- `setMode(conversationId, mode, { reason, changedBy })` — registra `mode_reason`, `mode_changed_at`, `mode_changed_by` y opcionalmente `conversation_events`.
- `recordConversationEvent(conversationId, eventType, actorRole, reason?, metadata?)`.
- `getSettings()` / `setSetting(key, value)` — incluye keywords owner-only, TTLs, 3 días, follow-ups y ventana 24h.
- `listConversations()` — incluye modo, timestamps, intentos de seguimiento y último evento relevante.
- `getConnectionState()` y `setConnectionState({status, qr_string?, phone?})`.
- `enqueueOutbox(conversationId, phone, content)`.
- `getPendingOutbox(limit = 20)`.
- `markOutboxSent(id)`.
- `deleteConversation(id)`.
- `getActiveSystemPrompt()` — Obtiene el texto del prompt configurado como activo.
- `getAllSystemPrompts()`, `saveSystemPrompt(title, content)`, `setActiveSystemPrompt(id)`.
- `notifyTelegramHumanNeeded({ conversation, reason, lastMessage })` — envía notificación al dueño usando `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` cuando la herramienta Humano apaga el bot.

# ⚠️ LECCIÓN APRENDIDA — CARGA DE .env.local EN start-bot.ts

`scripts/start-bot.ts` es un proceso separado de Next.js. Necesita
leer `.env.local` manualmente. El bug clásico:

```typescript
// ❌ MAL — los `import` se hoistean al top y corren ANTES del loadEnv()
function loadEnv() { ... }
loadEnv();
import { generateReply } from "../src/lib/Deepseek"; // ya leyó undefined
```

ES modules hoistean TODOS los imports al inicio del archivo, sin
importar dónde los escribiste. Si `Deepseek.ts` lee
`process.env.DEEPSEEK_API_KEY` en su top-level, va a leer
`undefined` porque el loadEnv() todavía no se ejecutó.

**Solución:** poner el loader en su propio módulo e importarlo PRIMERO:

```typescript
// scripts/env-loader.ts — solo side effects, sin exports
import path from "node:path";
import fs from "node:fs";
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
```

```typescript
// scripts/start-bot.ts — env-loader DEBE ser el primer import
import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import { ... } from "../src/lib/db";
// ...
```

Este orden funciona porque los imports siguen orden de declaración
DENTRO del bloque hoisted. Como `env-loader` no tiene exports,
solo ejecuta side effects (poblar process.env).

# ⚠️ LECCIONES APRENDIDAS — CONFIGURACIÓN DE BAILEYS

Estas decisiones son CRÍTICAS. Sin ellas el bot entra en loops o
no conecta:

### 1. fetchLatestBaileysVersion() OBLIGATORIO

WhatsApp rechaza versiones desactualizadas con error code 405.
Baileys hardcodea una versión que queda vieja entre releases.
SIEMPRE descarga la más nueva en runtime:

```typescript
import { fetchLatestBaileysVersion } from "@whiskeysockets/baileys";

let version: [number, number, number] | undefined;
try {
  const fetched = await fetchLatestBaileysVersion();
  version = fetched.version;
} catch (err) {
  console.warn("[bot] No se pudo obtener última versión:", err);
}

const sock = makeWASocket({ version, ... });
```

### 2. Browser fingerprint conocido (NO custom)

Si pasas un `browser: ['Mi App', 'Chrome', '1.0']` custom, WhatsApp
trata la sesión como dispositivo desconocido y dispara code 440
(connectionReplaced) en loop apenas conectas. Usa SIEMPRE
`Browsers.macOS('Desktop')`:

```typescript
import { Browsers } from "@whiskeysockets/baileys";

const sock = makeWASocket({
  version,
  auth: state,
  logger,
  browser: Browsers.macOS("Desktop"),  // ← crítico
  markOnlineOnConnect: false,
  syncFullHistory: false,
});
```

### 3. NO uses `printQRInTerminal: true`

Está deprecated en Baileys 6.7+. Va a tirar warning y eventualmente
falla. Maneja el QR tú: escucha el evento `connection.update`,
recibes el `qr` raw string, haces lo que quieras (DB + ASCII con
qrcode-terminal).

### 4. State machine del connection.update

Reglas estrictas para evitar bugs sutiles:

- Cuando llega `qr` (string): `setConnectionState({status: 'qr', qr_string: qr, phone: null})`.
- Cuando `connection === 'connecting'`: SOLO setear `'connecting'`
  si el estado actual es `'disconnected'` (primer arranque).
  NO degradar desde `'qr'` ni desde `'connected'`.
- Cuando `connection === 'open'`: setear `'connected'` con el phone
  extraído de `sock.user.id` (formato `5491155...:N@s.whatsapp.net`,
  partir por `:` y tomar la parte numérica).
- Cuando `connection === 'close'`:
  - Si el status code es `DisconnectReason.loggedOut` (401):
    setear `'disconnected'`, borrar qr_string y phone, NO reconectar.
  - Cualquier otro code: NO modificar el estado de la DB. Solo
    schedule un reconnect. La razón: si estás `'connected'`, quieres
    seguir mostrando "connected" en el dashboard mientras el bot
    reconecta transparentemente. Si la reconexión necesita un nuevo
    QR, el evento `qr` va a sobreescribir el estado.

### 5. Backoff específico para code 440

Code 440 = `connectionReplaced`. Ocurre típicamente justo después del
pairing inicial: WhatsApp abre un WS "definitivo" mientras el de
pairing está activo, y kickea uno. Si reintentas muy rápido (3s)
entras en loop. Espera 15s para code 440, 5s para los demás:

```typescript
const delay = code === 440 ? 15000 : 5000;
```

### 6. Cleanup del socket viejo antes de reconectar

```typescript
function scheduleReconnect(code) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handle) {
      try { handle.sock.end(undefined); } catch {}
      handle = null;
    }
    start();
  }, delay);
}
```

Sin el `sock.end()`, Baileys puede dejar listeners colgando que
se mezclan con la nueva conexión.

# ⚠️ LECCIÓN APRENDIDA — API ROUTE STATUS

El endpoint `GET /api/connection/status` debe devolver el QR PNG
si `qr_string` existe AUNQUE el status no sea exactamente `'qr'`.
Esto es defensivo: por race conditions a veces el bot tiene
qr_string seteado pero status='connecting'. Si la API solo mira
status, el frontend nunca ve el QR.

```typescript
const shouldShowQr =
  !!state.qr_string &&
  (state.status === "qr" || state.status === "connecting");
if (shouldShowQr && state.qr_string) {
  const qrPng = await QRCode.toDataURL(state.qr_string, { width: 320, margin: 2 });
  return NextResponse.json({ status: "qr", qrPng, updatedAt: state.updated_at });
}
```

# ⚠️ NEXT.JS 16 — params es Promise

Todos los route handlers con `[segmento]` dinámico:

```typescript
// ✅ Next.js 16
interface Ctx { params: Promise<{ conversationId: string }>; }
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
}

// ❌ Sintaxis Next 14 — falla en build
export async function GET(_req, { params }: { params: { conversationId: string } }) {
  const { conversationId } = params;
}
```

Lo mismo con `cookies()` y `headers()` de `next/headers` — son async.

# ⚠️ NEXT.JS — serverExternalPackages

Sin esto, Next.js intenta empaquetar baileys y pino
en su bundle del server y rompe. `next.config.ts`:

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "pino"],
};
export default nextConfig;
```

# OUTBOX — SEPARACIÓN DE PROCESOS

Como bot y Next.js corren en procesos distintos, no comparten memoria.
La API no puede llamar `sock.sendMessage()` directamente. El flujo
para mensajes humanos:

1. POST `/api/messages/[id]` con role 'human':
   - INSERT en `messages` con role='human' (visible en el dashboard
     inmediatamente)
   - INSERT en `outbox` con phone + content + sent=0
   - Devuelve `{ ok: true, messageId }`

2. El proceso bot tiene un `setInterval` cada 2s que:
   - `SELECT * FROM outbox WHERE sent=0`
   - Por cada uno: `sock.sendMessage(jid, { text: content })`
   - Si OK: `UPDATE outbox SET sent=1 WHERE id=?`
   - Si falla: log y dejar `sent=0` (reintenta automáticamente al
     siguiente tick — útil cuando la conexión cae transitoriamente)

3. El proceso bot también debe iniciar el cronjob (`scripts/followups-cron.ts`) que evaluará constantemente las conversaciones inactivas en modo AI para disparar seguimientos automáticos consultando a DeepSeek.

# REDIS — ESTADO TRANSITORIO DE TURNOS

Redis solo guarda estado temporal. PostgreSQL es la fuente de verdad para conversaciones, mensajes, modo `AI/HUMAN`, timestamps y follow-ups.

Usar prefijo versionado `wa:v1:`:

- `wa:v1:dedupe:msg:{whatsappMessageId}` — `SET NX EX 86400` para no procesar dos veces el mismo mensaje de Baileys.
- `wa:v1:turn:queue:{conversationId}` — lista de mensajes aceptados durante debounce; TTL sugerido 300s.
- `wa:v1:turn:debounce:{conversationId}` — marca de timer/debounce activo; TTL `debounce_ms + 60s`.
- `wa:v1:turn:lock:{conversationId}` — lock con token aleatorio y TTL `processing_lock_ttl_ms`; liberar con compare-and-delete, nunca con delete ciego.
- `wa:v1:turn:processing:{conversationId}` — JSON de observabilidad `{ token, startedAt, messageIds }` para que follow-ups no colisionen.
- `wa:v1:followups:runner-lock` — lock global del scheduler.
- `wa:v1:followups:lock:{conversationId}` — lock corto por conversación antes de enviar seguimiento.

Al cerrar un turno borrar únicamente claves transitorias del turno (`queue`, `debounce`, `processing`, lock propio por token). NO borrar historial PostgreSQL, modo durable, `./auth/`, socket Baileys ni dedupe keys todavía vigentes.

# HANDLER DE MENSAJES ENTRANTES (CON ENCOLAMIENTO)

`messages.upsert` con `type: 'notify'` (ignorar 'append', 'replace').
Por cada mensaje válido ejecutar un turno:

1. Aceptar solo `remoteJid` 1:1 que termine en `@s.whatsapp.net`; ignorar grupos `@g.us`.
2. NO filtrar ciegamente `msg.key.fromMe === true`. Los mensajes propios desde el WhatsApp conectado son mensajes del dueño y deben persistirse como `role='human'` para intervención/control.
3. Extraer `whatsappMessageId`, `remoteJid`, `fromMe`, timestamp, nombre y contenido. Si es audio o imagen, descargar y enviar a DeepSeek Multimodal para descripción/transcripción.
4. Aplicar dedupe antes de responder: `SET wa:v1:dedupe:msg:{id} NX EX ...` y también respetar el índice único `messages.whatsapp_message_id`. Si ya existe, abortar sin enviar.
5. `getOrCreateConversation(phone, jid, msg.pushName)`.
6. Persistir antes de cualquier LLM:
   - `fromMe === false` → `role='user'`, `direction='inbound'`, `source='whatsapp'`, reiniciar/cancelar follow-ups.
   - `fromMe === true` → `role='human'`, `direction='outbound'`, `source='whatsapp'`, actualizar `last_owner_intervention_at`.
7. Si el mensaje es del dueño (`role='human'`):
   - Normalizar texto según settings (`trim`, case-insensitive si corresponde, match exacto por defecto).
   - Si coincide con `bot_off_keyword`, ejecutar `setMode(convo.id, 'HUMAN', { reason: 'owner_keyword_off', changedBy: 'owner' })`, registrar evento y abortar AI.
   - Si coincide con `bot_on_keyword` (ej. `ok.`), ejecutar `setMode(convo.id, 'AI', { reason: 'owner_keyword_on', changedBy: 'owner' })`, registrar evento y abortar AI hasta el próximo mensaje del cliente.
   - Si el chat está en `HUMAN` y la última intervención humana/actividad relevante fue hace 3 días o más, reactivar con `setMode(..., 'AI', { reason: 'owner_reply_after_3_days', changedBy: 'owner' })` y registrar `last_ai_reactivated_at`. Calcular este umbral usando timestamps previos al update del mensaje actual.
   - Si no hay keyword ni regla de 3 días, solo guardar el mensaje humano y no llamar a DeepSeek.
8. Si el mensaje es del cliente, re-leer conversation por id. Si `mode !== 'AI'`, cerrar turno y NO responder.
9. **Encolamiento de Mensajes (Debouncing con Redis):**
   - Guardar el mensaje aceptado en `wa:v1:turn:queue:{conversationId}` y marcar `wa:v1:turn:debounce:{conversationId}`.
   - Crear/reiniciar timer de 10-15s o `debounce_ms` desde settings.
   - Al finalizar el timer, tomar lock `wa:v1:turn:lock:{conversationId}`. Si no se obtiene, no responder.
   - Leer todos los mensajes encolados y cargar `getRecentHistory(20)` + system prompt ACTIVO. El historial debe incluir los mensajes recién persistidos para que si el cliente manda 5 mensajes separados rápidos, la IA responda una sola vez con todo el contexto.
10. Llamar a DeepSeek con contrato JSON estricto:
    ```json
    {
      "response": { "part_1": "...", "part_2": "...", "part_3": "..." },
      "handoff": { "required": false, "reason": "" }
    }
    ```
    Si el JSON es inválido, intentar una reparación/retry. Si sigue inválido, no enviar texto crudo no validado; registrar error y, si corresponde, derivar a humano.
11. **Herramienta Humano:** si `handoff.required === true` o el razonamiento detecta que necesita humano, ejecutar:
    - `setMode(convo.id, 'HUMAN', { reason: handoff.reason || 'assistant_handoff', changedBy: 'assistant' })`.
    - `recordConversationEvent(..., 'handoff_to_human', 'assistant', reason)`.
    - `notifyTelegramHumanNeeded(...)` con teléfono, nombre, último mensaje, motivo y link/ID de conversación.
    - Opcionalmente enviar al cliente una frase breve tipo "Te derivo con una persona para ayudarte mejor." si está dentro del contexto del turno.
12. Si no hay handoff, enviar `part_1`, `part_2`, `part_3` no vacíos en orden, con delay proporcional al texto vía `sock.sendMessage`, y persistir cada parte como `role='assistant'`, `direction='outbound'`, `source='bot'`.
13. En `finally`, cerrar el turno: limpiar queue/debounce/processing y liberar lock por token. Esta limpieza debe ser idempotente y nunca tocar `./auth/`, conexión Baileys ni datos durables.

Logging detallado — agrega logs `[bot] ← Mensaje de X: "..."`,
`[bot] llamando LLM con N mensajes...`, `[bot] LLM respondió en Xms`,
`[bot] → Enviado a Y`. Sirve mucho para debugging.

# FOLLOW-UPS — PARIDAD CON seguimiento.json SIN COLISIONES

`scripts/followups-cron.ts` debe correr con `node-cron` o `setInterval` robusto, tomar `wa:v1:followups:runner-lock` y evaluar candidatos cada `followup_interval_hours`.

Un chat es candidato solo si cumple TODO:

1. `mode='AI'`.
2. El último mensaje visible es `role='assistant'`.
3. No existe mensaje `role='user'` posterior a ese assistant.
4. `followup_attempts < followup_max_attempts` (default 2).
5. Pasó `followup_min_hours_after_assistant` desde el último assistant.
6. No hay `wa:v1:turn:queue`, `debounce`, `lock` ni `processing` activo para esa conversación.
7. Se pudo tomar `wa:v1:followups:lock:{conversationId}`.
8. Está dentro de `whatsapp_freeform_window_hours` desde `last_user_message_at`, o `block_outside_24h_followups=false`.

Si está fuera de 24h y el bloqueo está activo, NO enviar mensaje automático: registrar `followup_blocked_24h`, guardar `followup_blocked_reason`, y opcionalmente notificar por Telegram para que el dueño intervenga manualmente. Esto evita que WhatsApp lo marque como spam o fuera de política.

Para candidatos válidos, llamar a DeepSeek con historial reciente y exigir JSON estricto:

```json
{ "respuesta": "SI", "mensaje": "texto breve" }
```

- Si `respuesta === "SI"` y `mensaje` es string no vacío, enviar por Baileys, persistir como `role='assistant'`, `source='scheduler'`, actualizar `last_followup_at` e incrementar intentos.
- Si `respuesta === "NO"`, no enviar y registrar decisión si se desea.
- Si el JSON es inválido o falta `mensaje`, no enviar texto crudo; registrar `deepseek_json_invalid` o `followup_skipped`.
- Si el cliente responde después de cualquier follow-up, el handler inbound tiene prioridad, reinicia/cancela `followup_attempts` y continúa el flujo normal.

# SYSTEM PROMPT INICIAL

```typescript
// src/lib/system-prompt.ts
export const SYSTEM_PROMPT = `
Eres un asistente virtual amable. Responde en español neutro,
en mensajes breves de 2 a 4 líneas. No uses emojis.

Siempre responde con JSON válido:
{
  "response": {
    "part_1": "mensaje breve obligatorio",
    "part_2": "mensaje opcional o string vacío",
    "part_3": "mensaje opcional o string vacío"
  },
  "handoff": {
    "required": false,
    "reason": ""
  }
}

Usa handoff.required=true como herramienta Humano cuando el cliente
pida una persona/asesor, esté listo para cerrar, esté molesto, haga una
objeción crítica, pida algo que no debes inventar o necesite intervención
humana. En ese caso, incluye reason claro y una respuesta breve para avisar
que será derivado.
`.trim();
```

El usuario va a personalizar este archivo después con el prompt de
SU negocio. Documenta en el README cómo se hace.

# DESCONEXIÓN MANUAL

`POST /api/connection/disconnect`:
1. `setConnectionState({status: 'disconnected', qr_string: null, phone: null})`
2. Borrar carpeta `./auth/` con `fs.rmSync(authDir, {recursive: true, force: true})`
3. Crear archivo flag `./data/.restart` (vacío)

`scripts/start-bot.ts` poll cada 1s `fs.existsSync('./data/.restart')`.
Si existe:
1. `fs.unlinkSync('./data/.restart')`
2. `await handle.shutdown()` (sock.logout() + sock.end())
3. `fs.rmSync('./auth/', {recursive: true, force: true})` (defensa)
4. Re-llamar `start()` para arrancar limpio (genera QR nuevo)

# UI / TAILWIND

Paleta neutra (grises) + acento esmeralda para IA / ámbar para HUMANO.
Sin librerías de componentes (no shadcn, no Radix). Tailwind 4
vanilla.

Estados visuales clave:
- En `QRScreen`: `status === 'qr'` muestra "Esperando escaneo..." con
  punto ámbar pulsante. `'connecting'` muestra "Conectando..." azul.
  `'disconnected'` muestra spinner. Si lleva >10s en disconnected sin
  qr_string, mostrar mensaje de error con sugerencia de reiniciar
  el proceso bot.
- En `MessageBubble`: user a la izquierda (blanco con borde),
  assistant verde a la derecha, human ámbar a la derecha.
- En `ConversationList`: badge IA verde / HUMAN ámbar al lado de cada
  conversación. Mostrar "hace X min" como timestamp relativo.
- En `ConversationPanel`: input deshabilitado en modo IA (mostrar
  mensaje "El bot responde automáticamente"). Habilitado y enviable
  en modo HUMAN.

# DOCKER Y DEPLOY

El proyecto y la base de datos se orquestan completamente con `docker-compose.yml`.

Crea un `Dockerfile` multietapa para la aplicación Next.js y el bot, exponiendo el puerto 3000 y ejecutando el script de arranque conjunto (`npm run start:all`).

En el `docker-compose.yml`:
1. Un servicio `db` basado en la imagen oficial de `postgres:16-alpine`.
   - Variables de entorno: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
   - Volumen para persistir los datos de PostgreSQL.
2. Un servicio `redis` basado en la imagen oficial de `redis:7-alpine`.
   - Volumen para persistir la data de caché de Redis (opcional, pero recomendado).
3. Un servicio `app` (tu aplicación).
   - `depends_on: db, redis`.
   - Variables de entorno (pasando la `DATABASE_URL`, `REDIS_URL` y las de DeepSeek).
   - Volumen montado para la carpeta `./auth/` para no perder la sesión de WhatsApp al reiniciar el contenedor.
   - Puertos: `3000:3000`.

Para ejecutar en local o en un servidor, el usuario solo debe clonar el repo y correr:
`docker-compose up -d --build`

Documenta en el README: Es obligatorio cargar créditos en la consola
de DeepSeek y usar el modelo `deepseek-chat`. Las capas gratuitas
dan error 429 y no sirven para producción. Nada de OpenAI.

# SEGURIDAD — DASHBOARD SIN AUTH

El dashboard NO tiene autenticación. Documenta en el README:
si vas a desplegar a internet, ANTES pon basic auth (a nivel
proxy de EasyPanel/Caddy/Nginx) o Cloudflare Access. Si no, cualquiera
con la URL puede leer todas las conversaciones de WhatsApp y enviar
mensajes haciéndose pasar por el dueño. Marca esto como bloqueante
para producción.

# REGLAS DE TRABAJO PARA TI (Claude Code)

1. Trabaja archivo por archivo en este orden:
   (a) `package.json` con dependencias, scripts, engines
   (b) `.env.example`, `.gitignore`, `tsconfig.json`, `next.config.ts`,
       `postcss.config.mjs`
   (c) `src/app/layout.tsx`, `src/app/globals.css`
   (d) `src/lib/db.ts` con DDL completo y todos los helpers
   (e) `src/lib/Deepseek.ts` y `src/lib/system-prompt.ts`
   (f) `scripts/env-loader.ts` (separado, side-effect only)
   (g) `src/lib/baileys/client.ts` (con fetchLatestBaileysVersion,
       Browsers.macOS, state machine correcta)
   (h) `src/lib/baileys/handler.ts`
   (i) `scripts/start-bot.ts` (env-loader como PRIMER import)
   (j) API routes (status, disconnect, conversations, messages, mode,
       conversations/[id] DELETE)
   (k) Componentes en orden: ModeToggle, MessageBubble, ConversationList,
       ConversationPanel (con botón Borrar y composer HUMAN),
       DashboardHeader, QRScreen, ConnectionGate
   (l) `src/app/page.tsx`
   (m) `Dockerfile` y `docker-compose.yml`
   (n) `README.md`

2. Después de los archivos críticos (db.ts, baileys/client.ts,
   handler.ts) muestra el código y espera confirmación. Para
   boilerplate (configs, layout) puedes hacer batch sin preguntar.

3. Después de cada batch importante ejecuta `npx tsc --noEmit` para
   validar tipos. Si hay errores, arréglalos sin preguntar.

4. Cuando termines de declarar dependencias, ejecuta `npm install` tú
   mismo (avisa al usuario que tarda ~1 min por la compilación
   nativa de pg u otras utilidades).

5. NO inventes features fuera del scope. Si tienes ideas de mejora
   anótalas en una sección "Mejoras pendientes" del README.

6. NO uses Drizzle, Prisma, Supabase, WebSockets ni Vercel.

7. Idioma de comentarios en código y mensajes al usuario: español
   neutro.

8. Cuando el usuario quiera arrancar para probar:
   - Levanta el bot Y el dev server en background como tareas
     paralelas, muestra los logs principales.
   - Avisa que el QR aparece en localhost:3000.
   - Si el bot tira code=440 en loop:
     * Verifica que `Browsers.macOS('Desktop')` esté usado.
     * Pide al usuario que en su teléfono (Configuración →
       Dispositivos vinculados) borre cualquier dispositivo viejo
       de pruebas anteriores.
     * Si persiste, sugiere cambiar de IP del VPS o esperar 24h.
   - Si tira 429 en LLM: el usuario no tiene saldo o está usando un endpoint gratuito.
     Recuérdale que DEBE cargar créditos en su cuenta de DeepSeek y usar `deepseek-chat`.

# PRIMER PASO

Empieza mostrando el `package.json` que vas a generar (con `engines`,
todas las deps en `dependencies` salvo las puramente de tipos) y
espera confirmación antes de ejecutar `npm install`.

Empieza ahora.

---

## Notas para ti (el creador del curso)

Cosas que YO descubrí en el camino y que dejé incorporadas en el
prompt para que tus suscriptores no las pisen:

1. **Code 405** — versión Baileys vs WhatsApp Web protocol. Fix:
   `fetchLatestBaileysVersion()` SIEMPRE.

2. **Code 440 en loop** — browser fingerprint custom. Fix:
   `Browsers.macOS('Desktop')`.

3. **Code 515** — es bueno, no malo. Es la señal de pairing exitoso.
   El bot solo necesita reconectar.

4. **QR no aparece en frontend** — el bot pasa por `qr → connecting`
   muy rápido, y la API solo miraba status estricto. Fix: API
   defensiva que muestra QR si `qr_string` existe.

5. **DEEPSEEK_API_KEY undefined en bot** — ES module hoisting.
   Fix: env-loader como módulo separado importado primero.

6. **Procesos zombies** — TaskStop / Ctrl+C en Windows no siempre
   mata los hijos de tsx. Documentado para que sepan matarlos
   manualmente con tasklist + taskkill si ocurre.

7. **Docker Compose build** — Asegúrate de que el Dockerfile expone correctamente el puerto 3000 y que la red entre Next.js y la base de datos PostgreSQL funcione.

8. **Node 20+ requerido** — La imagen Docker para la aplicación debe basarse en `node:20-alpine` (o superior) ya que Baileys, Next 16 y Tailwind 4 lo requieren.

9. **Modelos de DeepSeek** — Los tiers gratuitos dan 429 garantizado
   en producción real. Hay que exigir el modelo de pago (`deepseek-chat`)
   con créditos recargados desde el día uno. Nada de OpenAI.

10. **Dashboard sin auth** — riesgo crítico si se despliega. Marcado
    como bloqueante.

Si el suscriptor quiere expandir features:
- Soporte de imágenes salientes (enviar PNG de productos).
- Function calling real con la API de DeepSeek.
- Mejoras de la herramienta Humano: motivos de handoff más detallados, notificaciones Telegram enriquecidas y reglas auditables por negocio.
- Polling optimizado; NO usar WebSockets porque están fuera del stack permitido.
- Auth básica en Next.js (middleware con basic auth).