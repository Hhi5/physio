// =======================================================================
// PhysioRecord — Clinical Widget Engine & AI Extensibility Types
// =======================================================================

import type { LucideIcon } from 'lucide-react';

export type ExamCategory =
  | 'body_chart'
  | 'rom_mmt'
  | 'neurology'
  | 'special_tests'
  | 'gait_balance'
  | 'functional_scales'
  | 'custom_ai';

export interface ExamWidgetDescriptor {
  id: string;
  category: ExamCategory;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  badgeLabelAr: string;
  badgeLabelEn: string;
  badgeColorClass: string;
  iconName: string;
  descriptionAr: string;
  descriptionEn: string;
  isCustom?: boolean;
}

// -----------------------------------------------------------------------
// Orthopedic Provocative Special Tests Types
// -----------------------------------------------------------------------
export type SpecialTestOutcome = 'positive' | 'negative' | 'pain_reproduced' | 'inconclusive' | 'not_tested';

export interface OrthopedicSpecialTestItem {
  id: string;
  joint: 'shoulder' | 'knee' | 'cervical' | 'lumbar' | 'hip' | 'elbow_wrist';
  nameAr: string;
  nameEn: string;
  targetPathologyAr: string;
  targetPathologyEn: string;
  outcome: SpecialTestOutcome;
  painScoreNrs?: number;
  notes?: string;
}

// -----------------------------------------------------------------------
// Gait & Posture Assessment Types
// -----------------------------------------------------------------------
export interface GaitPostureData {
  tugSeconds?: number | null; // Timed Up & Go in seconds
  postureDeviations: string[];
  gaitPattern: 'normal' | 'antalgic' | 'trendelenburg' | 'steppage' | 'ataxic' | 'other';
  assistiveDevice: 'none' | 'single_cane' | 'crutches' | 'walker' | 'other';
  balanceRombergTest?: 'normal' | 'swaying_eyes_closed' | 'loss_of_balance' | 'not_tested';
  clinicalNotes?: string;
}

export type ValidatedScaleId =
  | 'quickdash'
  | 'oswestry'
  | 'odi'
  | 'ndi'
  | 'spadi'
  | 'lefs'
  | 'psfs';

export interface OutcomeScoreHistoryPoint {
  id: string;
  date: string;
  visitType: 'initial_evaluation' | 're_evaluation' | 'follow_up' | 'discharge';
  scaleId: ValidatedScaleId;
  scaleNameAr: string;
  scaleNameEn: string;
  scorePercentage: number;
  severityLabelAr: string;
  severityLabelEn: string;
}

export interface FunctionalScaleEntry {
  scaleId: ValidatedScaleId;
  scaleNameAr: string;
  scaleNameEn: string;
  scorePercentage: number;
  severityLabelAr: string;
  severityLabelEn: string;
  responses: Record<string, number>;
  psfsActivities?: Array<{ id: string; activity: string; score0to10: number }>;
  history?: OutcomeScoreHistoryPoint[];
  clinicalNotes?: string;
}

// -----------------------------------------------------------------------
// AI Custom Widget Definition Schema
// -----------------------------------------------------------------------
export type CustomFieldType =
  | 'number'
  | 'slider'
  | 'select'
  | 'radio'
  | 'checkbox_group'
  | 'table_matrix'
  | 'text'
  | 'score_calculator';

export interface CustomFieldOption {
  value: string | number;
  labelAr: string;
  labelEn: string;
  score?: number;
}

export interface CustomWidgetField {
  id: string;
  type: CustomFieldType;
  labelAr: string;
  labelEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: CustomFieldOption[];
  defaultValue?: string | number | boolean | null;
}

export interface CustomWidgetDefinition {
  id: string;
  titleAr: string;
  titleEn: string;
  category: ExamCategory;
  clinicalSpecialtyAr: string;
  clinicalSpecialtyEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconName?: string;
  version: string;
  createdAt: string;
  fields: CustomWidgetField[];
  interpretations?: {
    minScore: number;
    maxScore: number;
    severityAr: string;
    severityEn: string;
    clinicalRecommendationAr?: string;
    clinicalRecommendationEn?: string;
  }[];
}
