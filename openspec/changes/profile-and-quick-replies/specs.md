# Specification: Profile Modal & Quick Replies (/)

## 1. Data Schema Specs

### 1.1 `settings` JSONB structures
We use the key `"quick_replies"` and `"bot_profile"` in the PostgreSQL `settings` table.

- **`quick_replies`**:
  ```typescript
  type QuickReplies = Array<{
    id: string; // unique identifier (uuid or epoch timestamp)
    shortcut: string; // triggers on "/shortcut" (alphanumeric, lowercase)
    text: string; // full text expansion
  }>;
  ```

- **`bot_profile`** (populated by Baileys):
  ```typescript
  interface BotProfile {
    phone: string;
    profile_picture_url: string | null;
    status: string | null;
    business: {
      description: string;
      category: string;
      email: string;
      website: string[];
      address: string;
    } | null;
  }
  ```

## 2. API Endpoints

### 2.1 `GET /api/connection/status`
Returns connection status and includes the `botProfile` object retrieved from `settings`.

**Response JSON Structure:**
```json
{
  "status": "connected",
  "qrPng": null,
  "phone": "1234567890",
  "updatedAt": "2026-06-03T14:50:00.000Z",
  "botProfile": {
    "phone": "1234567890",
    "profile_picture_url": "https://...",
    "status": "Disponible",
    "business": null
  }
}
```

### 2.2 `PUT /api/settings`
Updates settings, including quick replies.
**Request Body JSON:**
```json
{
  "quick_replies": [
    { "id": "1", "shortcut": "hola", "text": "¡Hola! ¿Cómo te va?" },
    { "id": "2", "shortcut": "precio", "text": "Nuestros precios inician desde $10 USD." }
  ]
}
```

---

## 3. UI Specifications

### 3.1 Button & Modal (DashboardHeader)
- **Position**: Place a "Perfil" button to the left of the "Desconectar" button.
  - Style: Rounded pill button with border matching the application theme. Icon: `UserIcon` or profile image thumbnail.
- **Modal Design**:
  - Backdrop: Semi-transparent dark blur (`bg-black/60 backdrop-blur-sm`).
  - Container: Glassmorphism layout (`glass-panel` style, matching visual aesthetics of the dashboard), centered on screen.
  - **Left / Top Section (Bot Profile Info)**:
    - High-resolution profile picture (clickable to zoom like client photos).
    - Phone number and WhatsApp Status/Bio.
    - Business details (category, description, email, website, address) displayed in a styled grid card if present.
  - **Right / Bottom Section (Quick Replies Manager)**:
    - List of current quick replies.
    - Inline edit/delete operations.
    - "Agregar Respuesta Rápida" form with:
      - Shortcut input (validates no leading `/`, alphanumeric only).
      - Expanded text textarea.
    - "Guardar Cambios" button that performs a `PUT /api/settings` request.

### 3.2 Quick Replies Dropdown (ConversationPanel)
- **Activation Trigger**: Whenever the message composer input starts with `/` or has a space followed by `/` (e.g. `/` at index 0 or ` /`).
- **Filter logic**: Match the characters after the `/` against the `shortcut` of each quick reply (case-insensitive substring or prefix match).
- **Floating Panel**:
  - Placed directly above the input composer.
  - Max-height: `200px` (overflow scroll) to avoid blocking the viewport.
  - Styled with theme-matching background (`bg-surface-bright/95 border border-outline-variant rounded-2xl shadow-2xl backdrop-blur-md`).
- **Keyboard navigation**:
  - `ArrowDown` & `ArrowUp`: Move focus between matches.
  - `Enter`: Select active match. Replaces `/shortcut` with `text` in composer and keeps composer input focused.
  - `Escape` or clicking outside: Closes the dropdown.
