# Design: Profile Modal & Quick Replies (/)

## 1. API Changes

### 1.1 `src/app/api/connection/status/route.ts`
Modify the `GET` function to query `getSettings` and map the `bot_profile` field.
```typescript
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getConnectionState, getSettings } from "../../../../lib/db.ts";

export async function GET() {
  try {
    const state = await getConnectionState();
    const settings = await getSettings();
    const botProfile = settings.bot_profile || null;
    
    const shouldShowQr =
      !!state.qr_string &&
      (state.status === "qr" || state.status === "connecting");
      
    if (shouldShowQr && state.qr_string) {
      const qrPng = await QRCode.toDataURL(state.qr_string, { width: 320, margin: 2 });
      return NextResponse.json({
        status: "qr",
        qrPng,
        phone: null,
        updatedAt: state.updated_at,
        botProfile,
      });
    }

    return NextResponse.json({
      status: state.status,
      qrPng: null,
      phone: state.phone,
      updatedAt: state.updated_at,
      botProfile,
    });
  } catch (error: any) {
    console.error("[api] Error en GET /api/connection/status:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
```

---

## 2. Frontend Component Changes

### 2.1 `src/components/DashboardHeader.tsx`
- We need to display the "Perfil" button when the connection is active.
- To display profile data and quick replies, we will load settings using fetch `/api/settings` and `/api/connection/status`.
- We'll design a modal inside `DashboardHeader` or as a sub-component. To keep things clean, we will implement the modal state and layout inside `DashboardHeader.tsx`.
- The modal will:
  - Fetch `botProfile` from status.
  - Fetch and save `quick_replies` using `/api/settings`.
  - Propagate updates to a callback or trigger a refresh. If we want quick replies to sync across panels, `DashboardHeader` can trigger a notification or we can centralize state.
  - Since React state is easiest to sync by passing props, we will keep the state of `quickReplies` in `src/app/page.tsx` and pass them to components. Let's adapt this.

### 2.2 `src/app/page.tsx`
- Add state for `quickReplies`: `const [quickReplies, setQuickReplies] = useState<Array<{ id: string; shortcut: string; text: string }>>([])`.
- Fetch `quickReplies` inside a `useEffect` from `/api/settings` when loading the application.
- Pass `quickReplies` and `onQuickRepliesUpdated` to `DashboardHeader` so that when edited in the profile modal, the state updates globally.
- Pass `quickReplies` to `ConversationPanel` so it can trigger and auto-complete them when writing messages.
- Fetch `botProfile` from `/api/connection/status` or inside `ConnectionGate` and expose it. Wait, `ConnectionGate` uses a children render-prop:
  ```typescript
  children: (phone: string | null, onDisconnect: () => void) => React.ReactNode
  ```
  We can change it to:
  ```typescript
  children: (phone: string | null, onDisconnect: () => void, botProfile: any) => React.ReactNode
  ```
  Then in `page.tsx`, we can pass `botProfile` to `DashboardHeader`.

Let's check `ConnectionGate.tsx` again:
It has:
```typescript
interface ConnectionGateProps {
	children: (phone: string | null, onDisconnect: () => void) => React.ReactNode;
}
```
We can modify this render-prop to pass `botProfile` too, or just fetch it in `DashboardHeader` independently. Independent fetching in `DashboardHeader` avoids refactoring `ConnectionGate`'s type signatures too deeply, but changing the render prop is actually super simple and keeps a single source of truth. Let's pass it!

Let's define the new `ConnectionGateProps`:
```typescript
interface ConnectionGateProps {
	children: (phone: string | null, onDisconnect: () => void, botProfile: any) => React.ReactNode;
}
```
In `ConnectionGate.tsx` checkConnection:
```typescript
	const [botProfile, setBotProfile] = useState<any>(null);
	// ...
	const checkConnection = async () => {
		try {
			const res = await fetch("/api/connection/status");
			if (res.ok) {
				const data = await res.json();
				setStatus(data.status);
				setQrPng(data.qrPng);
				setPhone(data.phone);
				setUpdatedAt(data.updatedAt);
				setBotProfile(data.botProfile);
			}
...
	return <>{children(phone, handleDisconnectLocal, botProfile)}</>;
```

### 2.3 Profile Modal UI implementation (in `DashboardHeader.tsx`)
We will create a clean and premium Glassmorphic Modal overlay:
- Backdrop blur, rich background (`bg-background/80 border border-outline-variant`).
- Grid layout:
  - **Bot Info Tab**:
    - Show profile picture (with Zoom on click).
    - Show phone number.
    - Show status/bio.
    - Show business profile cards (Email, Category, Websites, Address) if present.
  - **Quick Replies Tab**:
    - List of quick replies with delete buttons.
    - Fields to add a new quick reply:
      - Shortcut input: lowercase, automatically stripped of spaces and `/`.
      - Textarea for the actual reply.
      - "Agregar" button.
    - "Guardar Respuestas" button to send the updated array to `/api/settings` and trigger the state update.

### 2.4 Quick Replies Auto-complete in `ConversationPanel.tsx`
- We pass down `quickReplies` prop to `ConversationPanel`.
- Inside `ConversationPanel.tsx`:
  - Introduce states:
    - `showRepliesDropdown: boolean`
    - `activeIndex: number` (for arrow key selection)
    - `filterText: string`
  - When user types in input:
    - Parse current text value. We want to check if the user is typing a shortcut.
    - A shortcut is active if the text ends with `/` + letters without spaces, OR if it contains `/` at the beginning, or `/` right after a space.
    - Let's use a regex or string parse:
      - Find the last index of `/`.
      - If there is a `/` and the text between the last space and that `/` is empty (meaning the word starts with `/`), we can extract the text after `/` as the filter.
      - E.g.: text is `"hola /pr"` -> last `/` index is 5. Text before is `"hola "`. Character before `/` is space. This triggers search with search query `"pr"`.
      - E.g.: text is `"/hola"` -> last `/` index is 0. Triggers search with query `"hola"`.
      - E.g.: text is `"hola/hola"` -> character before `/` is `"a"`, not a space. This does NOT trigger the dropdown.
    - Filter `quickReplies` where `reply.shortcut.toLowerCase().startsWith(filterText.toLowerCase())`.
    - If there are matching quick replies, set `showRepliesDropdown(true)`.
  - Handle key down events in composer input:
    - If `showRepliesDropdown` is true:
      - `ArrowDown`: `setActiveIndex((prev) => (prev + 1) % matches.length)`
      - `ArrowUp`: `setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length)`
      - `Enter`: Select active match. Call `insertQuickReply(matches[activeIndex])`. Prevent default submission.
      - `Escape`: Close dropdown.
  - `insertQuickReply(reply)`:
    - Find the position of the last `/`.
    - Replace from the last `/` to the end of the text with the reply's text (and maybe add a space at the end).
    - Update `text` state.
    - Close dropdown.
    - Refocus the input element.
