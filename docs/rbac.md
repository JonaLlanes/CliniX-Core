# CliniX Core — Role-Based Access Control

## Roles

| Role | Description |
|------|-------------|
| `clinician` | Physicians / NPs — broad clinical write |
| `nurse` | Nursing — vitals, notes, tasks, limited meds |
| `caregiver` | Family / support — read + home/caregiver vitals |
| `pharmacist` | Medication list write |
| `admin` | Full access including user management |
| `insight_service` | Machine account for CliniX Insight (read-heavy) |

## Permission matrix

| Resource | clinician | nurse | caregiver | pharmacist | admin | insight_service |
|----------|-----------|-------|-----------|------------|-------|-----------------|
| Patients | RW | RW | R | R | RW | R |
| Conditions | RW | RW | R | R | RW | R |
| Vitals | RW | RW | RW* | R | RW | R |
| Medications | RW | R | R | RW | RW | R |
| Encounters / Notes | RW | RW | R | R | RW | R |
| Appointments | RW | RW | R | R | RW | R |
| Visits (check-in) | RW | RW | R | R | RW | R |
| Care plans | RW | RW | R | R | RW | R |
| Tasks | RW | RW† | RW† | RW† | RW | R |
| Users / roles | — | — | — | — | RW | — |

\*Caregiver may create/update vitals with `source` in `home` | `caregiver` | `device`.  
†Role-scoped users may update tasks where `assigneeRole` matches their role (or they are `assigneeUserId`).

## Enforcement

1. `authenticate` — verify JWT, attach `req.user`
2. `authorize(...roles)` — role allowlist
3. Resource handlers enforce write rules (e.g. caregiver vital source)

Chart access: reads and writes are limited to `Patient.careTeam`, except `admin` (full access) and `insight_service` (read bypass for analytics). A clinician or nurse who registers a patient is added to that care team. Non-admins cannot remove themselves.

## Allergies

| Resource | clinician | nurse | caregiver | pharmacist | admin | insight_service |
|----------|-----------|-------|-----------|------------|-------|-----------------|
| Allergies | RW | RW | R | R | RW | R |
| Audit history | R | R | R | R | R | R |

Allergy and audit reads still require care-team assignment, aside from the admin and insight bypass above.

## Appointments

Clinicians, nurses, and administrators book, reschedule, cancel, and move status. A write still requires care-team assignment, except for administrators. Clinicians and nurses can read any provider's day. Caregivers, pharmacists, and other chart-scoped readers only see appointments for patients on their care team. `insight_service` can read appointments, including the provider day.

## Visits

Check-in, room assignment, and visit status use the same roles as appointments. A write still requires care-team assignment, except for administrators. Clinicians and nurses can read the clinic board for any provider. Caregivers and pharmacists only see visits for patients on their care team. `insight_service` can read the board and a patient's visits.

Check-in, room assignment, and status changes are written to the chart audit log as `Visit` create or update events. When the visit changes the appointment status, that appointment update is audited as well. Schedule changes that close or reopen an appointment update the linked visit and audit that visit change.

## Population reports

`GET /reports/*` is clinic-wide operational, clinical, and cohort reporting. It is limited to `clinician`, `nurse`, and `admin`. Caregivers, pharmacists, and `insight_service` receive `403`. These totals are not filtered to the caller's care team. Chart reads outside `/reports` stay care-team scoped.
