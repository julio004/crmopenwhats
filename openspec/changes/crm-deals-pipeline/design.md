# Design: CRM Deals Pipeline

## 1. Cambios en Base de Datos y Repositorios

### 1.1 `src/lib/db-contract.ts`
Agregaremos la tabla `crm_deals` a la constante `DATABASE_SCHEMA_SQL` para que PostgreSQL inicialice la tabla automáticamente en el arranque de la aplicación.
Definiremos los tipos de datos:
- `CrmDealRow`
- `InsertCrmDealInput`

### 1.2 `src/lib/repositories/crm-repository.ts`
Extenderemos `CrmRepository` con los siguientes métodos:
```typescript
export interface CrmDealRow {
  id: number;
  team_id: number | null;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string;
  stage: "lead" | "contacted" | "proposal_sent" | "won" | "lost";
  contact_id: number | null;
  account_id: number | null;
  owner_user_id: number | null;
  expected_close_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CrmRepository {
  // ... métodos existentes ...
  findDealById(id: number): Promise<CrmDealRow | null>;
  listDealsByContactId(contactId: number): Promise<CrmDealRow[]>;
  listDealsByAccountId(accountId: number): Promise<CrmDealRow[]>;
  createDeal(input: Omit<CrmDealRow, "id" | "created_at" | "updated_at">): Promise<CrmDealRow>;
  updateDeal(id: number, patch: Partial<Omit<CrmDealRow, "id" | "created_at" | "updated_at">>): Promise<CrmDealRow>;
  deleteDeal(id: number): Promise<boolean>;
}
```
Implementaremos estos métodos tanto en `PostgresCrmRepository` (ejecutando queries SQL reales parametrizadas) como en `InMemoryCrmRepository` (actualizando la memoria local en un array de objetos para posibilitar testing rápido).

## 2. API Routes en Next.js

Crearemos dos nuevos manejadores de rutas:

### 2.1 `src/app/api/crm/deals/route.ts`
- **GET**: Carga y valida la sesión (`requireRequestRole(req, authDeps, "viewer")`). Lee `contactId` o `accountId` de la URL. Invoca `crmRepository.listDealsByContactId` o `listDealsByAccountId` y retorna la respuesta.
- **POST**: Carga y valida la sesión (`requireRequestRole(req, authDeps, "agent")`). Lee el cuerpo JSON, valida campos mínimos (`title`, más al menos `contactId` o `accountId`), crea el trato usando el repositorio de CRM, registra una fila en `audit_events` (action `crm.deal_created`), y retorna la respuesta con estado 201.

### 2.2 `src/app/api/crm/deals/[dealId]/route.ts`
- **PATCH**: Valida la sesión con nivel mínimo de `agent`. Busca el trato original para auditoría. Actualiza el trato y, si hubo cambios de etapa o monto, registra un `audit_event` con los valores previos y posteriores (action `crm.deal_updated`).
- **DELETE**: Valida la sesión con nivel de `agent`. Busca el trato, lo elimina del repositorio, guarda un evento de auditoría `crm.deal_deleted`, y responde con éxito.

## 3. Modificaciones en el Frontend (`src/components/ConversationPanel.tsx`)

Añadiremos los estados y efectos necesarios en `ConversationPanel.tsx` para cargar y mutar tratos cuando `profileOpen` esté activo:
- `const [deals, setDeals] = useState<CrmDealRow[]>([])`
- `const [loadingDeals, setLoadingDeals] = useState(false)`
- Un efecto `useEffect` que llame a `GET /api/crm/deals?contactId={conversation.contact_id}` cuando cambie la conversación y el perfil esté abierto.
- Botones en la vista del drawer del perfil del cliente para crear nuevos tratos y cambiar la etapa de los tratos existentes llamando a los nuevos endpoints de API y actualizando el estado de React localmente.
