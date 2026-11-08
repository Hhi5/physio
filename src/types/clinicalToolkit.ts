// =======================================================================
// PhysioRecord — Clinical Reference Toolkit Types (Phase 2C — Milestone 1)
// Public Unencrypted Clinical Reference Models (Zero DB Touch)
// =======================================================================

export type SpinalLevel =
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8'
  | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10' | 'T11' | 'T12'
  | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export type SpinalRegionGroup = 'cervical' | 'thoracic' | 'lumbar' | 'sacral';

// -----------------------------------------------------------------------
// 1. Dermatomes Reference Definition
// -----------------------------------------------------------------------
export interface DermatomeDefinition {
  rootLevel: SpinalLevel;
  regionGroup: SpinalRegionGroup;
  canonicalRegionEn: string;
  canonicalRegionAr: string;
  keySensoryPointEn: string;
  keySensoryPointAr: string; // ASIA / ISNCSCI Key Sensory Point
  asiaCode?: string;
  overlapClinicalNotesEn: string;
  overlapClinicalNotesAr: string;
  svgRegionIdsAnterior: string[];
  svgRegionIdsPosterior: string[];
  primarySourceCitation: string;
}

// -----------------------------------------------------------------------
// 2. Myotomes Reference Definition
// -----------------------------------------------------------------------
export interface MyotomeMuscle {
  nameEn: string;
  nameAr: string;
  peripheralNerveEn: string;
  peripheralNerveAr: string;
  isPrimaryRoot: boolean;
}

export interface MyotomeDefinition {
  rootLevel: SpinalLevel;
  regionGroup: SpinalRegionGroup;
  predominantMovementEn: string;
  predominantMovementAr: string;
  keyMuscles: MyotomeMuscle[];
  testingPositionEn: string;
  testingPositionAr: string;
  differentialClinicalNotesEn: string;
  differentialClinicalNotesAr: string;
  primarySourceCitation: string;
}

// -----------------------------------------------------------------------
// 3. Deep Tendon Reflexes Reference Definition
// -----------------------------------------------------------------------
export type DtrReflexId = 'biceps' | 'brachioradialis' | 'triceps' | 'patellar' | 'achilles';

export interface DtrDefinition {
  reflexId: DtrReflexId;
  nameEn: string;
  nameAr: string;
  primaryRoot: SpinalLevel;
  contributingRoots: SpinalLevel[];
  peripheralNerveEn: string;
  peripheralNerveAr: string;
  tappingSiteEn: string;
  tappingSiteAr: string;
  normalResponseEn: string;
  normalResponseAr: string;
  reinforcementTechniqueEn: string;
  reinforcementTechniqueAr: string;
  clinicalSignificanceAr: string;
}

export type DtrGrade = '0' | '1+' | '2+' | '3+' | '4+';

export interface DtrGradeDefinition {
  grade: DtrGrade;
  labelEn: string;
  labelAr: string;
  clinicalInterpretationEn: string;
  clinicalInterpretationAr: string;
  isPhysiological: boolean;
}
