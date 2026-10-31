# CliniX Core — FHIR Mapping (Future)

Core is **not** a FHIR server. Field names and enums are chosen to ease a later FHIR R4 export.

| CliniX entity | FHIR resource | Notes |
|---------------|---------------|-------|
| Patient | Patient | `mrn` → identifier; legal name → HumanName; `preferredName` → usual; `sex` → gender (sex at birth); `genderIdentity` → extension; `provincialHealth` → identifier (provincial); `address` → Address; contacts → Contact |
| Condition | Condition | `status` → clinicalStatus; `code`/`codeSystem` → CodeableConcept |
| Vital | Observation | Each measurement or one multi-component Observation |
| Medication | MedicationStatement | `status` maps to MedicationStatement.status |
| Encounter | Encounter | `periodStart`/`periodEnd` → Period; `type` → type coding |
| CarePlan | CarePlan | goals → goal; interventions → activity |
| CarePlanGoal | Goal | `title` → description; `targetValue` → target |
| CarePlanIntervention | CarePlan.activity | `type` → detail.code category |
| Task | Task | `assigneeRole` → owner / performer role |
| ClinicalNote | DocumentReference | Or Annotation on Encounter; revisions share `rootId`; `version` is the revision number |
| Allergy | AllergyIntolerance | `substance` → code.text; `status` → clinicalStatus |
| Appointment | Appointment | `startTime`/`endTime` → start/end; `providerId` → participant actor; `clinicLocation` → participant location |
| Visit | — | Operational flow only. Not exported as Encounter. `waiting`, `roomed`, and `in_progress` remain Appointment `arrived` until the visit is `completed` (`fulfilled`) |

## Medication.status

| CliniX | FHIR MedicationStatement.status (approx.) |
|--------|-------------------------------------------|
| active | active |
| completed | completed |
| discontinued | stopped |
| on-hold | on-hold |

## Appointment.status

| CliniX | FHIR Appointment.status (approx.) |
|--------|-----------------------------------|
| booked | booked |
| confirmed | booked |
| arrived | arrived |
| no_show | noshow |
| cancelled | cancelled |
| completed | fulfilled |

## Vital.source

Map to Observation.method / device / performer extension later (`clinic`, `home`, `device`, `caregiver`).
