# CliniX Core — REST API

Base URL: `http://localhost:5000/api/v1`  
Auth: `Authorization: Bearer <jwt>`

## Common list response

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Admin (or open in `NODE_ENV=development`) | Create user |
| POST | `/auth/login` | Public | Returns `{ token, user }` |
| GET | `/auth/me` | JWT | Current user |

## Patients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/patients` | List / search. Query: `q` (MRN, name, health card), `mrn`, `healthCardNumber`, `name`, `birthDate` (YYYY-MM-DD), `sex`, `page`, `limit` |
| POST | `/patients` | Create (Canadian registration body; validates provincial health card rules) |
| GET | `/patients/:id` | Get one |
| PATCH | `/patients/:id` | Update registration / demographics |

## Nested clinical resources

All under `/patients/:patientId/...`

| Resource | Path | List filters |
|----------|------|--------------|
| Conditions | `/conditions` | `status` |
| Vitals | `/vitals` | `from`, `to`, `source` |
| Medications | `/medications` | `status` |
| Encounters | `/encounters` | `type`, `from`, `to` |
| Care plans | `/care-plans` | `status` |
| Tasks | `/tasks` | `status`, `assigneeRole`, `dueBefore` |
| Notes | `/notes` | `encounterId` |
| Allergies | `/allergies` | `status` |

Each supports `GET` (list), `POST` (create), `GET /:id`, `PATCH /:id`, `DELETE /:id` (soft delete). Note list returns the latest revision of each note. `PATCH /notes/:id` inserts a new revision and does not change the previous document. `GET /notes/:id/revisions` returns the revision timeline.

## Audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/patients/:patientId/audit` | Chart create/update/delete history. Query: `page`, `limit` |

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/users` | Clinician, nurse, admin | Id, name, email, and role for care-team assignment |

## Reports

Clinic operations and population health. Not provincial extracts and not billing. Auth: clinician, nurse, or admin. Caregivers receive `403`.

Query on every route: `preset` (`today`, `last_7_days`, `current_month`, `custom`). Custom requires `from` and `to` as `YYYY-MM-DD` clinic dates, at most 366 days. Activity counts use the range. Open workload (active encounters, referrals, orders, overdue recalls) is current.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/operational` | Appointments, completed visits, no-shows, cancellations, average wait, active encounters, referrals, and orders, plus an appointment trend |
| GET | `/reports/clinical` | Active patients, patients seen, problems, medications, care plans, monitoring enrollments, overdue recalls |
| GET | `/reports/cohorts` | Hypertension, diabetes, COPD, heart failure, and CKD: patients, active care plans, overdue recalls, abnormal readings |
| GET | `/reports/referrals` | Created, completed, cancelled, awaiting follow-up |
| GET | `/reports/orders` | Active, completed, cancelled, outstanding results |
| GET | `/reports/medications` | Active, discontinued in range, allergy acknowledgements in range |
| GET | `/reports/monitoring` | Active programs, overdue recalls, completed recalls, abnormal readings by type |
| GET | `/reports/export/:kind` | CSV. `kind` is `appointments`, `referrals`, `orders`, `recalls`, or `cohorts` |

Counts use aggregation pipelines and do not load full patient documents.

## Analytics (Insight-oriented)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/patients/:id/timeline` | Unified chronological events |
| GET | `/analytics/cohort/vitals` | Filter vitals across patients; query: `from`, `to`, `metric`, `page`, `limit` |

## Appointments

Scheduling is its own resource so provider conflicts can be checked across charts. Writes require the caller to be on the patient's care team (administrators bypass). Readers with role `caregiver` or `pharmacist` only see appointments for patients on their care team. Clinicians and nurses can read a provider's full day.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/patients/:patientId/appointments` | Patient appointment history. Query: `status`, `page`, `limit` |
| GET | `/appointments/providers` | Clinicians and nurses for the schedule |
| GET | `/appointments/day` | Provider day. Query: `providerId`, `date` (`YYYY-MM-DD`, America/Toronto) |
| GET | `/appointments` | List. Query: `patientId`, `providerId`, `status`, `from`, `to`, `page`, `limit` |
| POST | `/appointments` | Create. Body: `patientId`, `providerId`, `clinicLocation`, `appointmentType`, `startTime`, `endTime`, optional `status` (`booked` or `confirmed`) |
| GET | `/appointments/:id` | Get one |
| PATCH | `/appointments/:id` | Status, location, or type. Status follows the visit flow (`booked` → `confirmed` / `arrived` → `completed` or `no_show`). If a visit exists, the visit status is aligned and audited. |
| POST | `/appointments/:id/reschedule` | New `startTime` and `endTime`. Allowed from `booked`, `confirmed`, or `no_show` (a no-show returns to `booked`) |
| POST | `/appointments/:id/cancel` | Sets `cancelled`. Optional `reason`. Allowed from `booked`, `confirmed`, or `arrived` |

Create and reschedule return `409` when the provider or the patient already has a holding appointment in that window. `details` lists each overlap.

Cancelling, rescheduling, or changing appointment status also updates a linked visit when one exists. `waiting`, `roomed`, and `in_progress` are visit statuses; the appointment stays `arrived` until the visit is completed.

## Visits

Operational check-in. Does not create an Encounter. Writes require care-team assignment (administrators bypass). Read scope matches appointments: clinicians and nurses see the full board; caregivers and pharmacists see their care team only.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/visits/board` | Day board. Query: `date` (`YYYY-MM-DD`, America/Toronto), optional `providerId`, `location`. Returns `checkIn` (booked, confirmed), `waitingRoom` (arrived through in progress, earliest arrival first), `providerQueue` (`waiting`, `roomed`, `inProgress`), `closed`, and `examRooms` |
| POST | `/visits/check-in` | Body: `appointmentId`, `demographicsVerified: true`, `healthCardVerified: true`, optional `note`. Sets visit `arrived` with `arrivalAt` and sets the appointment to `arrived`. `409` if already checked in |
| POST | `/visits/room` | Body: `appointmentId`, `examRoom`. From `arrived` or `waiting`, sets `roomed` and `roomedAt`. From `roomed` or `in_progress`, reassigns the room and appends another roomed timeline event |
| POST | `/visits/status` | Body: `appointmentId`, `status` (`waiting`, `in_progress`, `completed`, `no_show`, `cancelled`, `booked`, `confirmed`), optional `reason`, `note`. `in_progress` requires a room. `completed` sets the appointment to `completed`. No-show and cancel from the board create a visit when the patient was never checked in |
| GET | `/visits/:id` | One visit, with timeline actors and the appointment |
| GET | `/patients/:patientId/visits` | Recent visits for the chart |

Arrival is only recorded through check-in. Use room assignment to mark a patient roomed. Status transitions that skip a step return `400`.

## Error shape

```json
{ "error": "Human-readable message", "details": [] }
```

Status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` appointment conflict, `500` server.
