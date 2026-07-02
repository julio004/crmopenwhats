# Specification: CRM Deals Pipeline

## 1. Esquema de Base de Datos (PostgreSQL)

Se incorporará la tabla `crm_deals` para relacionar las oportunidades comerciales con contactos o cuentas del CRM.

### 1.1 Tabla `crm_deals`
```sql
CREATE TABLE IF NOT EXISTS crm_deals (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  stage TEXT CHECK(stage IN ('lead', 'contacted', 'proposal_sent', 'won', 'lost')) NOT NULL DEFAULT 'lead',
  contact_id INTEGER REFERENCES crm_contacts(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES crm_accounts(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deal_owner CHECK (contact_id IS NOT NULL OR account_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals(account_id);
```

## 2. API de Backend (`/api/crm/deals`)

Todas las llamadas de API verificarán la sesión del usuario mediante las funciones de autenticación del proyecto (`requireRequestRole` en `src/lib/auth/session`).

### 2.1 Listar Tratos: `GET /api/crm/deals`
* **Query Params**:
  - `contactId?: number`
  - `accountId?: number`
* **Seguridad**: Mínimo rol `viewer`.
* **Respuesta (200 OK)**: Lista de deals en formato JSON.

### 2.2 Crear Trato: `POST /api/crm/deals`
* **Seguridad**: Mínimo rol `agent`.
* **Cuerpo de la petición**:
  ```json
  {
    "title": "string",
    "description": "string?",
    "amount": "number?",
    "stage": "string?",
    "contactId": "number?",
    "accountId": "number?",
    "expectedCloseDate": "string?"
  }
  ```
* **Respuesta (201 Created)**: Retorna el Deal creado.
* **Auditoría**: Registra un evento `crm.deal_created` en `audit_events`.

### 2.3 Actualizar Trato: `PATCH /api/crm/deals/[dealId]`
* **Seguridad**: Mínimo rol `agent`.
* **Cuerpo de la petición**: Campos parciales a actualizar (ej: `{ "stage": "won", "amount": 1500 }`).
* **Respuesta (200 OK)**: Trato actualizado.
* **Auditoría**: Si cambia de `stage` o `amount`, registra el evento `crm.deal_updated` en `audit_events` detallando el estado previo y posterior.

### 2.4 Eliminar Trato: `DELETE /api/crm/deals/[dealId]`
* **Seguridad**: Mínimo rol `agent`.
* **Respuesta (200 OK)**: `{ "ok": true }`.
* **Auditoría**: Registra `crm.deal_deleted`.

## 3. Frontend UI (Drawer del Perfil de Cliente)

El Drawer de perfil de cliente en `ConversationPanel.tsx` integrará la sección interactiva.

### 3.1 Lista y Estado
* Abajo de la sección de etiquetas y scoring, se renderizará un título "Oportunidades de Venta".
* Se listarán los tratos vinculados al contacto. Cada trato mostrará su título, monto formateado, y un selector interactivo (`<select>`) para cambiar la etapa (`stage`) directamente.
* Un botón de tacho de basura para eliminar el trato.

### 3.2 Formulario de Creación
* Un botón "+ Agregar oportunidad" desplegará un formulario interno o modal simple para crear un Deal ingresando Título y Monto.
