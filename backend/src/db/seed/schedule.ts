import { Types } from 'mongoose';
import { addDays, slotMs, slotStarts, type ClinicDay } from './calendar.js';
import { CANCEL_REASONS } from './catalog.js';
import { allocateExact, shuffle } from './rng.js';
import { EXAM_ROOMS } from '../../types/visits.js';
import {
  cliniciansAt,
  DAY_MS,
  nursesAt,
  oid,
  sid,
  type AppointmentDraft,
  type AppointmentStatus,
  type AppointmentType,
  type Location,
  type PatientDraft,
  type Site,
  type VisitDraft,
  type VisitStatus,
  type World,
} from './world.js';

type When = 'today' | 'future' | 'saturday' | 'past';
type Kind =
  | 'completed'
  | 'no_show'
  | 'cancel_visit'
  | 'cancel_none'
  | 'arrived'
  | 'waiting'
  | 'roomed'
  | 'in_progress'
  | 'booked'
  | 'confirmed';

type Spec = { patientIndex: number; kind: Kind; when: When };

const PAST_TODAY = new Set<Kind>(['completed', 'no_show', 'cancel_visit', 'arrived', 'waiting', 'roomed', 'in_progress']);

function addKind(list: Spec[], count: number, kind: Kind, when: When) {
  for (let index = 0; index < count; index += 1) list.push({ patientIndex: -1, kind, when });
}

function extraTokens(): Spec[] {
  const tokens: Spec[] = [];
  addKind(tokens, 30, 'completed', 'today');
  addKind(tokens, 12, 'no_show', 'today');
  addKind(tokens, 8, 'cancel_visit', 'today');
  addKind(tokens, 12, 'arrived', 'today');
  addKind(tokens, 28, 'waiting', 'today');
  addKind(tokens, 22, 'roomed', 'today');
  addKind(tokens, 18, 'in_progress', 'today');
  addKind(tokens, 70, 'booked', 'today');
  addKind(tokens, 40, 'confirmed', 'today');
  addKind(tokens, 210, 'booked', 'future');
  addKind(tokens, 180, 'confirmed', 'future');
  addKind(tokens, 180, 'completed', 'saturday');
  addKind(tokens, 4590, 'completed', 'past');
  addKind(tokens, 688, 'no_show', 'past');
  addKind(tokens, 412, 'cancel_visit', 'past');
  addKind(tokens, 500, 'cancel_none', 'past');
  return tokens;
}

function outcome(kind: Kind): { status: AppointmentStatus; visit: VisitStatus | null } {
  if (kind === 'completed') return { status: 'completed', visit: 'completed' };
  if (kind === 'no_show') return { status: 'no_show', visit: 'no_show' };
  if (kind === 'cancel_visit') return { status: 'cancelled', visit: 'cancelled' };
  if (kind === 'cancel_none') return { status: 'cancelled', visit: null };
  if (kind === 'booked') return { status: 'booked', visit: null };
  if (kind === 'confirmed') return { status: 'confirmed', visit: null };
  return { status: 'arrived', visit: kind };
}

function extraWeight(patient: PatientDraft) {
  const cohortCount = Number(patient.cohorts.htn) + Number(patient.cohorts.dm) + Number(patient.cohorts.copd) + Number(patient.cohorts.hf) + Number(patient.cohorts.ckd);
  let weight = 1 + cohortCount * 0.45;
  if (patient.showcase) weight += patient.mrn === 'MRN-1001' ? 2.2 : 1.1;
  if (patient.age >= 65) weight += 0.35;
  if (patient.age < 18) weight *= 0.55;
  return weight;
}

function dayOnOrBefore(days: ClinicDay[], key: string) {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index]!.key <= key) return days[index]!;
  }
  return days[0]!;
}

function dayOnOrAfter(days: ClinicDay[], key: string) {
  return days.find((day) => day.key >= key) ?? days[days.length - 1]!;
}

function bookableBetween(days: ClinicDay[], startKey: string, endKey: string, saturday: boolean) {
  return days.filter((day) => day.key >= startKey && day.key <= endKey && day.saturday === saturday);
}

function providerIds(world: World, patient: PatientDraft, type: AppointmentType) {
  const clinicians = cliniciansAt(world, patient.homeSite).map((person) => sid(person._id));
  const nurses = nursesAt(world, patient.homeSite).map((person) => sid(person._id));
  const primary = sid(patient.clinicianId);
  const french = world.staff.filter((person) => person.role === 'clinician' && person.francophone).map((person) => sid(person._id));
  if (type === 'telehealth') return [...new Set([...(patient.language === 'fr' ? french : []), primary, ...clinicians])];
  if (type === 'procedure') return [...new Set([...nurses, primary, ...clinicians])];
  if (world.rng.chance(0.82)) return [...new Set([primary, ...clinicians, ...nurses])];
  return [...new Set([...shuffle(clinicians, world.rng), primary, ...nurses])];
}

function bookOn(
  world: World,
  days: ClinicDay[],
  span: 1 | 2,
  providers: string[],
  patientId: string,
  notBefore?: number,
  notAfter?: number
) {
  for (const day of days) {
    for (const start of slotStarts(day, span)) {
      if (notBefore != null && start < notBefore) continue;
      if (notAfter != null && start > notAfter) continue;
      for (const providerId of providers) {
        if (!world.calendar.free(providerId, start, span) || !world.calendar.free(patientId, start, span)) continue;
        world.calendar.occupy(providerId, start, span);
        world.calendar.occupy(patientId, start, span);
        return { start, providerId };
      }
    }
  }
  return null;
}

function chooseType(world: World, patient: PatientDraft, kind: Kind, when: When): AppointmentType {
  if (when === 'today') {
    const onFloor = kind === 'completed' || kind === 'arrived' || kind === 'waiting' || kind === 'roomed' || kind === 'in_progress';
    if (onFloor) return 'follow_up';
    if (patient.outOfProvince && world.rng.chance(0.45)) return 'telehealth';
    return world.rng.chance(0.22) ? 'telehealth' : 'follow_up';
  }
  if (when === 'saturday') {
    if (patient.outOfProvince && world.rng.chance(0.45)) return 'telehealth';
    return world.rng.chance(0.18) ? 'telehealth' : 'follow_up';
  }
  if (patient.outOfProvince && world.rng.chance(0.5)) return 'telehealth';
  const roll = world.rng.rand();
  if (kind === 'no_show' && roll < 0.2) return 'consultation';
  if (roll < 0.6) return 'follow_up';
  if (roll < 0.78) return 'telehealth';
  if (roll < 0.9) return 'consultation';
  return 'procedure';
}

function locationFor(patient: PatientDraft, type: AppointmentType, when: When): Location {
  if (type === 'telehealth') return 'Virtual';
  if (when === 'saturday') return 'Toronto Main';
  return patient.homeSite;
}

function spanFor(type: AppointmentType): 1 | 2 {
  return type === 'follow_up' || type === 'telehealth' ? 1 : 2;
}

function pickRoom(location: Location, rng: World['rng'], previous?: string) {
  if (location === 'Virtual') return 'Virtual';
  const rooms = EXAM_ROOMS[location].filter((room) => room !== previous);
  return (rooms.length ? rooms : EXAM_ROOMS[location])[Math.floor(rng.rand() * (rooms.length ? rooms.length : EXAM_ROOMS[location].length))]!;
}

function makeVisit(
  world: World,
  appointment: AppointmentDraft,
  patient: PatientDraft,
  visitStatus: VisitStatus
): VisitDraft {
  const nurseId = patient.nurseId;
  const providerId = appointment.providerId;
  const providerIsClinician = world.staff.some((person) => String(person._id) === String(providerId) && person.role === 'clinician');
  const clinicianActor = providerIsClinician ? providerId : patient.clinicianId;
  const location = appointment.clinicLocation;
  const start = appointment.startTime.getTime();
  const now = world.now.getTime();
  const visit: VisitDraft = {
    _id: oid(),
    appointmentId: appointment._id,
    patientId: patient._id,
    providerId,
    status: visitStatus,
    demographicsVerified: visitStatus !== 'no_show',
    healthCardVerified: visitStatus !== 'no_show',
    timeline: [],
    deletedAt: null,
    createdAt: appointment.startTime,
    updatedAt: appointment.startTime,
    _anchor: appointment._anchor,
    _patientIndex: appointment._patientIndex,
    _location: location,
  };
  if (visitStatus === 'no_show') {
    visit.note = 'Patient did not arrive. Front desk confirmed there was no check-in.';
    visit.demographicsVerified = false;
    visit.healthCardVerified = false;
    return visit;
  }

  const ceiling = Math.min(now - 60 * 1000, start + 90 * 60 * 1000);
  const arrivalMs = Math.min(ceiling - 4 * 60 * 1000, start + world.rng.int(-8, 8) * 60 * 1000);
  const arrival = new Date(Math.max(start - 15 * 60 * 1000, arrivalMs));
  const waitMinutes = location === 'Virtual' ? world.rng.int(1, 8) : location === 'Toronto Main' ? world.rng.int(8, 48) : world.rng.int(5, 32);
  const longWait = location !== 'Virtual' && world.rng.chance(0.05);
  const roomedMs = arrival.getTime() + (longWait ? world.rng.int(50, 75) : waitMinutes) * 60 * 1000;
  const startedMs = roomedMs + world.rng.int(3, 16) * 60 * 1000;
  const completedMs = startedMs + world.rng.int(8, 28) * 60 * 1000;
  const steps: VisitStatus[] =
    visitStatus === 'arrived'
      ? ['arrived']
      : visitStatus === 'waiting'
        ? ['arrived', 'waiting']
        : visitStatus === 'roomed'
          ? ['arrived', 'waiting', 'roomed']
          : visitStatus === 'in_progress'
            ? ['arrived', 'waiting', 'roomed', 'in_progress']
            : visitStatus === 'cancelled'
              ? world.rng.chance(0.35)
                ? ['arrived', 'waiting', 'roomed']
                : ['arrived', 'waiting']
              : ['arrived', 'waiting', 'roomed', 'in_progress', 'completed'];

  const times = new Map<VisitStatus, number>([
    ['arrived', arrival.getTime()],
    ['waiting', arrival.getTime() + 60 * 1000],
    ['roomed', roomedMs],
    ['in_progress', startedMs],
    ['completed', completedMs],
  ]);
  let cursor = arrival.getTime();
  const room = steps.includes('roomed') ? pickRoom(location, world.rng) : undefined;
  let secondRoom: string | undefined;
  const reassign = Boolean(room && location !== 'Virtual' && steps.includes('roomed') && world.rng.chance(0.08));
  for (const step of steps) {
    let at = times.get(step) ?? cursor + 60 * 1000;
    if (at <= cursor) at = cursor + 30 * 1000;
    if (at > ceiling) at = Math.max(cursor + 30 * 1000, ceiling);
    cursor = at;
    const actorId = step === 'in_progress' || step === 'completed' ? clinicianActor : nurseId;
    const eventRoom = step === 'roomed' || step === 'in_progress' || step === 'completed' ? room : undefined;
    visit.timeline.push({
      event: step,
      at: new Date(at),
      actorId,
      examRoom: eventRoom,
    });
    if (step === 'arrived') visit.arrivalAt = new Date(at);
    if (step === 'roomed') {
      visit.roomedAt = new Date(at);
      visit.examRoom = room ?? null;
    }
    if (step === 'in_progress') visit.startedAt = new Date(at);
    if (step === 'completed') visit.completedAt = new Date(at);
  }
  if (reassign && room && visit.roomedAt) {
    const roomedIndex = visit.timeline.findIndex((event) => event.event === 'roomed');
    const nextAt = visit.timeline[roomedIndex + 1]?.at.getTime();
    const earliest = visit.roomedAt.getTime() + 30 * 1000;
    const latest = nextAt == null ? earliest + 5 * 60 * 1000 : nextAt - 30 * 1000;
    if (latest > earliest) {
      secondRoom = pickRoom(location, world.rng, room);
      visit.timeline.splice(roomedIndex + 1, 0, {
        event: 'roomed',
        at: new Date(earliest + world.rng.rand() * (latest - earliest)),
        actorId: nurseId,
        examRoom: secondRoom,
        note: `Moved from ${room}`,
      });
      visit.examRoom = secondRoom;
    }
  }
  if (visitStatus === 'cancelled') {
    visit.cancelReason = world.rng.pick(CANCEL_REASONS);
    visit.note = 'Visit closed from the board after the patient had arrived.';
  } else if (world.rng.chance(0.08)) {
    visit.note = world.rng.pick(['Interpreter booked', 'Patient fasting', 'Uses a wheelchair', 'Running late from work', 'Caregiver present']);
  }
  visit.updatedAt = visit.completedAt ?? visit.startedAt ?? visit.roomedAt ?? visit.arrivalAt ?? visit.createdAt;
  return visit;
}

function place(
  world: World,
  patientIndex: number,
  kind: Kind,
  when: When,
  anchor: 'new' | 'follow' | null,
  type: AppointmentType,
  days: ClinicDay[],
  notBefore?: number,
  notAfter?: number
) {
  const patient = world.patients[patientIndex]!;
  const span = spanFor(type);
  let usedSpan: 1 | 2 = span;
  let providers = providerIds(world, patient, type);
  if (when === 'saturday') {
    providers = cliniciansAt(world, 'Toronto Main')
      .filter((person) => person.site === 'Toronto Main')
      .map((person) => sid(person._id));
  }
  let booked = bookOn(world, days, span, providers, sid(patient._id), notBefore, notAfter);
  if (!booked) {
    const wider = cliniciansAt(world, patient.homeSite).concat(nursesAt(world, patient.homeSite)).map((person) => sid(person._id));
    booked = bookOn(world, days, span, wider, sid(patient._id), notBefore, notAfter);
  }
  if (!booked && span === 2) {
    booked = bookOn(world, days, 1, providers, sid(patient._id), notBefore, notAfter);
    if (booked) usedSpan = 1;
  }
  if (!booked) {
    throw new Error(`no slot for ${patient.mrn} ${kind} ${when} ${type} among ${days.length} days`);
  }
  const { status, visit } = outcome(kind);
  const startTime = new Date(booked.start);
  const endTime = new Date(booked.start + usedSpan * slotMs());
  const createdAtMs = Math.min(
    world.now.getTime() - 60 * 60 * 1000,
    Math.max(patient.createdAt.getTime() + 60 * 60 * 1000, startTime.getTime() - world.rng.int(2, 18) * DAY_MS)
  );
  const createdAt = new Date(Math.min(createdAtMs, startTime.getTime() - 60 * 60 * 1000));
  const appointment: AppointmentDraft = {
    _id: oid(),
    patientId: patient._id,
    providerId: new Types.ObjectId(booked.providerId),
    clinicLocation: locationFor(patient, type, when),
    appointmentType: type,
    startTime,
    endTime,
    status,
    deletedAt: null,
    createdAt,
    updatedAt: startTime,
    _anchor: anchor,
    _patientIndex: patientIndex,
    _kind: kind,
  };
  if (status === 'cancelled') appointment.cancelReason = world.rng.pick(CANCEL_REASONS);
  if (status === 'confirmed') appointment.updatedAt = new Date(Math.min(world.now.getTime(), createdAt.getTime() + DAY_MS));
  if (status === 'booked') appointment.updatedAt = createdAt;
  world.appointments.push(appointment);
  if (visit) {
    const visitDoc = makeVisit(world, appointment, patient, visit);
    if (visitDoc.cancelReason) appointment.cancelReason = visitDoc.cancelReason;
    if (visitDoc.completedAt) appointment.updatedAt = visitDoc.completedAt;
    else if (visitDoc.arrivalAt) appointment.updatedAt = visitDoc.updatedAt;
    world.visits.push(visitDoc);
  }
}

function registrationDay(world: World, index: number) {
  const patient = world.patients[index]!;
  let back = 90 + Math.floor(world.rng.rand() * 120);
  const roll = world.rng.rand();
  if (patient.showcase) back = 1060 - index * 20;
  else if (roll >= 0.2 && roll < 0.7) back = 250 + Math.floor(world.rng.rand() * 500);
  else if (roll >= 0.7) back = 860 + Math.floor(world.rng.rand() * 280);
  const target = addDays(world.today, -back);
  const day = dayOnOrBefore(world.days, target.key);
  const earliest = world.days.find((item) => !item.saturday);
  if (!earliest || day.key < earliest.key) return earliest ?? day;
  return day;
}

function bookAnchors(world: World) {
  const yesterday = addDays(world.today, -1).key;
  world.patients.forEach((patient, index) => {
    const registered = registrationDay(world, index);
    patient._registeredKey = registered.key;
    patient.createdAt = new Date(registered.y, registered.m - 1, registered.d, 9, 15);
    // createdAt above is local server time. Use the clinic instant instead.
    patient.createdAt = new Date(slotStarts(registered, 1)[0] ?? world.now.getTime() - 90 * DAY_MS);
    patient.createdAt = new Date(patient.createdAt.getTime() - 2 * 60 * 60 * 1000);
    patient.updatedAt = new Date(patient.createdAt.getTime() + (index < 180 ? 12 : 0) * DAY_MS);
    if (patient.updatedAt.getTime() > world.now.getTime()) patient.updatedAt = patient.createdAt;

    const newStart = dayOnOrAfter(world.days, addDays(registered, 1).key);
    const newEnd = dayOnOrBefore(world.days, addDays(world.today, -50).key);
    const newDays = bookableBetween(world.days, newStart.key, newEnd.key < newStart.key ? newStart.key : newEnd.key, false).slice(0, 12);
    place(world, index, 'completed', 'past', 'new', 'new_patient', newDays.length ? newDays : [newStart]);
    const newAppt = world.appointments[world.appointments.length - 1]!;
    const followDays = world.days.filter((day) => {
      const first = slotStarts(day, 1)[0] ?? 0;
      return !day.saturday && first > newAppt.endTime.getTime() + 18 * DAY_MS && day.key <= yesterday;
    });
    const followType: AppointmentType = patient.outOfProvince || world.rng.chance(0.22) ? 'telehealth' : 'follow_up';
    place(world, index, 'completed', 'past', 'follow', followType, followDays.slice(0, 40));
  });
}

function dealExtras(world: World) {
  const tokens = shuffle(extraTokens(), world.rng);
  if (tokens.length !== 7000) throw new Error(`expected 7000 extra appointments, got ${tokens.length}`);
  const targets = allocateExact(world.patients.length, 7000, 4, 32, (index) => extraWeight(world.patients[index]!));
  const remaining = targets.slice();
  const futureCount = new Array(world.patients.length).fill(0);
  const usedToday = new Set<number>();
  const groups: When[] = ['today', 'saturday', 'future', 'past'];
  const specs: Spec[] = [];
  for (const when of groups) {
    for (const token of tokens.filter((item) => item.when === when)) {
      const start = world.rng.int(0, world.patients.length - 1);
      let chosen = -1;
      for (let step = 0; step < world.patients.length; step += 1) {
        const index = (start + step) % world.patients.length;
        if ((remaining[index] ?? 0) <= 0) continue;
        if (when === 'today' && usedToday.has(index)) continue;
        if (when === 'saturday' && world.patients[index]!.homeSite !== 'Toronto Main') continue;
        if (when === 'future' && futureCount[index] >= 2) continue;
        chosen = index;
        break;
      }
      if (chosen < 0) throw new Error(`could not place ${token.kind} on ${when}`);
      remaining[chosen] = (remaining[chosen] ?? 0) - 1;
      if (when === 'today') usedToday.add(chosen);
      if (when === 'future') futureCount[chosen] += 1;
      specs.push({ patientIndex: chosen, kind: token.kind, when });
    }
  }
  if (remaining.some((count) => count !== 0)) throw new Error('appointment allocation did not balance');
  return specs;
}

function bookExtras(world: World, specs: Spec[]) {
  const yesterdayKey = addDays(world.today, -1).key;
  const futureDays = world.days.filter((day) => day.key > world.today.key && !day.saturday);
  const soon = futureDays.slice(0, 6);
  const later = futureDays.slice(6);
  const todayPast = slotStarts(world.today, 1).filter((start) => start < world.now.getTime() - 10 * 60 * 1000);
  const todayFuture = slotStarts(world.today, 1).filter((start) => start > world.now.getTime() + 20 * 60 * 1000);
  if (todayPast.length < 4 || todayFuture.length < 4) {
    throw new Error('seed the dataset during clinic hours so today has morning and afternoon slots');
  }

  const todaySpecs = specs.filter((spec) => spec.when === 'today');
  const pastKinds: Kind[] = ['completed', 'no_show', 'cancel_visit', 'arrived', 'waiting', 'roomed', 'in_progress'];
  todaySpecs.sort((a, b) => {
    const rank = (kind: Kind) => {
      const index = pastKinds.indexOf(kind);
      return index < 0 ? pastKinds.length : index;
    };
    return rank(a.kind) - rank(b.kind);
  });
  const placeToday = (patient: PatientDraft, spec: Spec, type: AppointmentType, providers: string[]) => {
    const past = PAST_TODAY.has(spec.kind);
    const slots = past ? todayPast : todayFuture;
    for (const providerId of providers) {
      for (const start of slots) {
        if (!world.calendar.free(providerId, start, 1) || !world.calendar.free(sid(patient._id), start, 1)) continue;
        world.calendar.occupy(providerId, start, 1);
        world.calendar.occupy(sid(patient._id), start, 1);
        const { status, visit } = outcome(spec.kind);
        const startTime = new Date(start);
        const appointment: AppointmentDraft = {
          _id: oid(),
          patientId: patient._id,
          providerId: new Types.ObjectId(providerId),
          clinicLocation: locationFor(patient, type, 'today'),
          appointmentType: type,
          startTime,
          endTime: new Date(start + slotMs()),
          status,
          deletedAt: null,
          createdAt: new Date(world.now.getTime() - world.rng.int(2, 20) * DAY_MS),
          updatedAt: startTime,
          _anchor: null,
          _patientIndex: spec.patientIndex,
          _kind: spec.kind,
        };
        if (status === 'cancelled') appointment.cancelReason = world.rng.pick(CANCEL_REASONS);
        world.appointments.push(appointment);
        if (visit) world.visits.push(makeVisit(world, appointment, patient, visit));
        return true;
      }
    }
    return false;
  };
  for (const spec of todaySpecs) {
    const patient = world.patients[spec.patientIndex]!;
    const type = chooseType(world, patient, spec.kind, 'today');
    const providers = shuffle(providerIds(world, patient, type), world.rng);
    let placed = placeToday(patient, spec, type, providers);
    if (!placed && type === 'telehealth') {
      const onSite = shuffle(
        [...new Set([...cliniciansAt(world, patient.homeSite), ...nursesAt(world, patient.homeSite)].map((person) => sid(person._id)))],
        world.rng
      );
      placed = placeToday(patient, spec, 'follow_up', onSite);
    }
    if (!placed) throw new Error(`today slot missing for ${patient.mrn} ${spec.kind} at ${patient.homeSite}`);
  }

  for (const spec of specs.filter((item) => item.when !== 'today')) {
    const patient = world.patients[spec.patientIndex]!;
    const type = chooseType(world, patient, spec.kind, spec.when);
    let days: ClinicDay[] = [];
    if (spec.when === 'future') {
      days = world.rng.chance(0.7) ? soon : later.length ? later : soon;
      if (days.length === 0) days = futureDays;
    } else if (spec.when === 'saturday') {
      days = shuffle(
        world.days.filter((day) => day.saturday && day.key < world.today.key && day.key > patient._registeredKey),
        world.rng
      ).slice(0, 12);
    } else {
      const pool = world.days.filter((day) => !day.saturday && day.key > patient._registeredKey && day.key <= yesterdayKey);
      const weighted = [...pool].sort((a, b) => world.rng.rand() * b.weight - world.rng.rand() * a.weight);
      days = weighted.slice(0, 16);
    }
    place(world, spec.patientIndex, spec.kind, spec.when, null, type, days);
  }
}

export function buildSchedule(world: World) {
  bookAnchors(world);
  bookExtras(world, dealExtras(world));
  if (world.appointments.length !== 8000) {
    throw new Error(`expected 8000 appointments, built ${world.appointments.length}`);
  }
  if (world.visits.length !== 7000) {
    throw new Error(`expected 7000 visits, built ${world.visits.length}`);
  }
}
