# CliniX Core — Data Model

Source-of-truth clinical data for CliniX Insight. MongoDB collections via Mongoose. All documents include `createdAt` / `updatedAt` unless noted.

## Entity overview

| Collection | Purpose | FHIR analogue |
|------------|---------|---------------|
| User | Staff / service accounts | Practitioner / Person |
| Patient | Demographics | Patient |
| Condition | Diagnoses | Condition |
| Vital | Physiological measurements | Observation |
| Medication | Medication list | MedicationStatement |
| Encounter | Visits | Encounter |
| CarePlan | Goals + interventions | CarePlan |
| Task | Assignable work items | Task |
| ClinicalNote | Free-text notes, immutable revisions | DocumentReference (simplified) |
| Allergy | Allergy and intolerance list | AllergyIntolerance |
| AuditEvent | Create, update, and delete history | AuditEvent |
| Appointment | Booked visits and the provider day | Appointment |
| Visit | Check-in through rooming and provider flow | Encounter (operational only; clinical Encounter is separate) |

## Relationships

- Patient 1→N Condition, Vital, Medication, Encounter, CarePlan, Task, ClinicalNote, Allergy, Appointment, Visit
- Appointment 1→0..1 Visit (created at check-in, or when the appointment is closed as no-show or cancelled from the board)
- Patient N→N User through `careTeam` (chart access)
- Encounter 1→N ClinicalNote (optional link)
- ClinicalNote revisions share `rootId`; `version` increases and the previous document is not overwritten
- CarePlan embeds CarePlanGoal[] and CarePlanIntervention[]; Task may reference carePlanId
- User referenced as prescriber, clinician, note author, task assignee, audit actor, care-team member, appointment provider

## Field rules

### User
- `email` unique, `passwordHash`, `displayName`
- `role`: `clinician` | `nurse` | `caregiver` | `admin` | `pharmacist` | `insight_service`

### Patient (Canadian registration)
- `mrn` unique
- **Legal name:** `givenName`, `familyName`; optional `preferredName`
- `birthDate`, `language`: `en` | `fr` | `other`
- `sex` (sex at birth): `female` | `male` | `other` | `unknown`
- `genderIdentity`: `female` | `male` | `non-binary` | `two-spirit` | `other` | `prefer-not-to-say` | `unknown`
- `contact`: `{ phone?, email?, address? }` (legacy free-text `address` kept for display)
- `address`: `{ street?, city?, province?, postalCode?, country? }` (structured; `country` defaults to `CA`)
- `provincialHealth`: `{ province, healthCardNumber, versionCode? }` — province is a Canadian province/territory code; `versionCode` is Ontario-only (2 letters). Unique on `(province, healthCardNumber)` when present.
- `emergencyContact` / `substituteDecisionMaker`: `{ name, relationship?, phone?, phoneSecondary? }`
- `identifiers`: `{ insuranceMemberId?, nationalId? }` (optional)
- `careTeam`: user ids allowed to open the chart. Administrators are not required to be listed.

### Condition
- `patientId`, `display`, `onsetDate?`
- `status`: `active` | `resolved` | `inactive`
- `severity`: `mild` | `moderate` | `severe` | `unknown`
- `codeSystem`: `ICD-10` | `SNOMED` (optional), `code` (optional)

### Vital
- `patientId`, `effectiveAt`
- `source`: `clinic` | `home` | `device` | `caregiver`
- `measurements` (all optional numbers, server-validated ranges):
  - `systolicBp`, `diastolicBp`, `heartRate`, `respiratoryRate`, `temperatureC`, `spo2`, `weightKg`, `heightCm`

### Medication
- `patientId`, `prescriberId?`, `name`, `dose`, `route`, `frequency`
- `startDate`, `endDate?`
- `status`: `active` | `completed` | `discontinued` | `on-hold`
- `adherenceNotes?`

### Encounter
- `patientId`, `clinicianId?`
- `periodStart` (required), `periodEnd?` (must be ≥ periodStart)
- `type`: `clinic` | `telehealth` | `follow_up`
- `summary?`

### CarePlan
- `patientId`, `title`, `status`: `draft` | `active` | `completed` | `cancelled`
- **goals[]** (CarePlanGoal):
  - `title` (required)
  - `targetValue?` (e.g. `"<130/80"`)
  - `status`: `proposed` | `in_progress` | `achieved` | `cancelled`
- **interventions[]** (CarePlanIntervention):
  - `description` (required)
  - `type`: `education` | `medication_change` | `lifestyle` | `follow_up`
  - `status`: `planned` | `in_progress` | `completed` | `cancelled`

### Task
- `patientId`, `carePlanId?`, `title`
- `assigneeRole`: `clinician` | `nurse` | `caregiver` | `pharmacist`
- `assigneeUserId?`
- `status`: `pending` | `in_progress` | `completed`
- `dueDate?`

### ClinicalNote
- `patientId`, `encounterId?`, `authorId`
- `body`, `version` (starts at 1; each edit inserts a new document)
- `rootId` groups revisions. Previous versions are kept.
- `createdAt`, `updatedAt` (audit timestamps; body is not overwritten)

### Allergy
- `patientId`, `substance`, `reaction`
- `severity`: `mild` | `moderate` | `severe`
- `status`: `active` | `inactive`
- `recordedDate`

### Appointment
- `patientId`, `providerId` (clinician or nurse)
- `clinicLocation`: `Toronto Main` | `North York` | `Mississauga` | `Virtual`
- `appointmentType`: `new_patient` | `follow_up` | `consultation` | `procedure` | `telehealth`
- `startTime`, `endTime` (end after start, 5 minutes to 8 hours)
- `status`: `booked` | `confirmed` | `arrived` | `no_show` | `cancelled` | `completed`
- `cancelReason?`
- Overlap checks treat `booked`, `confirmed`, `arrived`, and `completed` as occupying the provider and the patient. `cancelled` and `no_show` do not block the slot. The clinic day is `America/Toronto`.
- While a visit is `waiting`, `roomed`, or `in_progress`, the appointment stays `arrived`. Completing the visit sets the appointment to `completed`. No-show and cancel on the visit set the same status on the appointment.

### Visit
Operational patient flow for a scheduled appointment. This is not a clinical Encounter.
- `appointmentId` (one active visit per appointment), `patientId`, `providerId`
- `status`: `booked` | `confirmed` | `arrived` | `waiting` | `roomed` | `in_progress` | `completed` | `no_show` | `cancelled`
- `arrivalAt`, `roomedAt` (first time roomed), `startedAt`, `completedAt`
- `examRoom` — clinic rooms are `Exam 1`–`Exam 4` at Toronto Main, `Exam 1`–`Exam 3` at North York and Mississauga, and `Virtual` for virtual visits
- `demographicsVerified`, `healthCardVerified` — both required at check-in
- `note?`, `cancelReason?`
- **timeline[]**: `arrived` | `waiting` | `roomed` | `in_progress` | `completed`, each with `at`, `actorId`, optional `examRoom` and `note`. Reassignment appends another `roomed` event and does not change `roomedAt`.

### AuditEvent
- `userId`, `role`, `action`: `create` | `update` | `delete`
- `resourceType`, `resourceId`, `patientId?`
- `before`, `after` (null on create / delete respectively)
- `timestamp`

## Indexes

- Patient: unique `mrn`; text on `givenName` + `familyName` + `preferredName`; `birthDate`; `provincialHealth.healthCardNumber`; unique compound `(provincialHealth.province, provincialHealth.healthCardNumber)` when HCN present
- Vital: `{ patientId, effectiveAt }`
- Condition / Medication / Task: `{ patientId, status }`
- Encounter: `{ patientId, periodStart }`
- Appointment: `{ providerId, startTime }`, `{ patientId, startTime }`, `{ providerId, status, startTime }`
- Visit: unique `appointmentId` while `deletedAt` is null; `{ status, arrivalAt }`; `{ providerId, status, arrivalAt }`; `{ patientId, createdAt }`
