// =======================================================================
// PhysioRecord — Enterprise Clinic Operations, Flowsheet, HEP, IQD Billing & RBAC Types
// =======================================================================

import type {
  PatientBodyChartData,
  SoapObjectiveData,
  SessionType,
  ExerciseAnatomicalRegion,
  FlowsheetExerciseEntry,
  ManualTherapyFlowsheetEntry,
  PhysicalAgentFlowsheetEntry,
  SoapFlowsheetData,
} from './clinical';

export type {
  ExerciseAnatomicalRegion,
  FlowsheetExerciseEntry,
  ManualTherapyFlowsheetEntry,
  PhysicalAgentFlowsheetEntry,
  SoapFlowsheetData,
};
import type {
  OrthopedicSpecialTestItem,
  GaitPostureData,
  FunctionalScaleEntry,
} from './clinicalWidgets';

// -----------------------------------------------------------------------
// 1. Role-Based Access Control (RBAC) & Immutable Audit Log (Phase 9)
// -----------------------------------------------------------------------
export type ClinicRoleId = 'admin' | 'senior_pt' | 'assistant_pt' | 'receptionist';

export interface ClinicStaffMember {
  id: string;
  nameAr: string;
  nameEn: string;
  role: ClinicRoleId;
  specialtyAr: string;
  specialtyEn: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  actorName: string;
  actorRole: ClinicRoleId;
  actionType:
    | 'patient_created'
    | 'patient_updated'
    | 'episode_created'
    | 'evaluation_saved'
    | 'session_finalized'
    | 'addendum_signed'
    | 'invoice_created'
    | 'payment_collected_iqd'
    | 'expense_recorded_iqd'
    | 'appointment_status_changed'
    | 'role_switched';
  entityType: 'patient' | 'episode' | 'session' | 'invoice' | 'expense' | 'appointment' | 'security';
  entityId: string;
  summaryAr: string;
  summaryEn: string;
}

// -----------------------------------------------------------------------
// 2. Session Exercise & Modality Flowsheet + HEP Builder (Phase 6)
// -----------------------------------------------------------------------
export type ExerciseTherapeuticGoal =
  | 'mobility_rom'
  | 'strengthening'
  | 'core_stability'
  | 'stretching_flexibility'
  | 'neuromuscular_balance'
  | 'pain_modulation';

export interface ExerciseLibraryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  region: ExerciseAnatomicalRegion;
  goal: ExerciseTherapeuticGoal;
  equipmentAr: string;
  equipmentEn: string;
  defaultSets: number;
  defaultReps: number;
  defaultHoldSeconds: number;
  defaultLoadOrBand: string;
  instructionsAr: string;
  instructionsEn: string;
  precautionsAr?: string;
  precautionsEn?: string;
}

/**
 * Legacy localStorage shape used only when migrating pre-v5 `physiorecord_session_flowsheet_v2_*` keys.
 * All active session flowsheets live inside `SoapNoteData.objective.flowsheet` (`SoapFlowsheetData`).
 */
export interface SessionFlowsheetData {
  preSessionPainNrs?: number;
  postSessionPainNrs?: number;
  exercises: FlowsheetExerciseEntry[];
  manualTherapy: ManualTherapyFlowsheetEntry[];
  physicalAgents: PhysicalAgentFlowsheetEntry[];
}


export interface HepPrescriptionItem {
  id: string;
  exerciseId: string;
  nameAr: string;
  nameEn: string;
  region: ExerciseAnatomicalRegion;
  sets: number;
  reps: number;
  holdSeconds: number;
  frequencyPerDay: number;
  daysPerWeek: number;
  loadOrBand: string;
  instructionsAr: string;
  instructionsEn: string;
  complianceStatus?: 'full' | 'partial' | 'non_compliant';
}

// -----------------------------------------------------------------------
// 3. Episode-Scoped Clinical Assessment & Longitudinal Comparison (Phase 4 & 5)
// -----------------------------------------------------------------------
export interface ClinicalAssessmentSnapshot {
  id: string;
  episodeId: string;
  sessionId?: string;
  snapshotType: 'initial_evaluation' | 're_evaluation' | 'follow_up' | 'discharge';
  recordedDate: string; // YYYY-MM-DD
  recordedBy: string;
  labelAr: string;
  labelEn: string;
  painNrsRest: number;
  painNrsActivity: number;
  romSummary: Array<{
    jointMovementKey: string;
    labelAr: string;
    labelEn: string;
    laterality: string;
    aromDegrees: number | null;
    promDegrees?: number | null;
    normalDegrees: number;
  }>;
  mmtSummary: Array<{
    muscleKey: string;
    labelAr: string;
    labelEn: string;
    laterality: string;
    grade: string;
  }>;
  outcomeScale?: {
    scaleId: string;
    scaleNameAr: string;
    scaleNameEn: string;
    scorePercentage: number;
    severityLabelAr: string;
    severityLabelEn: string;
  };
  specialTestsPositiveCount: number;
  clinicalImpressionNote?: string;
}

export interface EpisodeScopedClinicalStore {
  episodeId: string;
  patientId: string;
  activeWidgetIds: string[];
  // Structured Initial Evaluation Subjective & Objective fields
  chiefComplaint: string;
  historyOfPresentIllness: string;
  mechanismOfInjury: string;
  painAtRestNrs: number;
  painOnActivityNrs: number;
  painWorst24hNrs: number;
  painNature: string; // e.g., 'Sharp / Radicular / Ache'
  aggravatingFactors: string;
  relievingFactors: string;
  functionalLimitations: string;
  patientPersonalGoals: string;
  observationPosture: string;
  palpationFindings: string;
  circumferenceEdemaNotes: string;
  treatmentFrequency: string;
  plannedDurationWeeks: number;
  clinicalImpression: string;
  // Interactive Widgets Scoped to THIS Episode
  bodyChart?: PatientBodyChartData;
  objective: SoapObjectiveData;
  specialTests: OrthopedicSpecialTestItem[];
  gaitPosture?: GaitPostureData;
  functionalScales?: FunctionalScaleEntry;
  customWidgetsData: Record<string, Record<string, unknown>>;
  // Longitudinal Comparison Snapshots (Initial Eval -> Re-evals -> Discharge)
  snapshots: ClinicalAssessmentSnapshot[];
  // Home Exercise Program (HEP) Scoped to THIS Episode
  hepProgram: HepPrescriptionItem[];
  updatedAt: string;
}

// -----------------------------------------------------------------------
// 4. Appointments, Waiting List & Therapist Schedule (Phase 7)
// -----------------------------------------------------------------------
export type AppointmentStatus =
  | 'scheduled'
  | 'arrived'
  | 'in_session'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface ClinicAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  episodeId?: string;
  episodeTitle?: string;
  therapistName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  visitType: SessionType;
  status: AppointmentStatus;
  roomOrBed?: string;
  notes?: string;
}

export interface WaitingListEntry {
  id: string;
  patientId?: string;
  patientName: string;
  phone: string;
  conditionOrRegion: string;
  preferredTherapist?: string;
  preferredDays: string;
  preferredTimeWindow: 'morning' | 'afternoon' | 'evening' | 'any';
  priority: 'urgent' | 'high' | 'normal';
  addedAt: string;
  notes?: string;
}

// -----------------------------------------------------------------------
// 5. Iraqi Financial System (IQD Primary Currency, Packages, Debt & Expenses)
// -----------------------------------------------------------------------
export type IraqiPaymentMethod = 'cash_iqd' | 'zain_cash' | 'qi_card' | 'fib_transfer';

export interface PaymentTransactionIQD {
  id: string;
  invoiceId: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  amountIQD: number;
  method: IraqiPaymentMethod;
  receivedBy: string;
  receiptNumber: string;
  notes?: string;
}

export interface FinancialInvoiceIQD {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  episodeId?: string;
  episodeTitle?: string;
  sessionId?: string;
  date: string; // YYYY-MM-DD
  invoiceType: 'single_session' | 'rehab_package' | 'evaluation';
  titleAr: string;
  titleEn: string;
  totalAmountIQD: number; // e.g. 25000 or 200000
  discountIQD: number;
  netAmountIQD: number; // totalAmountIQD - discountIQD
  paidAmountIQD: number;
  balanceDueIQD: number; // netAmountIQD - paidAmountIQD
  status: 'paid' | 'partial' | 'unpaid';
  // Package tracking (for multi-session bundles)
  packageTotalSessions?: number;
  packageUsedSessions?: number;
  payments: PaymentTransactionIQD[];
  createdBy: string;
  notes?: string;
}

export type ExpenseCategoryIQD =
  | 'rent'
  | 'medical_consumables'
  | 'equipment_maintenance'
  | 'staff_salaries'
  | 'electricity_generator'
  | 'marketing_other';

export interface ClinicExpenseIQD {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategoryIQD;
  titleAr: string;
  titleEn: string;
  amountIQD: number;
  paidBy: string;
  notes?: string;
}
