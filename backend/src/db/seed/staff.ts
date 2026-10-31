import type { Role } from '../../types/roles.js';

export type HomeSite = 'Toronto Main' | 'North York' | 'Mississauga';

export type StaffSeed = {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  /** Where this person usually works. Virtual means telehealth, booked from Toronto Main. */
  site: HomeSite | 'Virtual';
  francophone?: boolean;
};

/**
 * Thirty-five accounts. The seven original demo logins keep their passwords.
 * Additional people in a role use that role's demo password.
 */
export const STAFF_SEEDS: StaffSeed[] = [
  { email: 'admin@clinix.local', password: 'Admin123!', displayName: 'Alex Reyes', role: 'admin', site: 'Toronto Main' },
  { email: 'morgan.blake@clinix.local', password: 'Admin123!', displayName: 'Morgan Blake', role: 'admin', site: 'Toronto Main' },
  { email: 'taylor.singh@clinix.local', password: 'Admin123!', displayName: 'Taylor Singh', role: 'admin', site: 'Mississauga' },

  { email: 'doctor@clinix.local', password: 'Doctor123!', displayName: 'Dr. Maya Smith', role: 'clinician', site: 'Toronto Main' },
  { email: 'r.okafor@clinix.local', password: 'Doctor123!', displayName: 'Dr. Rita Okafor', role: 'clinician', site: 'North York' },
  { email: 'h.cho@clinix.local', password: 'Doctor123!', displayName: 'Dr. Helen Cho', role: 'clinician', site: 'Toronto Main' },
  { email: 's.berger@clinix.local', password: 'Doctor123!', displayName: 'Dr. Samuel Berger', role: 'clinician', site: 'Toronto Main' },
  { email: 'a.hassan@clinix.local', password: 'Doctor123!', displayName: 'Dr. Amira Hassan', role: 'clinician', site: 'Toronto Main' },
  { email: 'n.tremblay@clinix.local', password: 'Doctor123!', displayName: 'Dr. Noah Tremblay', role: 'clinician', site: 'North York', francophone: true },
  { email: 'l.rahman@clinix.local', password: 'Doctor123!', displayName: 'Dr. Leila Rahman', role: 'clinician', site: 'North York' },
  { email: 'o.macleod@clinix.local', password: 'Doctor123!', displayName: 'Dr. Owen MacLeod', role: 'clinician', site: 'Mississauga' },
  { email: 'g.adeyemi@clinix.local', password: 'Doctor123!', displayName: 'Dr. Grace Adeyemi', role: 'clinician', site: 'Mississauga' },
  { email: 'm.belanger@clinix.local', password: 'Doctor123!', displayName: 'Dr. Marc-André Bélanger', role: 'clinician', site: 'Mississauga', francophone: true },
  { email: 's.klein@clinix.local', password: 'Doctor123!', displayName: 'Dr. Sophie Klein', role: 'clinician', site: 'Virtual' },
  { email: 'd.rossi@clinix.local', password: 'Doctor123!', displayName: 'NP Daniel Rossi', role: 'clinician', site: 'Toronto Main' },

  { email: 'nurse@clinix.local', password: 'Nurse123!', displayName: 'Nurse Joel Johnson', role: 'nurse', site: 'Toronto Main' },
  { email: 'h.wright@clinix.local', password: 'Nurse123!', displayName: 'Nurse Hannah Wright', role: 'nurse', site: 'Toronto Main' },
  { email: 'e.chen@clinix.local', password: 'Nurse123!', displayName: 'Nurse Emily Chen', role: 'nurse', site: 'Toronto Main' },
  { email: 'm.clark@clinix.local', password: 'Nurse123!', displayName: 'Nurse Megan Clark', role: 'nurse', site: 'Toronto Main' },
  { email: 'f.diallo@clinix.local', password: 'Nurse123!', displayName: 'Nurse Fatima Diallo', role: 'nurse', site: 'North York' },
  { email: 'l.martin@clinix.local', password: 'Nurse123!', displayName: 'Nurse Lucas Martin', role: 'nurse', site: 'North York' },
  { email: 'a.wilson@clinix.local', password: 'Nurse123!', displayName: 'Nurse Andre Wilson', role: 'nurse', site: 'North York' },
  { email: 'b.singh@clinix.local', password: 'Nurse123!', displayName: 'Nurse Brittany Singh', role: 'nurse', site: 'Mississauga' },
  { email: 'c.dubois@clinix.local', password: 'Nurse123!', displayName: 'Nurse Chloe Dubois', role: 'nurse', site: 'Mississauga', francophone: true },
  { email: 'o.farouk@clinix.local', password: 'Nurse123!', displayName: 'Nurse Omar Farouk', role: 'nurse', site: 'Mississauga' },

  { email: 'pharmacist@clinix.local', password: 'Pharm123!', displayName: 'Priya Shah', role: 'pharmacist', site: 'Toronto Main' },
  { email: 'b.cohen@clinix.local', password: 'Pharm123!', displayName: 'Ben Cohen', role: 'pharmacist', site: 'Toronto Main' },
  { email: 'a.wong@clinix.local', password: 'Pharm123!', displayName: 'Alicia Wong', role: 'pharmacist', site: 'North York' },
  { email: 'h.gill@clinix.local', password: 'Pharm123!', displayName: 'Harpreet Gill', role: 'pharmacist', site: 'Mississauga' },

  { email: 'caregiver@clinix.local', password: 'Caregiver123!', displayName: 'Carla Mendoza', role: 'caregiver', site: 'Toronto Main' },
  { email: 'r.lang@clinix.local', password: 'Caregiver123!', displayName: 'Robert Lang', role: 'caregiver', site: 'Toronto Main' },
  { email: 'a.mohammed@clinix.local', password: 'Caregiver123!', displayName: 'Aisha Mohammed', role: 'caregiver', site: 'North York' },
  { email: 'jp.gagnon@clinix.local', password: 'Caregiver123!', displayName: 'Jean-Pierre Gagnon', role: 'caregiver', site: 'North York', francophone: true },
  { email: 'n.costa@clinix.local', password: 'Caregiver123!', displayName: 'Natalie Costa', role: 'caregiver', site: 'Mississauga' },

  { email: 'insight@clinix.local', password: 'Insight123!', displayName: 'CliniX Insight Service', role: 'insight_service', site: 'Toronto Main' },
];
