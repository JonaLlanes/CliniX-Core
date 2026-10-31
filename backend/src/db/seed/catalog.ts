/**
 * Clinical catalogs for an Ontario outpatient panel.
 * ICD-10-CA codes match the pattern enforced by diagnosis validation.
 * Cohort codes also match the report filters in cohortService.
 * DINs are marketed Health Canada drug identification numbers.
 */

export type CohortKey = 'htn' | 'dm' | 'copd' | 'hf' | 'ckd';

export type ProblemTemplate = {
  code: string;
  system: 'ICD-10-CA' | 'SNOMED';
  /** ICD-10-CA used on the encounter when the problem itself is SNOMED. */
  encounterCode?: string;
  display: string;
  chronic: boolean;
  weight: number;
  cohort?: CohortKey;
  minAge?: number;
  maxAge?: number;
  sex?: 'female' | 'male';
};

export type MedTemplate = {
  genericName: string;
  brandName: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  din?: string;
  /** Condition code prefixes this drug is used for. `*` is a general fallback. */
  prefixes: string[];
  allergyClass?: string;
};

export type AllergyTemplate = {
  substance: string;
  reactions: string[];
  allergyClass?: string;
};

export const PROBLEMS: ProblemTemplate[] = [
  { code: 'I10', system: 'ICD-10-CA', display: 'Essential (primary) hypertension', chronic: true, weight: 12, cohort: 'htn', minAge: 30 },
  { code: 'I11.9', system: 'ICD-10-CA', display: 'Hypertensive heart disease without heart failure', chronic: true, weight: 2, cohort: 'htn', minAge: 50 },
  { code: 'I12.9', system: 'ICD-10-CA', display: 'Hypertensive chronic kidney disease', chronic: true, weight: 2, cohort: 'htn', minAge: 50 },
  { code: 'I15.9', system: 'ICD-10-CA', display: 'Secondary hypertension, unspecified', chronic: true, weight: 1, cohort: 'htn', minAge: 40 },
  { code: 'E11.9', system: 'ICD-10-CA', display: 'Type 2 diabetes mellitus without complications', chronic: true, weight: 10, cohort: 'dm', minAge: 30 },
  { code: 'E11.22', system: 'ICD-10-CA', display: 'Type 2 diabetes mellitus with diabetic chronic kidney disease', chronic: true, weight: 2, cohort: 'dm', minAge: 40 },
  { code: 'E11.40', system: 'ICD-10-CA', display: 'Type 2 diabetes mellitus with diabetic neuropathy', chronic: true, weight: 2, cohort: 'dm', minAge: 40 },
  { code: 'E11.65', system: 'ICD-10-CA', display: 'Type 2 diabetes mellitus with hyperglycemia', chronic: true, weight: 2, cohort: 'dm', minAge: 30 },
  { code: 'E10.9', system: 'ICD-10-CA', display: 'Type 1 diabetes mellitus without complications', chronic: true, weight: 1, cohort: 'dm', minAge: 6 },
  { code: 'E13.9', system: 'ICD-10-CA', display: 'Other specified diabetes mellitus without complications', chronic: true, weight: 1, cohort: 'dm', minAge: 30 },
  { code: 'J44.9', system: 'ICD-10-CA', display: 'Chronic obstructive pulmonary disease, unspecified', chronic: true, weight: 4, cohort: 'copd', minAge: 40 },
  { code: 'J44.1', system: 'ICD-10-CA', display: 'Chronic obstructive pulmonary disease with acute exacerbation', chronic: false, weight: 2, cohort: 'copd', minAge: 40 },
  { code: 'J43.9', system: 'ICD-10-CA', display: 'Emphysema, unspecified', chronic: true, weight: 1, cohort: 'copd', minAge: 45 },
  { code: 'I50.9', system: 'ICD-10-CA', display: 'Heart failure, unspecified', chronic: true, weight: 3, cohort: 'hf', minAge: 50 },
  { code: 'I50.22', system: 'ICD-10-CA', display: 'Chronic systolic (congestive) heart failure', chronic: true, weight: 2, cohort: 'hf', minAge: 50 },
  { code: 'I50.32', system: 'ICD-10-CA', display: 'Chronic diastolic (congestive) heart failure', chronic: true, weight: 1, cohort: 'hf', minAge: 55 },
  { code: 'N18.2', system: 'ICD-10-CA', display: 'Chronic kidney disease, stage 2', chronic: true, weight: 3, cohort: 'ckd', minAge: 40 },
  { code: 'N18.3', system: 'ICD-10-CA', display: 'Chronic kidney disease, stage 3', chronic: true, weight: 3, cohort: 'ckd', minAge: 45 },
  { code: 'N18.4', system: 'ICD-10-CA', display: 'Chronic kidney disease, stage 4', chronic: true, weight: 1, cohort: 'ckd', minAge: 50 },
  { code: 'N18.9', system: 'ICD-10-CA', display: 'Chronic kidney disease, unspecified', chronic: true, weight: 1, cohort: 'ckd', minAge: 40 },
  { code: 'E78.5', system: 'ICD-10-CA', display: 'Hyperlipidemia, unspecified', chronic: true, weight: 8, minAge: 30 },
  { code: 'E78.0', system: 'ICD-10-CA', display: 'Pure hypercholesterolemia', chronic: true, weight: 4, minAge: 30 },
  { code: 'E03.9', system: 'ICD-10-CA', display: 'Hypothyroidism, unspecified', chronic: true, weight: 4, minAge: 18 },
  { code: 'E66.9', system: 'ICD-10-CA', display: 'Obesity, unspecified', chronic: true, weight: 5, minAge: 12 },
  { code: 'I25.10', system: 'ICD-10-CA', display: 'Atherosclerotic heart disease of native coronary artery', chronic: true, weight: 3, minAge: 45 },
  { code: 'I48.91', system: 'ICD-10-CA', display: 'Unspecified atrial fibrillation', chronic: true, weight: 3, minAge: 45 },
  { code: 'I48.0', system: 'ICD-10-CA', display: 'Paroxysmal atrial fibrillation', chronic: true, weight: 2, minAge: 45 },
  { code: 'J45.909', system: 'ICD-10-CA', display: 'Unspecified asthma, uncomplicated', chronic: true, weight: 4, minAge: 4 },
  { code: 'J45.40', system: 'ICD-10-CA', display: 'Moderate persistent asthma, uncomplicated', chronic: true, weight: 2, minAge: 6 },
  { code: 'F33.1', system: 'ICD-10-CA', display: 'Major depressive disorder, recurrent, moderate', chronic: true, weight: 4, minAge: 16 },
  { code: 'F32.9', system: 'ICD-10-CA', display: 'Major depressive disorder, single episode, unspecified', chronic: false, weight: 2, minAge: 16 },
  { code: 'F41.1', system: 'ICD-10-CA', display: 'Generalized anxiety disorder', chronic: true, weight: 4, minAge: 16 },
  { code: 'F17.210', system: 'ICD-10-CA', display: 'Nicotine dependence, cigarettes, uncomplicated', chronic: true, weight: 3, minAge: 18 },
  { code: 'K21.9', system: 'ICD-10-CA', display: 'Gastro-esophageal reflux disease without esophagitis', chronic: true, weight: 5, minAge: 18 },
  { code: 'M17.11', system: 'ICD-10-CA', display: 'Unilateral primary osteoarthritis, right knee', chronic: true, weight: 3, minAge: 45 },
  { code: 'M17.9', system: 'ICD-10-CA', display: 'Osteoarthritis of knee, unspecified', chronic: true, weight: 3, minAge: 45 },
  { code: 'M81.0', system: 'ICD-10-CA', display: 'Age-related osteoporosis without current pathological fracture', chronic: true, weight: 2, minAge: 55, sex: 'female' },
  { code: 'G47.33', system: 'ICD-10-CA', display: 'Obstructive sleep apnea', chronic: true, weight: 2, minAge: 30 },
  { code: 'N40.1', system: 'ICD-10-CA', display: 'Benign prostatic hyperplasia with lower urinary tract symptoms', chronic: true, weight: 2, minAge: 50, sex: 'male' },
  { code: 'H40.9', system: 'ICD-10-CA', display: 'Unspecified glaucoma', chronic: true, weight: 1, minAge: 50 },
  { code: 'R73.03', system: 'ICD-10-CA', display: 'Prediabetes', chronic: true, weight: 3, minAge: 30 },
  { code: 'D50.9', system: 'ICD-10-CA', display: 'Iron deficiency anemia, unspecified', chronic: false, weight: 2, minAge: 12 },
  { code: 'E55.9', system: 'ICD-10-CA', display: 'Vitamin D deficiency, unspecified', chronic: false, weight: 3, minAge: 8 },
  { code: 'K58.9', system: 'ICD-10-CA', display: 'Irritable bowel syndrome without diarrhea', chronic: true, weight: 2, minAge: 16 },
  { code: 'J30.1', system: 'ICD-10-CA', display: 'Allergic rhinitis due to pollen', chronic: true, weight: 3, minAge: 5 },
  { code: 'L20.9', system: 'ICD-10-CA', display: 'Atopic dermatitis, unspecified', chronic: true, weight: 2, minAge: 1 },
  { code: 'M54.5', system: 'ICD-10-CA', display: 'Low back pain', chronic: false, weight: 6, minAge: 16 },
  { code: 'G43.909', system: 'ICD-10-CA', display: 'Migraine, unspecified, not intractable', chronic: true, weight: 3, minAge: 12 },
  { code: 'J06.9', system: 'ICD-10-CA', display: 'Acute upper respiratory infection, unspecified', chronic: false, weight: 8, minAge: 1 },
  { code: 'J20.9', system: 'ICD-10-CA', display: 'Acute bronchitis, unspecified', chronic: false, weight: 4, minAge: 5 },
  { code: 'N39.0', system: 'ICD-10-CA', display: 'Urinary tract infection, site not specified', chronic: false, weight: 4, minAge: 12 },
  { code: 'H66.90', system: 'ICD-10-CA', display: 'Otitis media, unspecified, unspecified ear', chronic: false, weight: 3, minAge: 1, maxAge: 14 },
  { code: 'H65.90', system: 'ICD-10-CA', display: 'Unspecified nonsuppurative otitis media, unspecified ear', chronic: false, weight: 2, minAge: 1, maxAge: 16 },
  { code: 'H10.9', system: 'ICD-10-CA', display: 'Unspecified conjunctivitis', chronic: false, weight: 2, minAge: 1 },
  { code: 'J02.9', system: 'ICD-10-CA', display: 'Acute pharyngitis, unspecified', chronic: false, weight: 3, minAge: 1 },
  { code: 'B34.9', system: 'ICD-10-CA', display: 'Viral infection, unspecified', chronic: false, weight: 3, minAge: 1 },
  { code: 'R50.9', system: 'ICD-10-CA', display: 'Fever, unspecified', chronic: false, weight: 2, minAge: 0 },
  { code: 'R05.9', system: 'ICD-10-CA', display: 'Cough, unspecified', chronic: false, weight: 2, minAge: 1 },
  { code: 'R10.9', system: 'ICD-10-CA', display: 'Unspecified abdominal pain', chronic: false, weight: 2, minAge: 1 },
  { code: 'L30.9', system: 'ICD-10-CA', display: 'Dermatitis, unspecified', chronic: false, weight: 2, minAge: 1 },
  { code: 'R51.9', system: 'ICD-10-CA', display: 'Headache, unspecified', chronic: false, weight: 3, minAge: 8 },
  { code: 'S93.401', system: 'ICD-10-CA', display: 'Sprain of unspecified ligament of right ankle', chronic: false, weight: 2, minAge: 8 },
  { code: 'K59.00', system: 'ICD-10-CA', display: 'Constipation, unspecified', chronic: false, weight: 2, minAge: 8 },
  { code: 'I63.9', system: 'ICD-10-CA', display: 'Cerebral infarction, unspecified', chronic: true, weight: 1, minAge: 50 },
  { code: '195967001', system: 'SNOMED', encounterCode: 'J45.909', display: 'Asthma', chronic: true, weight: 1, minAge: 4 },
  { code: '37796009', system: 'SNOMED', encounterCode: 'G43.909', display: 'Migraine', chronic: true, weight: 1, minAge: 12 },
  { code: '396275006', system: 'SNOMED', encounterCode: 'M17.9', display: 'Osteoarthritis', chronic: true, weight: 1, minAge: 45 },
  { code: '271737000', system: 'SNOMED', encounterCode: 'D50.9', display: 'Anemia', chronic: false, weight: 1, minAge: 12 },
  { code: '25064002', system: 'SNOMED', encounterCode: 'R51.9', display: 'Headache', chronic: false, weight: 1, minAge: 8 },
];

export const MEDICATIONS: MedTemplate[] = [
  { genericName: 'ramipril', brandName: 'Altace', strength: '5 mg', dosage: '1 capsule', route: 'Oral', frequency: 'once daily', prefixes: ['I10', 'I11', 'I12', 'I15', 'I50'], allergyClass: 'ace' },
  { genericName: 'ramipril', brandName: 'Altace', strength: '10 mg', dosage: '1 capsule', route: 'Oral', frequency: 'once daily', prefixes: ['I10', 'I50'], allergyClass: 'ace' },
  { genericName: 'amlodipine', brandName: 'Norvasc', strength: '5 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', din: '02385791', prefixes: ['I10', 'I11', 'I25'] },
  { genericName: 'amlodipine', brandName: 'Norvasc', strength: '10 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', din: '02385805', prefixes: ['I10'] },
  { genericName: 'enalapril', brandName: 'Vasotec', strength: '10 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', din: '02565307', prefixes: ['I10', 'I50'], allergyClass: 'ace' },
  { genericName: 'hydrochlorothiazide', brandName: 'HydroDIURIL', strength: '25 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['I10', 'I15'] },
  { genericName: 'bisoprolol', brandName: 'Monocor', strength: '5 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['I10', 'I50', 'I48'] },
  { genericName: 'furosemide', brandName: 'Lasix', strength: '40 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['I50'] },
  { genericName: 'spironolactone', brandName: 'Aldactone', strength: '25 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['I50'] },
  { genericName: 'apixaban', brandName: 'Eliquis', strength: '5 mg', dosage: '1 tablet', route: 'Oral', frequency: 'twice daily', prefixes: ['I48'] },
  { genericName: 'metformin', brandName: 'Glucophage', strength: '500 mg', dosage: '1 tablet', route: 'Oral', frequency: 'twice daily', prefixes: ['E11', 'E13'] },
  { genericName: 'metformin', brandName: 'Glucophage', strength: '850 mg', dosage: '1 tablet', route: 'Oral', frequency: 'twice daily', prefixes: ['E11'] },
  { genericName: 'gliclazide', brandName: 'Diamicron MR', strength: '30 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['E11'] },
  { genericName: 'empagliflozin', brandName: 'Jardiance', strength: '10 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['E11', 'I50'] },
  { genericName: 'insulin glargine', brandName: 'Basaglar', strength: '100 units/mL', dosage: '10 units', route: 'Subcutaneous', frequency: 'at bedtime', prefixes: ['E11', 'E10'] },
  { genericName: 'atorvastatin', brandName: 'Lipitor', strength: '20 mg', dosage: '1 tablet', route: 'Oral', frequency: 'at bedtime', prefixes: ['E78', 'I25', 'E11'], allergyClass: 'statin' },
  { genericName: 'rosuvastatin', brandName: 'Crestor', strength: '10 mg', dosage: '1 tablet', route: 'Oral', frequency: 'at bedtime', prefixes: ['E78', 'I25'], allergyClass: 'statin' },
  { genericName: 'tiotropium', brandName: 'Spiriva', strength: '18 mcg', dosage: '1 capsule inhaled', route: 'Inhaled', frequency: 'once daily', prefixes: ['J44', 'J43'] },
  { genericName: 'salbutamol', brandName: 'Ventolin', strength: '100 mcg', dosage: '2 puffs', route: 'Inhaled', frequency: 'as needed', prefixes: ['J44', 'J45', 'J43'] },
  { genericName: 'budesonide-formoterol', brandName: 'Symbicort', strength: '200/6 mcg', dosage: '2 puffs', route: 'Inhaled', frequency: 'twice daily', prefixes: ['J44', 'J45'] },
  { genericName: 'fluticasone', brandName: 'Flovent', strength: '125 mcg', dosage: '2 puffs', route: 'Inhaled', frequency: 'twice daily', prefixes: ['J45'] },
  { genericName: 'escitalopram', brandName: 'Cipralex', strength: '10 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', din: '02476851', prefixes: ['F33', 'F32', 'F41'] },
  { genericName: 'sertraline', brandName: 'Zoloft', strength: '50 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['F33', 'F41'] },
  { genericName: 'fluoxetine', brandName: 'Prozac', strength: '20 mg', dosage: '1 capsule', route: 'Oral', frequency: 'once daily', din: '02503883', prefixes: ['F33', 'F32'] },
  { genericName: 'pantoprazole', brandName: 'Tecta', strength: '40 mg', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['K21'] },
  { genericName: 'levothyroxine', brandName: 'Synthroid', strength: '75 mcg', dosage: '1 tablet', route: 'Oral', frequency: 'every morning', prefixes: ['E03'] },
  { genericName: 'acetaminophen', brandName: 'Tylenol', strength: '500 mg', dosage: '1 tablet', route: 'Oral', frequency: 'as needed', prefixes: ['M17', 'M54', 'G43', 'R51', '*'] },
  { genericName: 'naproxen', brandName: 'Naprosyn', strength: '375 mg', dosage: '1 tablet', route: 'Oral', frequency: 'twice daily', prefixes: ['M17', 'M54'], allergyClass: 'nsaid' },
  { genericName: 'gabapentin', brandName: 'Neurontin', strength: '300 mg', dosage: '1 capsule', route: 'Oral', frequency: 'three times daily', din: '02550024', prefixes: ['E11.4', 'M54', 'G47'] },
  { genericName: 'vitamin D', brandName: 'D-Tabs', strength: '1000 units', dosage: '1 tablet', route: 'Oral', frequency: 'once daily', prefixes: ['E55', 'M81', '*'] },
  { genericName: 'tamsulosin', brandName: 'Flomax', strength: '0.4 mg', dosage: '1 capsule', route: 'Oral', frequency: 'once daily', prefixes: ['N40'] },
  { genericName: 'amoxicillin', brandName: 'Amoxil', strength: '500 mg', dosage: '1 capsule', route: 'Oral', frequency: 'three times daily', prefixes: ['J06', 'H66', 'N39'], allergyClass: 'penicillin' },
  { genericName: 'nitrofurantoin', brandName: 'MacroBID', strength: '100 mg', dosage: '1 capsule', route: 'Oral', frequency: 'twice daily', prefixes: ['N39'] },
];

export const ALLERGIES: AllergyTemplate[] = [
  { substance: 'penicillin', reactions: ['rash', 'hives', 'anaphylaxis'], allergyClass: 'penicillin' },
  { substance: 'amoxicillin', reactions: ['rash', 'hives'], allergyClass: 'penicillin' },
  { substance: 'sulfa', reactions: ['rash', 'fever'], allergyClass: 'sulfa' },
  { substance: 'sulfamethoxazole', reactions: ['rash', 'blistering'], allergyClass: 'sulfa' },
  { substance: 'naproxen', reactions: ['wheeze', 'hives', 'stomach upset'], allergyClass: 'nsaid' },
  { substance: 'ibuprofen', reactions: ['wheeze', 'angioedema'], allergyClass: 'nsaid' },
  { substance: 'codeine', reactions: ['nausea', 'itching', 'rash'], allergyClass: 'opioid' },
  { substance: 'morphine', reactions: ['itching', 'hypotension'], allergyClass: 'opioid' },
  { substance: 'ramipril', reactions: ['cough', 'angioedema'], allergyClass: 'ace' },
  { substance: 'atorvastatin', reactions: ['muscle pain', 'elevated CK'], allergyClass: 'statin' },
  { substance: 'latex', reactions: ['contact rash', 'wheeze'] },
  { substance: 'peanut', reactions: ['hives', 'anaphylaxis'] },
  { substance: 'shellfish', reactions: ['hives', 'swelling'] },
  { substance: 'iodinated contrast', reactions: ['flushing', 'rash', 'bronchospasm'], allergyClass: 'contrast' },
  { substance: 'pollen', reactions: ['sneezing', 'itchy eyes'] },
  { substance: 'dust mite', reactions: ['rhinitis', 'wheeze'] },
  { substance: 'adhesive tape', reactions: ['contact dermatitis'] },
  { substance: 'erythromycin', reactions: ['nausea', 'rash'] },
];

export const CANCEL_REASONS = [
  'Patient requested cancellation',
  'Transportation problem',
  'Illness in the family',
  'Rescheduled at patient request',
  'Provider illness — clinic cancelled the session',
  'Winter storm',
  'Patient admitted to hospital',
  'Duplicate booking',
  'No longer needs the visit',
  'Work conflict',
] as const;

export const STREETS = [
  'Yonge St',
  'Bloor St W',
  'Queen St E',
  'Dundas St W',
  'King St E',
  'College St',
  'St Clair Ave W',
  'Eglinton Ave E',
  'Lawrence Ave W',
  'Sheppard Ave E',
  'Finch Ave W',
  'Bathurst St',
  'Keele St',
  'Jane St',
  'Spadina Ave',
  'Danforth Ave',
  'Burnhamthorpe Rd',
  'Hurontario St',
  'Dixie Rd',
  'Dundas St E',
] as const;

export const FSAS: Record<string, string[]> = {
  Toronto: ['M5V', 'M5A', 'M5G', 'M6G', 'M6J', 'M4E', 'M4W', 'M4K', 'M8V', 'M9A'],
  'North York': ['M2N', 'M2M', 'M2R', 'M3H', 'M3A', 'M4A'],
  Mississauga: ['L5A', 'L5B', 'L5M', 'L5N', 'L4T', 'L4W', 'L5R', 'L5V'],
  Montreal: ['H2X', 'H3B', 'H4A'],
  Vancouver: ['V6B', 'V5K', 'V6Z'],
  Calgary: ['T2P', 'T2R', 'T3A'],
};

export const POSTAL_REST = 'ABCEGHJKLMNPRSTVWXYZ';

export const RELATIONSHIPS = ['spouse', 'partner', 'parent', 'child', 'sibling', 'friend', 'neighbour'] as const;

export const TASK_TITLES = [
  'Reconcile the medication list',
  'Call the patient with results',
  'Book a follow-up in 3 months',
  'Repeat blood pressure in 2 weeks',
  'Review inhaler technique',
  'Renew the current prescription',
  'Update the emergency contact',
  'Follow up on the missed visit',
  'Pharmacist medication review',
  'Complete the care plan review',
  'Confirm the health card version code',
  'Offer the seasonal influenza vaccine',
  'Recall for A1C',
  'Recall for eGFR',
  'Arrange a diabetic foot check',
  'Document substitute decision-maker',
  'Send home blood pressure instructions',
  'Check adherence at the next visit',
] as const;

export const COMPLAINTS: Record<string, string[]> = {
  I10: ['Blood pressure follow-up', 'Home readings above target', 'Hypertension review'],
  E11: ['Diabetes follow-up', 'A1C review', 'Glucose log review'],
  E10: ['Type 1 diabetes follow-up', 'Insulin review'],
  J44: ['COPD follow-up', 'Increased shortness of breath', 'Inhaler review'],
  J43: ['COPD follow-up', 'Exertional dyspnea'],
  I50: ['Heart failure follow-up', 'Ankle swelling and weight gain', 'Dyspnea on exertion'],
  N18: ['Kidney function review', 'CKD follow-up'],
  J45: ['Asthma follow-up', 'Night cough and wheeze'],
  F33: ['Mood follow-up', 'Depression review'],
  F32: ['Mood follow-up', 'Depression review'],
  F41: ['Anxiety follow-up', 'Sleep and worry review'],
  M17: ['Knee pain', 'Osteoarthritis follow-up'],
  M54: ['Low back pain', 'Back strain follow-up'],
  K21: ['Heartburn follow-up', 'Reflux review'],
  J06: ['Cough and congestion', 'Upper respiratory symptoms'],
  default: ['Follow-up visit', 'Medication review', 'New concern', 'Annual health review'],
};

export const COMPLAINTS_FR: Record<string, string> = {
  I10: 'Suivi de l’hypertension',
  E11: 'Suivi du diabète',
  J44: 'Suivi de la MPOC',
  I50: 'Suivi de l’insuffisance cardiaque',
  N18: 'Suivi de la maladie rénale',
  J45: 'Suivi de l’asthme',
  F33: 'Suivi de l’humeur',
  F41: 'Suivi de l’anxiété',
  default: 'Visite de suivi',
};

export function complaintFor(code: string, french: boolean) {
  const prefix = code.slice(0, 3);
  if (french) return COMPLAINTS_FR[prefix] ?? COMPLAINTS_FR.default!;
  return COMPLAINTS[prefix] ?? COMPLAINTS.default!;
}

export function fitsProblem(
  problem: ProblemTemplate,
  age: number,
  sex: 'female' | 'male' | 'other' | 'unknown'
) {
  if (problem.minAge != null && age < problem.minAge) return false;
  if (problem.maxAge != null && age > problem.maxAge) return false;
  if (problem.sex && problem.sex !== sex) return false;
  return true;
}
