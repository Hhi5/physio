// =======================================================================
// PhysioRecord — Enterprise Clinic Operations, Flowsheet, HEP, IQD Ledger & RBAC Service
// =======================================================================

import type {
  ClinicRoleId,
  ClinicStaffMember,
  AuditLogEntry,
  ExerciseLibraryItem,
  SessionFlowsheetData,
  EpisodeScopedClinicalStore,
  ClinicalAssessmentSnapshot,
  ClinicAppointment,
  AppointmentStatus,
  WaitingListEntry,
  FinancialInvoiceIQD,
  PaymentTransactionIQD,
  IraqiPaymentMethod,
  ClinicExpenseIQD,
} from '../types/clinicManagement';
import { localDate } from '../utils/date';
import { canonicalizeForSeal } from './sessionService';
import { db as defaultDb, type PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../crypto/vault';
import {
  StaleTabOverwriteError,
  type EncryptedEpisodeClinicalEntity,
} from '../types/clinical';

function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function assertAppendOnlySnapshots(
  existingSnapshots: ClinicalAssessmentSnapshot[],
  incomingSnapshots: ClinicalAssessmentSnapshot[]
): void {
  if (incomingSnapshots.length < existingSnapshots.length) {
    throw new Error(
      'رفض حفظ التقييم: لقطات التقييم المرحلية (Snapshots) هي سجل تراكمي غير قابل للحذف بعد إنشائه (Append-only Snapshots).'
    );
  }

  for (let i = 0; i < existingSnapshots.length; i++) {
    const prevSnap = existingSnapshots[i];
    const nextSnap = incomingSnapshots[i];
    if (
      !nextSnap ||
      nextSnap.id !== prevSnap.id ||
      canonicalizeForSeal(nextSnap) !== canonicalizeForSeal(prevSnap)
    ) {
      throw new Error(
        `رفض حفظ التقييم: لا يمكن تعديل أو إعادة ترتيب لقطة التقييم المسجلة مسبقاً (${prevSnap.id}). اللقطات السريرية غير قابلة للتعديل بعد إنشائها (Append-only Snapshots).`
      );
    }
  }
}

type EpisodeClinicalMutationTestHook = (context: {
  episodeId: string;
}) => Promise<void> | void;

let episodeClinicalMutationTestHook: EpisodeClinicalMutationTestHook | null = null;

export function setEpisodeClinicalMutationTestHook(
  hook: EpisodeClinicalMutationTestHook | null
): void {
  episodeClinicalMutationTestHook = hook;
}

const STORAGE_KEYS = {
  ACTIVE_STAFF_ID: 'physiorecord_active_staff_v2',
  AUDIT_LOGS: 'physiorecord_audit_logs_v2',
  APPOINTMENTS: 'physiorecord_appointments_v2',
  WAITING_LIST: 'physiorecord_waiting_list_v2',
  INVOICES_IQD: 'physiorecord_invoices_iqd_v2',
  EXPENSES_IQD: 'physiorecord_expenses_iqd_v2',
  EPISODE_STORE_PREFIX: 'physiorecord_episode_clinical_v2_',
  SESSION_FLOWSHEET_PREFIX: 'physiorecord_session_flowsheet_v2_',
};

// -----------------------------------------------------------------------
// 1. Clinic Staff & Role-Based Access Control (RBAC)
// -----------------------------------------------------------------------
export const CLINIC_STAFF_ROSTER: ClinicStaffMember[] = [
  {
    id: 'staff_admin_pt',
    nameAr: 'د. حسين الرمضاني (مدير العيادة / أخصائي أقدم)',
    nameEn: 'Dr. Hussein Al-Ramdani (Clinic Director / Senior PT)',
    role: 'admin',
    specialtyAr: 'تأهيل العظام والعمود الفقري والإصابات الرياضية',
    specialtyEn: 'Orthopedic, Spine & Sports Rehab',
  },
  {
    id: 'staff_senior_pt',
    nameAr: 'د. سارة الكاظمي (أخصائية علاج طبيعي أقدم)',
    nameEn: 'Dr. Sara Al-Kadhimi (Senior Physical Therapist)',
    role: 'senior_pt',
    specialtyAr: 'تأهيل الأعصاب والمفاصل والعلاج اليدوي',
    specialtyEn: 'Neuro & Manual Physical Therapy',
  },
  {
    id: 'staff_assistant_pt',
    nameAr: 'أ. علي العبيدي (معالج طبيعي ممارس)',
    nameEn: 'Ali Al-Obaidi (Assistant Physical Therapist)',
    role: 'assistant_pt',
    specialtyAr: 'التمارين العلاجية والأجهزة الفيزيائية',
    specialtyEn: 'Therapeutic Exercise & Modalities',
  },
  {
    id: 'staff_reception',
    nameAr: 'نور الزهراء (موظفة الاستقبال والحسابات)',
    nameEn: 'Noor Al-Zahraa (Reception & IQD Billing)',
    role: 'receptionist',
    specialtyAr: 'إدارة المواعيد، قائمة الانتظار، والحسابات',
    specialtyEn: 'Scheduling, Waitlist & Financial Desk',
  },
];

export const ROLE_PERMISSIONS: Record<
  ClinicRoleId,
  {
    labelAr: string;
    labelEn: string;
    canEditClinicalCharts: boolean;
    canFinalizeAndLockNotes: boolean;
    canManageAppointments: boolean;
    canCollectPaymentsIQD: boolean;
    canDeleteFinancialRecords: boolean;
    canViewAuditLogs: boolean;
  }
> = {
  admin: {
    labelAr: 'مدير النظام / أخصائي أقدم (Admin)',
    labelEn: 'Clinic Admin & Director',
    canEditClinicalCharts: true,
    canFinalizeAndLockNotes: true,
    canManageAppointments: true,
    canCollectPaymentsIQD: true,
    canDeleteFinancialRecords: true,
    canViewAuditLogs: true,
  },
  senior_pt: {
    labelAr: 'أخصائي علاج طبيعي أقدم (Senior PT)',
    labelEn: 'Senior Physical Therapist',
    canEditClinicalCharts: true,
    canFinalizeAndLockNotes: true,
    canManageAppointments: true,
    canCollectPaymentsIQD: false,
    canDeleteFinancialRecords: false,
    canViewAuditLogs: true,
  },
  assistant_pt: {
    labelAr: 'معالج طبيعي مساعد (Assistant PT)',
    labelEn: 'Assistant Physical Therapist',
    canEditClinicalCharts: true,
    canFinalizeAndLockNotes: false,
    canManageAppointments: true,
    canCollectPaymentsIQD: false,
    canDeleteFinancialRecords: false,
    canViewAuditLogs: false,
  },
  receptionist: {
    labelAr: 'موظف الاستقبال والحسابات (Receptionist)',
    labelEn: 'Front-Desk Receptionist',
    canEditClinicalCharts: false,
    canFinalizeAndLockNotes: false,
    canManageAppointments: true,
    canCollectPaymentsIQD: true,
    canDeleteFinancialRecords: false,
    canViewAuditLogs: false,
  },
};

// -----------------------------------------------------------------------
// 2. Comprehensive Searchable PT Exercise Library (Phase 6)
// -----------------------------------------------------------------------
export const PT_EXERCISE_CATALOG: ExerciseLibraryItem[] = [
  {
    id: 'ex_cerv_chin_tuck',
    nameAr: 'تمرين سحب الذقن لتقوية عضلات العنق العميقة (Chin Tucks)',
    nameEn: 'Deep Cervical Flexor Chin Tucks',
    region: 'cervical',
    goal: 'core_stability',
    equipmentAr: 'بدون أدوات (وزن الجسم)',
    equipmentEn: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 5,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'اسحب الذقن للخلف ببطء باتجاه الرقبة (كأنك تصنع ذقناً مزدوجاً) دون إمالة الرأس للأعلى أو الأسفل، اثبت 5 ثوانٍ ثم استرخِ.',
    instructionsEn: 'Gently draw your chin straight back while keeping eyes level. Hold for 5 seconds, then relax.',
    precautionsAr: 'تجنب حبس النفس أو الشعور بتنميل في الذراع.',
    precautionsEn: 'Avoid breath-holding or peripheralizing arm symptoms.',
  },
  {
    id: 'ex_cerv_scap_retraction',
    nameAr: 'تقريب لوحي الكتف بشريط مطاطي (Scapular Retraction Row)',
    nameEn: 'Seated TheraBand Scapular Retraction',
    region: 'cervical',
    goal: 'strengthening',
    equipmentAr: 'شريط مطاطي (TheraBand)',
    equipmentEn: 'TheraBand',
    defaultSets: 3,
    defaultReps: 12,
    defaultHoldSeconds: 3,
    defaultLoadOrBand: 'Yellow / Red Band',
    instructionsAr: 'اسحب الشريط المطاطي للخلف مع ضم لوحي الكتف للداخل والأسفل دون رفع الأكتاف نحو الأذنين.',
    instructionsEn: 'Pull band back by squeezing shoulder blades together and down without shrugging.',
  },
  {
    id: 'ex_shld_pendulum',
    nameAr: 'تمرين البندول لتحريك مفصل الكتف (Codman Pendulum)',
    nameEn: 'Codman Pendulum Shoulder Mobility',
    region: 'shoulder',
    goal: 'mobility_rom',
    equipmentAr: 'طاولة استناد',
    equipmentEn: 'Support Table',
    defaultSets: 2,
    defaultReps: 20,
    defaultHoldSeconds: 0,
    defaultLoadOrBand: 'Unweighted / 1 kg',
    instructionsAr: 'انحنِ للأمام مستنداً باليد السليمة، واترك الذراع المصابة تتأرجح في دوائر صغيرة مستخدماً حركة الجذع وليس عضلات الكتف.',
    instructionsEn: 'Lean forward supporting yourself with good arm; let affected arm swing gently in small circles using trunk momentum.',
  },
  {
    id: 'ex_shld_er_band',
    nameAr: 'دوران خارجي للكتف بشريط مطاطي (External Rotation at 0°)',
    nameEn: 'Resisted Shoulder External Rotation (0° Abduction)',
    region: 'shoulder',
    goal: 'strengthening',
    equipmentAr: 'شريط مطاطي + منشفة تحت المرفق',
    equipmentEn: 'TheraBand + Towel Roll',
    defaultSets: 3,
    defaultReps: 15,
    defaultHoldSeconds: 2,
    defaultLoadOrBand: 'Red Band',
    instructionsAr: 'ضع منشفة صغيرة بين المرفق والجذع بزاوية 90 درجة، واسحب الشريط للخارج ببطء ثم عد ببطء خلال 3 ثوانٍ.',
    instructionsEn: 'Keep towel roll tucked under elbow bent at 90°; rotate forearm outward against band resistance and return slowly.',
  },
  {
    id: 'ex_shld_wall_slide',
    nameAr: 'انزلاق الذراعين على الحائط للأعلى (Serratus Wall Slides)',
    nameEn: 'Scapular Wall Slides with Upward Rotation',
    region: 'shoulder',
    goal: 'mobility_rom',
    equipmentAr: 'حائط + منشفة',
    equipmentEn: 'Wall + Towel',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 3,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'ضع الساعدين على الحائط وادفع برفق للأمام مع الانزلاق للأعلى في حدود المدى الخالي من الألم.',
    instructionsEn: 'Place forearms on wall with gentle protraction and slide upward within pain-free range.',
  },
  {
    id: 'ex_lumb_mckenzie',
    nameAr: 'تمرين مكنزي لبسط العمود الفقري القطني (Prone Lumbar Extension)',
    nameEn: 'McKenzie Prone Press-Up (Lumbar Extension)',
    region: 'thoracic_lumbar',
    goal: 'pain_modulation',
    equipmentAr: 'سرير علاجي / بساط أرضي',
    equipmentEn: 'Mat / Plinth',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 2,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'استلقِ على بطنك، ضع اليدين تحت الكتفين، وادفع الجزء العلوي للأعلى مع إبقاء الحوض وأسفل الظهر مسترخيين تماماً.',
    instructionsEn: 'Lie prone, place hands under shoulders, press chest up while keeping pelvis and low back relaxed.',
    precautionsAr: 'توقف فوراً إذا انتشر الألم أو الخدر باتجاه الساق أو القدم (Peripheralization).',
    precautionsEn: 'Stop immediately if pain or numbness radiates further down the leg.',
  },
  {
    id: 'ex_lumb_bird_dog',
    nameAr: 'تمرين التبات القطني المتبادل (Bird-Dog Quadruped Stabilization)',
    nameEn: 'Quadruped Bird-Dog Core Stabilization',
    region: 'thoracic_lumbar',
    goal: 'core_stability',
    equipmentAr: 'بساط علاجي',
    equipmentEn: 'Exercise Mat',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 5,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'من وضع الارتكاز الرباعي، شد عضلات البطن العميقة ومد الذراع اليمنى مع الساق اليسرى باستقامة دون ميلان الحوض.',
    instructionsEn: 'From all fours, brace core and extend opposite arm and leg while keeping lumbar spine neutral.',
  },
  {
    id: 'ex_lumb_dead_bug',
    nameAr: 'تمرين الثبات الأمامي للعمود الفقري (Supine Dead Bug)',
    nameEn: 'Supine Dead Bug Core Control',
    region: 'thoracic_lumbar',
    goal: 'core_stability',
    equipmentAr: 'بساط علاجي',
    equipmentEn: 'Exercise Mat',
    defaultSets: 3,
    defaultReps: 12,
    defaultHoldSeconds: 3,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'استلقِ على ظهرك مع رفع الركبتين 90 درجة، حافظ على ثبات أسفل الظهر على الأرض أثناء مد ساق واحدة ببطء.',
    instructionsEn: 'Lie supine in tabletop position; maintain neutral pelvic imprint while slowly lowering opposite arm and heel.',
  },
  {
    id: 'ex_hip_clamshell',
    nameAr: 'تقوية العضلة الألوية الوسطى (Side-Lying Clamshells)',
    nameEn: 'Side-Lying Resisted Clamshells (Gluteus Medius)',
    region: 'hip_pelvis',
    goal: 'strengthening',
    equipmentAr: 'حلقة مطاطية (Mini Loop Band)',
    equipmentEn: 'Mini Resistance Loop',
    defaultSets: 3,
    defaultReps: 15,
    defaultHoldSeconds: 3,
    defaultLoadOrBand: 'Green Loop Band',
    instructionsAr: 'استلقِ على جانبك مع ثني الركبتين، ارفع الركبة العليا للأعلى مع إبقاء القدمين متلاصقتين ودون تدوير الحوض للخلف.',
    instructionsEn: 'Lie on side with knees bent; lift top knee while keeping feet together and pelvis stacked vertically.',
  },
  {
    id: 'ex_hip_glute_bridge',
    nameAr: 'تمرين الجسر لرفع الحوض وتقوية الألوية (Glute Bridge)',
    nameEn: 'Supine Bilateral / Unilateral Glute Bridge',
    region: 'hip_pelvis',
    goal: 'strengthening',
    equipmentAr: 'بساط علاجي',
    equipmentEn: 'Exercise Mat',
    defaultSets: 3,
    defaultReps: 12,
    defaultHoldSeconds: 5,
    defaultLoadOrBand: 'Bodyweight / Band',
    instructionsAr: 'اضغط بالكعبين على الأرض وارفع الحوض حتى يستقيم الجذع مع الفخذين، اثبت 5 ثوانٍ ثم انزل ببطء.',
    instructionsEn: 'Drive through heels to lift hips until knees, hips, and shoulders align. Hold 5 seconds.',
  },
  {
    id: 'ex_knee_quad_set',
    nameAr: 'شد العضلة الرباعية الثابت مع رفع الساق المستقيمة (Quad Sets & SLR)',
    nameEn: 'Isometric Quad Sets & Straight Leg Raise (SLR)',
    region: 'knee',
    goal: 'strengthening',
    equipmentAr: 'منشفة ملفوفة تحت الركبة / أوزان كاحل',
    equipmentEn: 'Towel Roll / Cuff Weight',
    defaultSets: 3,
    defaultReps: 15,
    defaultHoldSeconds: 5,
    defaultLoadOrBand: '1.5 kg Ankle Weight',
    instructionsAr: 'اضغط خلف الركبة لأسفل لشد عضلة الفخذ الأمامية بالكامل ثم ارفع الساق مستقيمة لمستوى الركبة الأخرى.',
    instructionsEn: 'Tighten thigh muscle pressing back of knee down, locking knee fully before lifting straight leg 45 degrees.',
  },
  {
    id: 'ex_knee_tke',
    nameAr: 'المد النهائي للركبة من الوقوف بشريط مطاطي (Terminal Knee Extension - TKE)',
    nameEn: 'Standing Resisted Terminal Knee Extension (TKE)',
    region: 'knee',
    goal: 'strengthening',
    equipmentAr: 'شريط مطاطي مثبت خلف الركبة',
    equipmentEn: 'Anchored Resistance Band',
    defaultSets: 3,
    defaultReps: 15,
    defaultHoldSeconds: 3,
    defaultLoadOrBand: 'Blue / Black Band',
    instructionsAr: 'ثبت الشريط خلف الركبة، ابدأ بزاوية ثني 30 درجة ثم افرد الركبة للآخر مع عصر عضلة الفخذ الأمامية.',
    instructionsEn: 'With band looped behind knee, extend from 30° flexion to full terminal extension squeezing quadriceps.',
  },
  {
    id: 'ex_knee_step_down',
    nameAr: 'النزول المتدرج المتحكم من درجة (Eccentric Lateral Step-Down)',
    nameEn: 'Controlled Eccentric Lateral Step-Down',
    region: 'knee',
    goal: 'neuromuscular_balance',
    equipmentAr: 'صندوق متدرج 15 سم (Step Box)',
    equipmentEn: '15cm Step Box',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 0,
    defaultLoadOrBand: 'Bodyweight / 4 kg',
    instructionsAr: 'قف على الدرجة بالساق المصابة، وانزل ببطء خلال 3 ثوانٍ لملامسة الكعب الآخر للأرض مع منع انحراف الركبة للداخل (Valgus).',
    instructionsEn: 'Stand on step, slowly lower opposite heel to floor over 3 seconds while keeping knee aligned over 2nd toe.',
  },
  {
    id: 'ex_ankle_balance',
    nameAr: 'التوازن الأحادي واستقبال الحس العميق للكاحل (Single-Leg Proprioception)',
    nameEn: 'Single-Leg Balance & Proprioceptive Training',
    region: 'ankle_foot',
    goal: 'neuromuscular_balance',
    equipmentAr: 'وسادة توازن هوائية (Airex / BOSU)',
    equipmentEn: 'Foam Pad / BOSU',
    defaultSets: 3,
    defaultReps: 4,
    defaultHoldSeconds: 30,
    defaultLoadOrBand: 'Unstable Foam Surface',
    instructionsAr: 'قف على قدم واحدة فوق وسادة التوازن لمدة 30 ثانية مع الحفاظ على ثبات الكاحل والحوض.',
    instructionsEn: 'Maintain single-leg stance on foam pad for 30 seconds keeping arch domed and pelvis level.',
  },
  {
    id: 'ex_ankle_ecc_calf',
    nameAr: 'تقوية عضلة السمانة ووتر أخيل اللامركزية (Alfredson Eccentric Heel Drop)',
    nameEn: 'Eccentric Calf Raise / Heel Drop on Step',
    region: 'ankle_foot',
    goal: 'strengthening',
    equipmentAr: 'حافة درجة',
    equipmentEn: 'Step Edge',
    defaultSets: 3,
    defaultReps: 15,
    defaultHoldSeconds: 2,
    defaultLoadOrBand: 'Bodyweight / Weighted Backpack',
    instructionsAr: 'اصعد بكلتا القدمين، ثم ارفع القدم السليمة وانزل بالكعب المصاب ببطء شديد تحت مستوى الدرجة.',
    instructionsEn: 'Rise up on both feet, shift weight to affected leg, and lower heel slowly below step level.',
  },
  {
    id: 'ex_neuro_sit_to_stand',
    nameAr: 'تدريب النهوض الوظيفي المتكرر من الكرسي (Functional Sit-to-Stand)',
    nameEn: 'Task-Specific Sit-to-Stand Transfer Training',
    region: 'neuro_balance',
    goal: 'neuromuscular_balance',
    equipmentAr: 'كرسي قياسي 45 سم',
    equipmentEn: 'Standard 45cm Chair',
    defaultSets: 3,
    defaultReps: 10,
    defaultHoldSeconds: 2,
    defaultLoadOrBand: 'Bodyweight',
    instructionsAr: 'قدم القدمين للخلف قليلاً، انحنِ بالجذع للأمام ("الأنف فوق أصابع القدم") وانهض بتوزيع متساوٍ للوزن على الساقين.',
    instructionsEn: 'Bring feet slightly back, lean trunk forward ("nose over toes"), and stand with symmetrical weight-bearing.',
  },
];

// -----------------------------------------------------------------------
// 3. Currency Formatter for Iraqi Dinar (IQD / د.ع)
// -----------------------------------------------------------------------
export function formatIQD(amount: number, isAr = true): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formatted = new Intl.NumberFormat('en-GB').format(safe);
  return isAr ? `${formatted} د.ع` : `${formatted} IQD`;
}

// -----------------------------------------------------------------------
// 4. Clinic Operations Service (Singleton Static Methods)
// -----------------------------------------------------------------------
export class ClinicOperationsService {
  // --- RBAC & Staff ---
  static getActiveStaff(): ClinicStaffMember {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_STAFF_ID);
      if (savedId) {
        const found = CLINIC_STAFF_ROSTER.find((s) => s.id === savedId);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return CLINIC_STAFF_ROSTER[0];
  }

  static setActiveStaff(staffId: string): ClinicStaffMember {
    const found = CLINIC_STAFF_ROSTER.find((s) => s.id === staffId) || CLINIC_STAFF_ROSTER[0];
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_STAFF_ID, found.id);
      this.appendAuditLog({
        actionType: 'role_switched',
        entityType: 'security',
        entityId: found.id,
        summaryAr: `تبديل المستخدم النشط إلى: ${found.nameAr}`,
        summaryEn: `Switched active clinician/role to: ${found.nameEn}`,
      });
    } catch {
      // ignore
    }
    return found;
  }

  // --- Immutable Audit Logs ---
  static getAuditLogs(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [];
  }

  static appendAuditLog(params: {
    actionType: AuditLogEntry['actionType'];
    entityType: AuditLogEntry['entityType'];
    entityId: string;
    patientId?: string;
    episodeId?: string;
    summaryAr: string;
    summaryEn: string;
  }): AuditLogEntry {
    const staff = this.getActiveStaff();
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      actorName: staff.nameEn,
      actorRole: staff.role,
      ...params,
    };
    try {
      const existing = this.getAuditLogs();
      const updated = [entry, ...existing].slice(0, 250);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return entry;
  }

  // --- Episode-Scoped Clinical Store (Strict Episode Isolation + Migration) ---
  static getEpisodeClinicalStore(episodeId: string, patientId: string): EpisodeScopedClinicalStore {
    const epKey = `${STORAGE_KEYS.EPISODE_STORE_PREFIX}${episodeId}`;
    try {
      const raw = localStorage.getItem(epKey);
      if (raw) {
        return JSON.parse(raw);
      }
      // Graceful migration if legacy patient-level widget data exists and this is first load
      const legacyKey = `physiorecord_patient_widgets_${patientId}`;
      const legacyRaw = localStorage.getItem(legacyKey);
      const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) : {};

      const initialStore: EpisodeScopedClinicalStore = {
        episodeId,
        patientId,
        activeWidgetIds: legacyParsed.activeWidgetIds || ['body_chart', 'rom', 'mmt', 'special_tests', 'functional_scales'],
        chiefComplaint: '',
        historyOfPresentIllness: '',
        mechanismOfInjury: '',
        painAtRestNrs: 3,
        painOnActivityNrs: 6,
        painWorst24hNrs: 7,
        painNature: 'ألم ميكانيكي يزداد مع المجهود (Mechanical pain)',
        aggravatingFactors: '',
        relievingFactors: '',
        functionalLimitations: '',
        patientPersonalGoals: '',
        observationPosture: '',
        palpationFindings: '',
        circumferenceEdemaNotes: '',
        treatmentFrequency: '3 جلسات أسبوعياً (3x / Week)',
        plannedDurationWeeks: 6,
        clinicalImpression: '',
        bodyChart: legacyParsed.bodyChart,
        objective: legacyParsed.objective || {},
        specialTests: legacyParsed.specialTests || [],
        gaitPosture: legacyParsed.gaitPosture,
        functionalScales: legacyParsed.functionalScales,
        customWidgetsData: legacyParsed.customWidgetsData || {},
        snapshots: [],
        hepProgram: [],
        updatedAt: new Date().toISOString(),
      };
      return initialStore;
    } catch {
      return {
        episodeId,
        patientId,
        activeWidgetIds: ['body_chart', 'rom', 'mmt', 'special_tests', 'functional_scales'],
        chiefComplaint: '',
        historyOfPresentIllness: '',
        mechanismOfInjury: '',
        painAtRestNrs: 3,
        painOnActivityNrs: 6,
        painWorst24hNrs: 7,
        painNature: '',
        aggravatingFactors: '',
        relievingFactors: '',
        functionalLimitations: '',
        patientPersonalGoals: '',
        observationPosture: '',
        palpationFindings: '',
        circumferenceEdemaNotes: '',
        treatmentFrequency: '3x / Week',
        plannedDurationWeeks: 6,
        clinicalImpression: '',
        objective: {},
        specialTests: [],
        customWidgetsData: {},
        snapshots: [],
        hepProgram: [],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  static saveEpisodeClinicalStore(store: EpisodeScopedClinicalStore): void {
    const epKey = `${STORAGE_KEYS.EPISODE_STORE_PREFIX}${store.episodeId}`;
    const existingRaw = localStorage.getItem(epKey);
    if (existingRaw) {
      let existingParsed: EpisodeScopedClinicalStore | null = null;
      try {
        existingParsed = JSON.parse(existingRaw) as EpisodeScopedClinicalStore;
      } catch {
        existingParsed = null;
      }
      assertAppendOnlySnapshots(
        existingParsed?.snapshots || [],
        store.snapshots || []
      );
    }

    const updated: EpisodeScopedClinicalStore = {
      ...store,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(epKey, JSON.stringify(updated));
    this.appendAuditLog({
      actionType: 'evaluation_saved',
      entityType: 'episode',
      entityId: store.episodeId,
      patientId: store.patientId,
      episodeId: store.episodeId,
      summaryAr: `حفظ وتحديث التقييم السريري لحلقة الرعاية #${store.episodeId.slice(0, 6)}`,
      summaryEn: `Saved episode-scoped clinical assessment for episode #${store.episodeId.slice(0, 6)}`,
    });
  }

  /**
   * Encrypted `db.episodeClinical` read helper.
   * Falls back to `localStorage` only when no encrypted Dexie record exists yet.
   */
  static async getEpisodeClinicalStoreEncrypted(
    episodeId: string,
    patientId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeScopedClinicalStore> {
    const existingEntity =
      (await database.episodeClinical.get(episodeId)) ||
      (await database.episodeClinical.where('episodeId').equals(episodeId).first());
    if (existingEntity) {
      return await decryptRecordPayload<EpisodeScopedClinicalStore>(
        dek,
        'episodeClinical',
        existingEntity.id,
        [existingEntity.episodeId],
        existingEntity.iv,
        existingEntity.ciphertext,
        existingEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        existingEntity.dekVersion || CURRENT_DEK_VERSION
      );
    }
    return this.getEpisodeClinicalStore(episodeId, patientId);
  }

  /**
   * Encrypted `db.episodeClinical` write path with strict append-only snapshot enforcement (Item B):
   * - Applies whether `localStorage` still has the key OR only the encrypted Dexie record exists.
   * - Pre-reads & validates snapshots and computes encryption before opening the Dexie transaction.
   * - Inside ONE `rw` transaction on `episodeClinical` + `vaultMeta`:
   *   re-reads the existing record, compares `updatedAt` and `iv`, decrypts the stored record,
   *   and rejects any deletion, reorder, or mutation of existing snapshots (`canonicalizeForSeal`)
   *   before committing.
   */
  static async saveEpisodeClinicalStoreEncrypted(
    store: EpisodeScopedClinicalStore,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<EncryptedEpisodeClinicalEntity> {
    if (!store.episodeId || !store.patientId) {
      throw new Error('معرّف حلقة الرعاية والمريض إلزاميان لحفظ سجل التقييم المشفر.');
    }

    // 1. Check any residual localStorage snapshots if the key still exists
    const epKey = `${STORAGE_KEYS.EPISODE_STORE_PREFIX}${store.episodeId}`;
    if (typeof localStorage !== 'undefined') {
      const existingLsRaw = localStorage.getItem(epKey);
      if (existingLsRaw) {
        try {
          const parsedLs = JSON.parse(existingLsRaw) as EpisodeScopedClinicalStore;
          assertAppendOnlySnapshots(parsedLs.snapshots || [], store.snapshots || []);
        } catch (err) {
          if (err instanceof Error && err.message.includes('Append-only Snapshots')) {
            throw err;
          }
        }
      }
    }

    // 2. Pre-read existing encrypted Dexie record before encrypting candidate payload
    const preEntity =
      (await database.episodeClinical.get(store.episodeId)) ||
      (await database.episodeClinical.where('episodeId').equals(store.episodeId).first());

    if (
      expectedUpdatedAt !== undefined &&
      preEntity &&
      preEntity.updatedAt !== expectedUpdatedAt
    ) {
      throw new StaleTabOverwriteError(
        'تم تعديل سجل تقييم حلقة الرعاية في تبويب آخر (Changed in another tab).'
      );
    }

    if (preEntity) {
      const preDecrypted = await decryptRecordPayload<EpisodeScopedClinicalStore>(
        dek,
        'episodeClinical',
        preEntity.id,
        [preEntity.episodeId],
        preEntity.iv,
        preEntity.ciphertext,
        preEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        preEntity.dekVersion || CURRENT_DEK_VERSION
      );
      assertAppendOnlySnapshots(preDecrypted.snapshots || [], store.snapshots || []);
    }

    const baselineUpdatedAt = expectedUpdatedAt ?? preEntity?.updatedAt;
    const baselineIv = preEntity?.iv;
    const now = new Date().toISOString();
    const createdAt = preEntity?.createdAt || now;

    const payloadToEncrypt: EpisodeScopedClinicalStore = {
      ...store,
      updatedAt: now,
    };

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodeClinical',
      store.episodeId,
      [store.episodeId],
      payloadToEncrypt,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const candidateEntity: EncryptedEpisodeClinicalEntity = {
      id: store.episodeId,
      episodeId: store.episodeId,
      patientId: store.patientId,
      createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    if (episodeClinicalMutationTestHook) {
      await episodeClinicalMutationTestHook({ episodeId: store.episodeId });
    }

    // 3. Inside ONE rw transaction: re-read existing record, compare updatedAt and iv,
    //    decrypt, and reject any deletion, reorder, or mutation of existing snapshots (canonicalizeForSeal)
    await database.transaction(
      'rw',
      [database.episodeClinical, database.vaultMeta],
      async () => {
        const currentEntity =
          (await database.episodeClinical.get(store.episodeId)) ||
          (await database.episodeClinical.where('episodeId').equals(store.episodeId).first());

        if (preEntity) {
          if (
            !currentEntity ||
            currentEntity.updatedAt !== baselineUpdatedAt ||
            (baselineIv && !areUint8ArraysEqual(currentEntity.iv, baselineIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل سجل تقييم حلقة الرعاية في تبويب آخر أثناء الحفظ (Changed in another tab).'
            );
          }
        } else if (currentEntity) {
          throw new StaleTabOverwriteError(
            'تم إنشاء سجل تقييم حلقة الرعاية في تبويب آخر أثناء الحفظ (Changed in another tab).'
          );
        }

        if (currentEntity) {
          const inTxDecrypted = await decryptRecordPayload<EpisodeScopedClinicalStore>(
            dek,
            'episodeClinical',
            currentEntity.id,
            [currentEntity.episodeId],
            currentEntity.iv,
            currentEntity.ciphertext,
            currentEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            currentEntity.dekVersion || CURRENT_DEK_VERSION
          );
          assertAppendOnlySnapshots(
            inTxDecrypted.snapshots || [],
            payloadToEncrypt.snapshots || []
          );
        }

        await database.episodeClinical.put(candidateEntity);
      }
    );

    return candidateEntity;
  }

  static recordEpisodeSnapshot(
    episodeId: string,
    patientId: string,
    snapshotType: ClinicalAssessmentSnapshot['snapshotType'],
    customLabelAr?: string,
    customLabelEn?: string
  ): ClinicalAssessmentSnapshot {
    const store = this.getEpisodeClinicalStore(episodeId, patientId);
    const staff = this.getActiveStaff();
    const today = localDate();

    const romEntries = store.objective?.romBattery?.entries || [];
    const mmtEntries = store.objective?.mmtBattery?.entries || [];

    const typeLabels: Record<ClinicalAssessmentSnapshot['snapshotType'], { ar: string; en: string }> = {
      initial_evaluation: { ar: 'التقييم الأولي (Baseline)', en: 'Initial Evaluation' },
      re_evaluation: { ar: `إعادة تقييم سريري (${store.snapshots.length + 1})`, en: `Re-evaluation #${store.snapshots.length + 1}` },
      follow_up: { ar: 'تحديث متابعة سريرية', en: 'Follow-up Snapshot' },
      discharge: { ar: 'تقييم التخريج الختامي (Discharge)', en: 'Discharge Evaluation' },
    };

    const snapshot: ClinicalAssessmentSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      episodeId,
      snapshotType,
      recordedDate: today,
      recordedBy: staff.nameEn,
      labelAr: customLabelAr || typeLabels[snapshotType].ar,
      labelEn: customLabelEn || typeLabels[snapshotType].en,
      painNrsRest: store.painAtRestNrs ?? 0,
      painNrsActivity: store.painOnActivityNrs ?? 0,
      romSummary: romEntries
        .filter((r) => r.isTested && r.measuredAngleDegrees !== null)
        .map((r) => ({
          jointMovementKey: `${r.jointId}_${r.movementId}_${r.laterality}`,
          labelAr: `${r.jointNameAr} - ${r.movementNameAr} (${r.laterality === 'right' ? 'يمين' : r.laterality === 'left' ? 'يسار' : 'ثنائي'})`,
          labelEn: `${r.jointNameEn} ${r.movementNameEn} (${r.laterality})`,
          laterality: r.laterality,
          aromDegrees: r.measuredAngleDegrees,
          normalDegrees: r.referenceUninvolvedAngleDegrees || 150,
        })),
      mmtSummary: mmtEntries
        .filter((m) => m.isTested && m.gradeValue !== null)
        .map((m) => ({
          muscleKey: `${m.muscleGroupId}_${m.laterality}`,
          labelAr: `${m.muscleNameAr} (${m.laterality === 'right' ? 'يمين' : m.laterality === 'left' ? 'يسار' : 'ثنائي'})`,
          labelEn: `${m.muscleNameEn} (${m.laterality})`,
          laterality: m.laterality,
          grade: m.gradeValue || '4',
        })),
      outcomeScale: store.functionalScales
        ? {
            scaleId: store.functionalScales.scaleId,
            scaleNameAr: store.functionalScales.scaleNameAr,
            scaleNameEn: store.functionalScales.scaleNameEn,
            scorePercentage: store.functionalScales.scorePercentage,
            severityLabelAr: store.functionalScales.severityLabelAr,
            severityLabelEn: store.functionalScales.severityLabelEn,
          }
        : undefined,
      specialTestsPositiveCount: (store.specialTests || []).filter(
        (t) => t.outcome === 'positive' || t.outcome === 'pain_reproduced'
      ).length,
      clinicalImpressionNote: store.clinicalImpression,
    };

    store.snapshots = [...store.snapshots, snapshot];
    this.saveEpisodeClinicalStore(store);
    return snapshot;
  }

  // --- Session Exercise & Modality Flowsheet ---
  static getSessionFlowsheet(sessionId: string): SessionFlowsheetData | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.SESSION_FLOWSHEET_PREFIX}${sessionId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  static saveSessionFlowsheet(sessionId: string, episodeId: string, data: SessionFlowsheetData): void {
    localStorage.setItem(
      `${STORAGE_KEYS.SESSION_FLOWSHEET_PREFIX}${sessionId}`,
      JSON.stringify(data)
    );
    // Also store as latest flowsheet on the episode for instant carry-forward into next visit
    localStorage.setItem(
      `${STORAGE_KEYS.SESSION_FLOWSHEET_PREFIX}latest_ep_${episodeId}`,
      JSON.stringify(data)
    );
  }

  static getLatestEpisodeFlowsheet(episodeId: string): SessionFlowsheetData | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.SESSION_FLOWSHEET_PREFIX}latest_ep_${episodeId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  // --- Appointments & Waiting List ---
  static getAppointments(): ClinicAppointment[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    const today = localDate();
    const defaults: ClinicAppointment[] = [
      {
        id: 'appt_default_1',
        patientId: 'demo_pt_1',
        patientName: 'أحمد عبد الله الكبيسي',
        patientPhone: '+964 771 234 5678',
        episodeTitle: 'تأهيل الرباط الصليبي الأمامي (ACL Reconstruction)',
        therapistName: CLINIC_STAFF_ROSTER[0].nameAr,
        date: today,
        startTime: '09:30',
        durationMinutes: 45,
        visitType: 'follow_up',
        status: 'in_session',
        roomOrBed: 'وحدة التأهيل الرياضي 1',
        notes: 'الجلسة السادسة - تركيز على مدى بسط الركبة الكامل TKE',
      },
      {
        id: 'appt_default_2',
        patientId: 'demo_pt_2',
        patientName: 'زينب محمد العامري',
        patientPhone: '+964 780 987 6543',
        episodeTitle: 'انزلاق غضروفي قطني L4-L5 مع عرق النسا',
        therapistName: CLINIC_STAFF_ROSTER[1].nameAr,
        date: today,
        startTime: '10:30',
        durationMinutes: 45,
        visitType: 're_evaluation',
        status: 'arrived',
        roomOrBed: 'غرفة العلاج اليدوي 2',
        notes: 'إعادة تقييم مقياس أوسوستري ODI وفحص SLR',
      },
      {
        id: 'appt_default_3',
        patientId: 'demo_pt_3',
        patientName: 'مصطفى كامل الدليمي',
        patientPhone: '+964 770 555 1212',
        episodeTitle: 'متلازمة انحشار الكتف الأيمن (Shoulder Impingement)',
        therapistName: CLINIC_STAFF_ROSTER[0].nameAr,
        date: today,
        startTime: '11:30',
        durationMinutes: 60,
        visitType: 'initial_evaluation',
        status: 'scheduled',
        roomOrBed: 'غرفة التقييم الأولي 1',
        notes: 'محال من د. حيدر العبيدي - استشاري جراحة العظام',
      },
    ];
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(defaults));
    return defaults;
  }

  static saveAppointment(appt: Omit<ClinicAppointment, 'id'> & { id?: string }): ClinicAppointment {
    const list = this.getAppointments();
    const record: ClinicAppointment = {
      ...appt,
      id: appt.id || `appt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const existingIdx = list.findIndex((a) => a.id === record.id);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    return record;
  }

  static updateAppointmentStatus(id: string, status: AppointmentStatus): ClinicAppointment[] {
    const existingAppt = this.getAppointments().find((a) => a.id === id);
    const list = this.getAppointments().map((a) => (a.id === id ? { ...a, status } : a));
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    this.appendAuditLog({
      actionType: 'appointment_status_changed',
      entityType: 'appointment',
      entityId: id,
      patientId: existingAppt?.patientId,
      episodeId: existingAppt?.episodeId,
      summaryAr: `تحديث حالة الموعد إلى: ${status}`,
      summaryEn: `Updated appointment status to: ${status}`,
    });
    return list;
  }

  static deleteAppointment(id: string): ClinicAppointment[] {
    const list = this.getAppointments().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    return list;
  }

  // --- Waiting List ---
  static getWaitingList(): WaitingListEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WAITING_LIST);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    const defaults: WaitingListEntry[] = [
      {
        id: 'wait_1',
        patientName: 'حيدر جاسم الشمري',
        phone: '+964 772 310 4490',
        conditionOrRegion: 'تأهيل بعد عملية تبديل مفصل الركبة (TKR)',
        preferredTherapist: CLINIC_STAFF_ROSTER[0].nameAr,
        preferredDays: 'السبت، الإثنين، الأربعاء',
        preferredTimeWindow: 'evening',
        priority: 'urgent',
        addedAt: localDate(),
        notes: 'يرغب بموعد مسائي بعد الساعة 4 عصراً',
      },
      {
        id: 'wait_2',
        patientName: 'مريم طارق الجبوري',
        phone: '+964 781 600 2211',
        conditionOrRegion: 'آلام الرقبة والانزلاق العنقي C5-C6',
        preferredTherapist: CLINIC_STAFF_ROSTER[1].nameAr,
        preferredDays: 'الأحد، الثلاثاء، الخميس',
        preferredTimeWindow: 'morning',
        priority: 'normal',
        addedAt: localDate(),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.WAITING_LIST, JSON.stringify(defaults));
    return defaults;
  }

  static addWaitingListEntry(entry: Omit<WaitingListEntry, 'id' | 'addedAt'>): WaitingListEntry[] {
    const list = this.getWaitingList();
    const newEntry: WaitingListEntry = {
      ...entry,
      id: `wait_${Date.now()}`,
      addedAt: localDate(),
    };
    const updated = [newEntry, ...list];
    localStorage.setItem(STORAGE_KEYS.WAITING_LIST, JSON.stringify(updated));
    return updated;
  }

  static removeWaitingListEntry(id: string): WaitingListEntry[] {
    const updated = this.getWaitingList().filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.WAITING_LIST, JSON.stringify(updated));
    return updated;
  }

  // --- Iraqi Financial System (IQD Invoices, Packages, Partial Payments & Debt Ledger) ---
  static getInvoicesIQD(): FinancialInvoiceIQD[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INVOICES_IQD);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    const today = localDate();
    const defaults: FinancialInvoiceIQD[] = [
      {
        id: 'inv_iqd_1001',
        invoiceNumber: 'INV-IQD-1001',
        patientId: 'demo_pt_1',
        patientName: 'أحمد عبد الله الكبيسي',
        episodeTitle: 'كورس تأهيل الرباط الصليبي (10 جلسات)',
        date: today,
        invoiceType: 'rehab_package',
        titleAr: 'باقة تأهيل علاجي متكامل (10 جلسات)',
        titleEn: '10-Session Comprehensive Rehab Package',
        totalAmountIQD: 250000,
        discountIQD: 25000,
        netAmountIQD: 225000,
        paidAmountIQD: 150000,
        balanceDueIQD: 75000,
        status: 'partial',
        packageTotalSessions: 10,
        packageUsedSessions: 6,
        createdBy: CLINIC_STAFF_ROSTER[3].nameAr,
        payments: [
          {
            id: 'pay_1',
            invoiceId: 'inv_iqd_1001',
            patientId: 'demo_pt_1',
            date: today,
            amountIQD: 150000,
            method: 'cash_iqd',
            receivedBy: CLINIC_STAFF_ROSTER[3].nameAr,
            receiptNumber: 'RCPT-901',
            notes: 'دفعة أولى نقداً عند بدء الكورس',
          },
        ],
        notes: 'متبقي بذمة المريض 75,000 د.ع تسدد عند الجلسة الثامنة',
      },
      {
        id: 'inv_iqd_1002',
        invoiceNumber: 'INV-IQD-1002',
        patientId: 'demo_pt_2',
        patientName: 'زينب محمد العامري',
        episodeTitle: 'تأهيل الانزلاق القطني L4-L5',
        date: today,
        invoiceType: 'single_session',
        titleAr: 'جلسة علاج طبيعي مفردة + علاج يدوي',
        titleEn: 'Single PT Session & Manual Therapy',
        totalAmountIQD: 30000,
        discountIQD: 0,
        netAmountIQD: 30000,
        paidAmountIQD: 30000,
        balanceDueIQD: 0,
        status: 'paid',
        createdBy: CLINIC_STAFF_ROSTER[3].nameAr,
        payments: [
          {
            id: 'pay_2',
            invoiceId: 'inv_iqd_1002',
            patientId: 'demo_pt_2',
            date: today,
            amountIQD: 30000,
            method: 'zain_cash',
            receivedBy: CLINIC_STAFF_ROSTER[3].nameAr,
            receiptNumber: 'RCPT-902',
          },
        ],
      },
    ];
    localStorage.setItem(STORAGE_KEYS.INVOICES_IQD, JSON.stringify(defaults));
    return defaults;
  }

  static createInvoiceIQD(params: {
    patientId: string;
    patientName: string;
    episodeId?: string;
    episodeTitle?: string;
    invoiceType: FinancialInvoiceIQD['invoiceType'];
    titleAr: string;
    titleEn: string;
    totalAmountIQD: number;
    discountIQD: number;
    initialPaidIQD: number;
    paymentMethod: IraqiPaymentMethod;
    packageTotalSessions?: number;
    notes?: string;
  }): FinancialInvoiceIQD {
    const list = this.getInvoicesIQD();
    const staff = this.getActiveStaff();
    const today = localDate();
    const netAmountIQD = Math.max(0, params.totalAmountIQD - params.discountIQD);
    const paidAmountIQD = Math.min(netAmountIQD, Math.max(0, params.initialPaidIQD));
    const balanceDueIQD = Math.max(0, netAmountIQD - paidAmountIQD);
    const status: FinancialInvoiceIQD['status'] =
      balanceDueIQD === 0 ? 'paid' : paidAmountIQD > 0 ? 'partial' : 'unpaid';

    const invId = `inv_${Date.now()}`;
    const invoiceNumber = `INV-IQD-${1001 + list.length}`;

    const payments: PaymentTransactionIQD[] =
      paidAmountIQD > 0
        ? [
            {
              id: `pay_${Date.now()}`,
              invoiceId: invId,
              patientId: params.patientId,
              date: today,
              amountIQD: paidAmountIQD,
              method: params.paymentMethod,
              receivedBy: staff.nameAr,
              receiptNumber: `RCPT-${900 + list.length + 1}`,
              notes: 'دفعة عند إصدار الفاتورة',
            },
          ]
        : [];

    const newInvoice: FinancialInvoiceIQD = {
      id: invId,
      invoiceNumber,
      patientId: params.patientId,
      patientName: params.patientName,
      episodeId: params.episodeId,
      episodeTitle: params.episodeTitle,
      date: today,
      invoiceType: params.invoiceType,
      titleAr: params.titleAr,
      titleEn: params.titleEn,
      totalAmountIQD: params.totalAmountIQD,
      discountIQD: params.discountIQD,
      netAmountIQD,
      paidAmountIQD,
      balanceDueIQD,
      status,
      packageTotalSessions:
        params.invoiceType === 'rehab_package' ? params.packageTotalSessions || 6 : undefined,
      packageUsedSessions: params.invoiceType === 'rehab_package' ? 1 : undefined,
      payments,
      createdBy: staff.nameAr,
      notes: params.notes,
    };

    const updated = [newInvoice, ...list];
    localStorage.setItem(STORAGE_KEYS.INVOICES_IQD, JSON.stringify(updated));

    this.appendAuditLog({
      actionType: 'invoice_created',
      entityType: 'invoice',
      entityId: newInvoice.id,
      patientId: params.patientId,
      episodeId: params.episodeId,
      summaryAr: `إصدار فاتورة ${invoiceNumber} بصافي ${formatIQD(netAmountIQD, true)}`,
      summaryEn: `Created invoice ${invoiceNumber} (${formatIQD(netAmountIQD, false)})`,
    });

    return newInvoice;
  }

  static recordPaymentOnInvoiceIQD(
    invoiceId: string,
    amountIQD: number,
    method: IraqiPaymentMethod,
    notes?: string
  ): FinancialInvoiceIQD[] {
    const list = this.getInvoicesIQD();
    const staff = this.getActiveStaff();
    const today = localDate();

    const updated = list.map((inv) => {
      if (inv.id !== invoiceId) return inv;
      const validPay = Math.min(inv.balanceDueIQD, Math.max(0, amountIQD));
      if (validPay <= 0) return inv;

      const tx: PaymentTransactionIQD = {
        id: `pay_${Date.now()}`,
        invoiceId: inv.id,
        patientId: inv.patientId,
        date: today,
        amountIQD: validPay,
        method,
        receivedBy: staff.nameAr,
        receiptNumber: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`,
        notes,
      };

      const newPaid = inv.paidAmountIQD + validPay;
      const newBalance = Math.max(0, inv.netAmountIQD - newPaid);
      const newStatus: FinancialInvoiceIQD['status'] =
        newBalance === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

      this.appendAuditLog({
        actionType: 'payment_collected_iqd',
        entityType: 'invoice',
        entityId: inv.id,
        patientId: inv.patientId,
        episodeId: inv.episodeId,
        summaryAr: `استلام دفعة بمبلغ ${formatIQD(validPay, true)} على الفاتورة ${inv.invoiceNumber}`,
        summaryEn: `Collected payment of ${formatIQD(validPay, false)} on invoice ${inv.invoiceNumber}`,
      });

      return {
        ...inv,
        paidAmountIQD: newPaid,
        balanceDueIQD: newBalance,
        status: newStatus,
        payments: [tx, ...inv.payments],
      };
    });

    localStorage.setItem(STORAGE_KEYS.INVOICES_IQD, JSON.stringify(updated));
    return updated;
  }

  static incrementPackageSessionUsed(invoiceId: string): FinancialInvoiceIQD[] {
    const list = this.getInvoicesIQD().map((inv) => {
      if (inv.id !== invoiceId || !inv.packageTotalSessions) return inv;
      const used = Math.min(inv.packageTotalSessions, (inv.packageUsedSessions || 0) + 1);
      return { ...inv, packageUsedSessions: used };
    });
    localStorage.setItem(STORAGE_KEYS.INVOICES_IQD, JSON.stringify(list));
    return list;
  }

  static getPatientFinancialSummaryIQD(patientId: string, patientName?: string) {
    const allInvoices = this.getInvoicesIQD();
    const patientInvoices = allInvoices.filter(
      (inv) =>
        inv.patientId === patientId ||
        (patientName && inv.patientName.trim() === patientName.trim())
    );
    const totalBilledIQD = patientInvoices.reduce((s, i) => s + i.netAmountIQD, 0);
    const totalPaidIQD = patientInvoices.reduce((s, i) => s + i.paidAmountIQD, 0);
    const totalDebtIQD = patientInvoices.reduce((s, i) => s + i.balanceDueIQD, 0);
    const activePackages = patientInvoices.filter(
      (i) =>
        i.invoiceType === 'rehab_package' &&
        (i.packageUsedSessions || 0) < (i.packageTotalSessions || 0)
    );
    return {
      invoices: patientInvoices,
      totalBilledIQD,
      totalPaidIQD,
      totalDebtIQD,
      activePackages,
    };
  }

  // --- Clinic Operating Expenses (IQD) ---
  static getExpensesIQD(): ClinicExpenseIQD[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES_IQD);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    const today = localDate();
    const defaults: ClinicExpenseIQD[] = [
      {
        id: 'exp_1',
        date: today,
        category: 'medical_consumables',
        titleAr: 'شراء أشرطة لاصقة طبية (Kinesio Tape) وجل سونار وأقطاب TENS',
        titleEn: 'Kinesio Tape, Ultrasound Gel & TENS Electrodes',
        amountIQD: 85000,
        paidBy: CLINIC_STAFF_ROSTER[3].nameAr,
      },
      {
        id: 'exp_2',
        date: today,
        category: 'electricity_generator',
        titleAr: 'اشتراك خط المولدة الذهبي للعيادة',
        titleEn: 'Clinic Generator Power Subscription',
        amountIQD: 120000,
        paidBy: CLINIC_STAFF_ROSTER[0].nameAr,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.EXPENSES_IQD, JSON.stringify(defaults));
    return defaults;
  }

  static addExpenseIQD(expense: Omit<ClinicExpenseIQD, 'id'>): ClinicExpenseIQD[] {
    const list = this.getExpensesIQD();
    const record: ClinicExpenseIQD = {
      ...expense,
      id: `exp_${Date.now()}`,
    };
    const updated = [record, ...list];
    localStorage.setItem(STORAGE_KEYS.EXPENSES_IQD, JSON.stringify(updated));
    this.appendAuditLog({
      actionType: 'expense_recorded_iqd',
      entityType: 'expense',
      entityId: record.id,
      summaryAr: `تسجيل مصروف عيادة: ${record.titleAr} بمبلغ ${formatIQD(record.amountIQD, true)}`,
      summaryEn: `Logged clinic expense: ${record.titleEn} (${formatIQD(record.amountIQD, false)})`,
    });
    return updated;
  }

  static deleteExpenseIQD(id: string): ClinicExpenseIQD[] {
    const updated = this.getExpensesIQD().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES_IQD, JSON.stringify(updated));
    return updated;
  }
}
