# Proposal: CRM Deals Pipeline (Oportunidades de Venta)

## Intent

Con las bases de la identidad CRM ya implementadas (contactos, cuentas y mapeo de conversaciones), el bot puede ahora evolucionar para trackear el valor comercial de las conversaciones. El objetivo es permitir a los operadores registrar, editar y actualizar oportunidades de venta (Deals) asociadas a un cliente directamente desde el panel del chat, permitiendo llevar un control de la etapa de la venta (Prospecto, Contactado, Propuesta Enviada, Ganado, Perdido) y su monto.

## Scope

### In Scope
- **Esquema de Base de Datos**: Crear la tabla `crm_deals` en PostgreSQL para registrar el trato, su etapa, valor monetario, y relacionarlo con un contacto (`crm_contacts`) o cuenta (`crm_accounts`).
- **Capa de Repositorio**: Extender el repositorio de CRM para soportar el ciclo de vida CRUD de un Deal con persistencia en PostgreSQL e in-memory (para testing), incluyendo logs en `audit_events` cuando cambie de estado o valor.
- **Rutas API de Backend**:
  - `GET /api/crm/deals?contactId=...` (o `accountId=...`): Para listar oportunidades.
  - `POST /api/crm/deals`: Crear un trato.
  - `PATCH /api/crm/deals/[dealId]`: Modificar etapa, monto o detalles de un trato.
  - `DELETE /api/crm/deals/[dealId]`: Eliminar un trato.
- **Frontend UI (Drawer del Perfil)**:
  - Mostrar la lista de tratos activos abajo de los datos del cliente dentro del drawer lateral del perfil en `ConversationPanel.tsx`.
  - Habilitar botones/acciones para cambiar rápidamente la etapa comercial o el monto.
  - Permitir crear un trato nuevo mediante un formulario interno del drawer.

### Out of Scope
- Vista de tablero Kanban completo en esta fase (se implementará en la siguiente fase de Analytics).
- Múltiples monedas (se mantendrá un monto numérico con moneda por defecto USD/pesos local).
- Flujos automáticos de la IA cerrando tratos por sí misma (la IA puede clasificar leads, pero los tratos comerciales los maneja el operador humano).

## Capabilities

### New Capabilities
- `crm-deals-db-schema`: Estructura DDL para la tabla de tratos y su vinculación.
- `crm-deals-repository`: Métodos de CRUD y auditoría para Deals.
- `crm-deals-backend-api`: API RESTful para gestionar tratos comerciales.
- `crm-deals-ui-panel`: Sección interactiva en el drawer del cliente para gestionar sus tratos y montos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/db-contract.ts` | Modified | Agregar DDL de la tabla `crm_deals` y sus índices |
| `src/lib/repositories/crm-repository.ts` | Modified | Implementar métodos CRUD para deals en Postgres y Memory adapters |
| `src/app/api/crm/deals/route.ts` | Created | API handler para listar y crear deals |
| `src/app/api/crm/deals/[dealId]/route.ts` | Created | API handler para actualizar y borrar deals |
| `src/components/ConversationPanel.tsx` | Modified | Integrar la visualización y control de tratos en el Drawer de perfil del cliente |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| La API expone datos a usuarios no autorizados | Med | Aplicar verificación estricta de sesión (`requireRequestRole` mínimo `viewer` para lectura y `agent` para modificaciones) |
| Impacto en el rendimiento por joins de DB | Low | Agregar índices en llaves foráneas (`contact_id`, `account_id`) |

## Success Criteria

- [ ] La base de datos contiene la tabla `crm_deals` con DDL seguro.
- [ ] La API de Deals requiere roles válidos y escribe eventos de auditoría al cambiar estados.
- [ ] El operador puede ver, crear y cambiar de etapa un trato comercial desde el dashboard sin salir de la conversación.
- [ ] Se mantiene el 100% de la suite de tests unitarios pasando (`npm test`).
