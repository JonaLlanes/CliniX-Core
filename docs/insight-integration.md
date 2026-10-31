# CliniX Insight — Integration Notes

CliniX Core is the **clinical source of truth**. CliniX Insight is a separate analytics / workflow intelligence platform that **reads** Core (and may later subscribe to events).

## Authentication

1. Provision a User with role `insight_service`.
2. Login via `POST /api/v1/auth/login` (or issue a long-lived JWT in deployment secrets).
3. Call APIs with `Authorization: Bearer <token>`.

Restrict CORS / network so only Insight and the Core UI can reach the API in production.

## Recommended read patterns

| Insight need | Core endpoint |
|--------------|---------------|
| Patient search / cohort seed | `GET /patients?q=&page=` |
| Longitudinal chart | `GET /analytics/patients/:id/timeline` |
| BP / SpO2 trends | `GET /patients/:id/vitals?from=&to=` |
| Active problem list | `GET /patients/:id/conditions?status=active` |
| Med adherence context | `GET /patients/:id/medications?status=active` |
| Open care work | `GET /patients/:id/tasks?status=pending` |
| Visit history | `GET /patients/:id/appointments` |
| Provider day | `GET /appointments/day?providerId=&date=` |
| Cross-patient vitals export | `GET /analytics/cohort/vitals?from=&to=&metric=` |

## Write boundary

Insight should **not** become a second EHR. Prefer writing clinical facts in Core UI (or Core APIs from trusted clinical apps). Insight may later create **Tasks** (workflow prompts) — treat as optional Phase 2.

## Timeline payload (conceptual)

```json
{
  "data": [
    { "kind": "vital", "at": "2026-01-10T14:00:00Z", "ref": { "...": "..." } },
    { "kind": "encounter", "at": "2026-01-10T13:00:00Z", "ref": { "...": "..." } },
    { "kind": "medication", "at": "2026-01-01T00:00:00Z", "ref": { "...": "..." } }
  ]
}
```

Sort key: encounter `periodStart`, vital `effectiveAt`, medication `startDate`, note `createdAt`, task `dueDate` / `createdAt`.

## Phase 2 (out of scaffold)

- Webhooks on Vital / Task create
- Change streams or CDC into Insight warehouse
- FHIR R4 export bundle endpoint
