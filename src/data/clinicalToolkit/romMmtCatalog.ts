// =======================================================================
// PhysioRecord — ROM & MMT Clinical Catalogs, Validation & Longitudinal Engine
// WHO UMD Terminology, MRC Standard (Grade 0 Invariant), & Comparability
// =======================================================================

import type {
  RomMovementType,
  BodyLaterality,
  RomEndFeel,
  ClinicalNonTestableReason,
  MmtGradeValue,
  MmtGravityCondition,
  RomMeasurementEntry,
  RomAssessmentBatteryData,
  MmtAssessmentBatteryData,
} from '../../types/clinical';

// -----------------------------------------------------------------------
// 1. Core Clinical Terminologies & Taxonomies
// -----------------------------------------------------------------------

export const ROM_MOVEMENT_TYPES: Record<RomMovementType, { id: RomMovementType; ar: string; en: string }> = {
  AROM: {
    id: 'AROM',
    ar: 'المدى الحركي الفاعل (Active ROM)',
    en: 'Active Range of Motion (AROM)',
  },
  PROM: {
    id: 'PROM',
    ar: 'المدى الحركي المنفعل (Passive ROM)',
    en: 'Passive Range of Motion (PROM)',
  },
  AAROM: {
    id: 'AAROM',
    ar: 'المدى الحركي الفاعل بمساعدة (Active-Assisted ROM)',
    en: 'Active-Assisted Range of Motion (AAROM)',
  },
};

export const BODY_LATERALITIES: Record<BodyLaterality, { id: BodyLaterality; ar: string; en: string }> = {
  right: { id: 'right', ar: 'الطرف الأيمن', en: 'Right' },
  left: { id: 'left', ar: 'الطرف الأيسر', en: 'Left' },
  bilateral: { id: 'bilateral', ar: 'ثنائي الجانب', en: 'Bilateral' },
  midline: { id: 'midline', ar: 'محوري / خط الوسط', en: 'Midline / Axial' },
};

export interface RomEndFeelDefinition {
  id: RomEndFeel;
  ar: string;
  en: string;
  isNormal: boolean;
  clinicalDescriptionAr: string;
}

export const ROM_END_FEELS: Record<RomEndFeel, RomEndFeelDefinition> = {
  normal_capsular_firm: {
    id: 'normal_capsular_firm',
    ar: 'نهاية محفظية مشدودة طبيعية (Firm / Capsular)',
    en: 'Normal Firm / Capsular End-Feel',
    isNormal: true,
    clinicalDescriptionAr: 'مقاومة تدريجية مشدودة مع مرونة طفيفة ناجمة عن شد المحفظة والأربطة المحيطة بالمفصل.',
  },
  normal_bone_to_bone: {
    id: 'normal_bone_to_bone',
    ar: 'تلامس عظمي صلب طبيعي (Hard / Bone-to-Bone)',
    en: 'Normal Hard / Bone-to-Bone End-Feel',
    isNormal: true,
    clinicalDescriptionAr: 'توقف مفاجئ غير مرن ناتج عن تلامس عظمي مباشر (مثل بسط المرفق الطبيعي).',
  },
  normal_soft_tissue_approximation: {
    id: 'normal_soft_tissue_approximation',
    ar: 'تلامس أنسجة رخوة طبيعي (Soft Tissue Approximation)',
    en: 'Normal Soft Tissue Approximation',
    isNormal: true,
    clinicalDescriptionAr: 'إحساس ضغط مرن طري ناجم عن تلامس الكتل العضلية المتقابلة (مثل ثني المرفق أو الركبة).',
  },
  abnormal_empty_pain: {
    id: 'abnormal_empty_pain',
    ar: 'نهاية خالية بسبب الألم الحاد (Abnormal Empty — Pain Limited)',
    en: 'Abnormal Empty End-Feel (Pain Limited)',
    isNormal: false,
    clinicalDescriptionAr: 'توقف الحركة قبل بلوغ النهاية الميكانيكية الحقيقية نتيجة ألم حاد شديد أو خشية المريض (مثل التهاب جرابي حاد).',
  },
  abnormal_muscle_spasm: {
    id: 'abnormal_muscle_spasm',
    ar: 'تشنج أو تقلص عضلي لاإرادي حاد (Abnormal Muscle Spasm / Guarding)',
    en: 'Abnormal Muscle Spasm / Guarding',
    isNormal: false,
    clinicalDescriptionAr: 'مقاومة عضلية لاإرادية مفاجئة وتشنج ارتكاسي حاد لحماية مفصل غير مستقر أو ملتهب.',
  },
  abnormal_springy_block: {
    id: 'abnormal_springy_block',
    ar: 'ارتداد مرن ناتج عن عائق ميكانيكي (Abnormal Springy Block)',
    en: 'Abnormal Springy Block / Meniscal Block',
    isNormal: false,
    clinicalDescriptionAr: 'ارتداد رادع ومرونة غير معتادة عند نقطة التوقف ناجمة عن انحباس جسم حر أو تمزق غضروفي هلالي داخل المفصل.',
  },
  abnormal_capsular_early: {
    id: 'abnormal_capsular_early',
    ar: 'تيبّس محفظي مبكر (Abnormal Early Capsular / Adhesive)',
    en: 'Abnormal Early Capsular / Adhesive Capsulitis',
    isNormal: false,
    clinicalDescriptionAr: 'مقاومة محفظية قاسية في مرحلة مبكرة جداً من المدى الحركي (مثل الكتف المتجمد أو الالتصاقات الليفية).',
  },
};

export const CLINICAL_NON_TESTABLE_REASONS: Record<ClinicalNonTestableReason, { id: ClinicalNonTestableReason; ar: string; en: string }> = {
  severe_acute_pain: {
    id: 'severe_acute_pain',
    ar: 'ألم حاد شديد يمنع الفحص الآمن (Severe Acute Pain)',
    en: 'Severe Acute Pain',
  },
  surgical_or_post_op_precaution: {
    id: 'surgical_or_post_op_precaution',
    ar: 'محاذير جراحية أو بروتوكول ما بعد العملية (Surgical Precaution)',
    en: 'Surgical or Post-Op Precaution',
  },
  fracture_or_joint_instability: {
    id: 'fracture_or_joint_instability',
    ar: 'كسر حديث أو عدم ثباتية مفصلية حادة (Fracture / Instability)',
    en: 'Fracture or Joint Instability',
  },
  cast_or_splint_immobilized: {
    id: 'cast_or_splint_immobilized',
    ar: 'تثبيت بالجبيرة أو دعامة عظمية (Immobilized in Cast/Splint)',
    en: 'Immobilized in Cast or Splint',
  },
  severe_spasticity: {
    id: 'severe_spasticity',
    ar: 'تشنج عصبي تشنجي حاد يمنع الحركة المعيارية (Severe Spasticity)',
    en: 'Severe Spasticity',
  },
  patient_refused_or_fatigued: {
    id: 'patient_refused_or_fatigued',
    ar: 'إرهاق شديد أو تعذر تعاون المريض (Patient Fatigued / Unable)',
    en: 'Patient Fatigued or Unable to Cooperate',
  },
};

export interface MrcGradeDefinition {
  grade: MmtGradeValue;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  gravityCondition: MmtGravityCondition;
  isSubgrade?: boolean;
}

/**
 * Validated Medical Research Council (MRC) Grading Scale Catalog
 * CLINICAL SAFETY INVARIANT: Grade 0 strictly defines "No contraction seen or felt".
 * It MUST NEVER be labeled as "Paralysis" or "شلل عصبي".
 */
export const MRC_GRADES_CATALOG: Record<MmtGradeValue, MrcGradeDefinition> = {
  '0': {
    grade: '0',
    labelAr: 'الدرجة 0: لا يوجد انقباض',
    labelEn: 'Grade 0: None',
    descriptionAr: 'الدرجة 0: غياب تام للانقباض العضلي (لا حركة ولا أثر محسوس)',
    descriptionEn: 'Grade 0: No contraction seen or felt',
    gravityCondition: 'gravity_eliminated',
  },
  '1': {
    grade: '1',
    labelAr: 'الدرجة 1: أثر انقباض (Flicker)',
    labelEn: 'Grade 1: Trace',
    descriptionAr: 'الدرجة 1: وميض أو أثر انقباض محسوس دون حركة مفصلية (Flicker)',
    descriptionEn: 'Grade 1: Trace contraction / flicker without joint movement',
    gravityCondition: 'gravity_eliminated',
  },
  '2-': {
    grade: '2-',
    labelAr: 'الدرجة 2-: حركة جزئية بإلغاء الجاذبية',
    labelEn: 'Grade 2-: Poor Minus',
    descriptionAr: 'الدرجة 2-: حركة جزئية في وضع إلغاء الجاذبية',
    descriptionEn: 'Grade 2-: Partial range of motion with gravity eliminated',
    gravityCondition: 'gravity_eliminated',
    isSubgrade: true,
  },
  '2': {
    grade: '2',
    labelAr: 'الدرجة 2: مدى كامل بإلغاء الجاذبية',
    labelEn: 'Grade 2: Poor',
    descriptionAr: 'الدرجة 2: مدى حركي كامل في وضع إلغاء الجاذبية فقط',
    descriptionEn: 'Grade 2: Complete range of motion with gravity eliminated',
    gravityCondition: 'gravity_eliminated',
  },
  '2+': {
    grade: '2+',
    labelAr: 'الدرجة 2+: حركة جزئية ضد الجاذبية',
    labelEn: 'Grade 2+: Poor Plus',
    descriptionAr: 'الدرجة 2+: حركة كاملة بإلغاء الجاذبية ومقاومة طفيفة، أو حركة جزئية ضد الجاذبية (<50%)',
    descriptionEn: 'Grade 2+: Full range gravity-eliminated with minimal resistance, or partial against gravity',
    gravityCondition: 'against_gravity',
    isSubgrade: true,
  },
  '3-': {
    grade: '3-',
    labelAr: 'الدرجة 3-: حركة جزئية ضد الجاذبية (>50%)',
    labelEn: 'Grade 3-: Fair Minus',
    descriptionAr: 'الدرجة 3-: مدى حركي جزئي (>50%) ضد الجاذبية فقط',
    descriptionEn: 'Grade 3-: Partial range (>50%) against gravity',
    gravityCondition: 'against_gravity',
    isSubgrade: true,
  },
  '3': {
    grade: '3',
    labelAr: 'الدرجة 3: مدى كامل ضد الجاذبية',
    labelEn: 'Grade 3: Fair',
    descriptionAr: 'الدرجة 3: مدى حركي كامل ضد الجاذبية دون أي مقاومة يدوية',
    descriptionEn: 'Grade 3: Complete range of motion against gravity without resistance',
    gravityCondition: 'against_gravity',
  },
  '3+': {
    grade: '3+',
    labelAr: 'الدرجة 3+: ضد الجاذبية مع مقاومة طفيفة',
    labelEn: 'Grade 3+: Fair Plus',
    descriptionAr: 'الدرجة 3+: مدى كامل ضد الجاذبية مع مقاومة يدوية طفيفة جداً',
    descriptionEn: 'Grade 3+: Complete range against gravity with minimal manual resistance',
    gravityCondition: 'against_gravity',
    isSubgrade: true,
  },
  '4-': {
    grade: '4-',
    labelAr: 'الدرجة 4-: ضد الجاذبية ومقاومة خفيفة',
    labelEn: 'Grade 4-: Good Minus',
    descriptionAr: 'الدرجة 4-: مدى كامل ضد الجاذبية مع مقاومة يدوية خفيفة إلى معتدلة',
    descriptionEn: 'Grade 4-: Complete range against gravity with slight to moderate resistance',
    gravityCondition: 'against_gravity',
    isSubgrade: true,
  },
  '4': {
    grade: '4',
    labelAr: 'الدرجة 4: مدى كامل ومقاومة معتدلة',
    labelEn: 'Grade 4: Good',
    descriptionAr: 'الدرجة 4: مدى كامل ضد الجاذبية مع مقاومة يدوية معتدلة',
    descriptionEn: 'Grade 4: Complete range against gravity with moderate resistance',
    gravityCondition: 'against_gravity',
  },
  '4+': {
    grade: '4+',
    labelAr: 'الدرجة 4+: مدى كامل ومقاومة قوية',
    labelEn: 'Grade 4+: Good Plus',
    descriptionAr: 'الدرجة 4+: مدى كامل ضد الجاذبية مع مقاومة يدوية قوية شبه تامة',
    descriptionEn: 'Grade 4+: Complete range against gravity with strong, near-maximal resistance',
    gravityCondition: 'against_gravity',
    isSubgrade: true,
  },
  '5': {
    grade: '5',
    labelAr: 'الدرجة 5: قوة عضلية طبيعية تامة',
    labelEn: 'Grade 5: Normal',
    descriptionAr: 'الدرجة 5: قوة عضلية طبيعية تامة ضد أقصى مقاومة يدوية',
    descriptionEn: 'Grade 5: Normal strength against maximal resistance',
    gravityCondition: 'against_gravity',
  },
};

// -----------------------------------------------------------------------
// 2. Standard Joints & Movement Catalogs
// -----------------------------------------------------------------------

export interface JointMovementDefinition {
  movementId: string;
  nameAr: string;
  nameEn: string;
  normalRangeDegrees: string; // e.g. '0° - 180°'
}

export interface JointCatalogDefinition {
  jointId: string;
  nameAr: string;
  nameEn: string;
  applicableLateralities: BodyLaterality[];
  movements: JointMovementDefinition[];
}

export const ROM_JOINTS_CATALOG: JointCatalogDefinition[] = [
  {
    jointId: 'cervical_spine',
    nameAr: 'الفقرات العنقية (Cervical Spine)',
    nameEn: 'Cervical Spine',
    applicableLateralities: ['midline'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني الرقبة للأمام (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 45°' },
      { movementId: 'extension', nameAr: 'بسط الرقبة للخلف (Extension)', nameEn: 'Extension', normalRangeDegrees: '0° - 45°' },
      { movementId: 'lateral_flexion_right', nameAr: 'انثناء جانبي أيمن (Right Lateral Flexion)', nameEn: 'Right Lateral Flexion', normalRangeDegrees: '0° - 45°' },
      { movementId: 'lateral_flexion_left', nameAr: 'انثناء جانبي أيسر (Left Lateral Flexion)', nameEn: 'Left Lateral Flexion', normalRangeDegrees: '0° - 45°' },
      { movementId: 'rotation_right', nameAr: 'دوران أيمن (Right Rotation)', nameEn: 'Right Rotation', normalRangeDegrees: '0° - 80°' },
      { movementId: 'rotation_left', nameAr: 'دوران أيسر (Left Rotation)', nameEn: 'Left Rotation', normalRangeDegrees: '0° - 80°' },
    ],
  },
  {
    jointId: 'lumbar_spine',
    nameAr: 'الفقرات القطنية (Lumbar Spine)',
    nameEn: 'Lumbar Spine',
    applicableLateralities: ['midline'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني الجذع للأمام (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 60°' },
      { movementId: 'extension', nameAr: 'بسط الجذع للخلف (Extension)', nameEn: 'Extension', normalRangeDegrees: '0° - 25°' },
      { movementId: 'lateral_flexion_right', nameAr: 'انثناء جانبي أيمن (Right Lateral Flexion)', nameEn: 'Right Lateral Flexion', normalRangeDegrees: '0° - 25°' },
      { movementId: 'lateral_flexion_left', nameAr: 'انثناء جانبي أيسر (Left Lateral Flexion)', nameEn: 'Left Lateral Flexion', normalRangeDegrees: '0° - 25°' },
    ],
  },
  {
    jointId: 'shoulder',
    nameAr: 'مفصل الكتف (Shoulder Joint)',
    nameEn: 'Shoulder Joint',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني الكتف للأمام (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 180°' },
      { movementId: 'extension', nameAr: 'بسط الكتف للخلف (Extension)', nameEn: 'Extension', normalRangeDegrees: '0° - 60°' },
      { movementId: 'abduction', nameAr: 'تبعيد الكتف (Abduction)', nameEn: 'Abduction', normalRangeDegrees: '0° - 180°' },
      { movementId: 'internal_rotation', nameAr: 'دوران داخلي (Internal Rotation)', nameEn: 'Internal Rotation', normalRangeDegrees: '0° - 70°' },
      { movementId: 'external_rotation', nameAr: 'دوران خارجي (External Rotation)', nameEn: 'External Rotation', normalRangeDegrees: '0° - 90°' },
    ],
  },
  {
    jointId: 'elbow',
    nameAr: 'مفصل المرفق والساعد (Elbow & Forearm)',
    nameEn: 'Elbow & Forearm',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني المرفق (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 145°' },
      { movementId: 'extension', nameAr: 'بسط المرفق (Extension)', nameEn: 'Extension', normalRangeDegrees: '0°' },
      { movementId: 'pronation', nameAr: 'كب الساعد (Pronation)', nameEn: 'Pronation', normalRangeDegrees: '0° - 80°' },
      { movementId: 'supination', nameAr: 'استلقاء الساعد (Supination)', nameEn: 'Supination', normalRangeDegrees: '0° - 85°' },
    ],
  },
  {
    jointId: 'wrist',
    nameAr: 'مفصل الرسغ (Wrist Joint)',
    nameEn: 'Wrist Joint',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'flexion', nameAr: 'عطف الرسغ الراحي (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 80°' },
      { movementId: 'extension', nameAr: 'بسط الرسغ الظهري (Extension)', nameEn: 'Extension', normalRangeDegrees: '0° - 70°' },
      { movementId: 'radial_deviation', nameAr: 'انحراف كعبري (Radial Deviation)', nameEn: 'Radial Deviation', normalRangeDegrees: '0° - 20°' },
      { movementId: 'ulnar_deviation', nameAr: 'انحراف زندي (Ulnar Deviation)', nameEn: 'Ulnar Deviation', normalRangeDegrees: '0° - 30°' },
    ],
  },
  {
    jointId: 'hip',
    nameAr: 'مفصل الورك (Hip Joint)',
    nameEn: 'Hip Joint',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني الورك (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 120°' },
      { movementId: 'extension', nameAr: 'بسط الورك (Extension)', nameEn: 'Extension', normalRangeDegrees: '0° - 30°' },
      { movementId: 'abduction', nameAr: 'تبعيد الورك (Abduction)', nameEn: 'Abduction', normalRangeDegrees: '0° - 45°' },
      { movementId: 'adduction', nameAr: 'تقريب الورك (Adduction)', nameEn: 'Adduction', normalRangeDegrees: '0° - 30°' },
      { movementId: 'internal_rotation', nameAr: 'دوران داخلي (Internal Rotation)', nameEn: 'Internal Rotation', normalRangeDegrees: '0° - 45°' },
      { movementId: 'external_rotation', nameAr: 'دوران خارجي (External Rotation)', nameEn: 'External Rotation', normalRangeDegrees: '0° - 45°' },
    ],
  },
  {
    jointId: 'knee',
    nameAr: 'مفصل الركبة (Knee Joint)',
    nameEn: 'Knee Joint',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'flexion', nameAr: 'ثني الركبة (Flexion)', nameEn: 'Flexion', normalRangeDegrees: '0° - 135°' },
      { movementId: 'extension', nameAr: 'بسط الركبة (Extension)', nameEn: 'Extension', normalRangeDegrees: '0°' },
    ],
  },
  {
    jointId: 'ankle',
    nameAr: 'مفصل الكاحل والقدم (Ankle Joint)',
    nameEn: 'Ankle Joint',
    applicableLateralities: ['right', 'left'],
    movements: [
      { movementId: 'dorsiflexion', nameAr: 'عطف ظهري للكاحل (Dorsiflexion)', nameEn: 'Dorsiflexion', normalRangeDegrees: '0° - 20°' },
      { movementId: 'plantarflexion', nameAr: 'عطف أخمصي للكاحل (Plantarflexion)', nameEn: 'Plantarflexion', normalRangeDegrees: '0° - 50°' },
      { movementId: 'inversion', nameAr: 'انقلاب داخلي للقدم (Inversion)', nameEn: 'Inversion', normalRangeDegrees: '0° - 35°' },
      { movementId: 'eversion', nameAr: 'انقلاب خارجي للقدم (Eversion)', nameEn: 'Eversion', normalRangeDegrees: '0° - 20°' },
    ],
  },
];

export interface MmtMuscleGroupDefinition {
  muscleGroupId: string;
  nameAr: string;
  nameEn: string;
  actionNameAr: string;
  actionNameEn: string;
  applicableLateralities: BodyLaterality[];
}

export const MMT_MUSCLE_GROUPS_CATALOG: MmtMuscleGroupDefinition[] = [
  {
    muscleGroupId: 'cervical_flexors',
    nameAr: 'عاطفات الرقبة (Longus capitis / colli)',
    nameEn: 'Cervical Flexors',
    actionNameAr: 'ثني الرقبة وإيماءة الرأس',
    actionNameEn: 'Cervical Flexion',
    applicableLateralities: ['midline'],
  },
  {
    muscleGroupId: 'shoulder_abductors',
    nameAr: 'مبعدات الكتف (Deltoid & Supraspinatus)',
    nameEn: 'Shoulder Abductors',
    actionNameAr: 'تبعيد الكتف للأعلى',
    actionNameEn: 'Shoulder Abduction',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'shoulder_external_rotators',
    nameAr: 'المدورات الخارجية للكتف (Infraspinatus & Teres Minor)',
    nameEn: 'Shoulder External Rotators',
    actionNameAr: 'دوران الكتف للخارج',
    actionNameEn: 'Shoulder External Rotation',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'elbow_flexors',
    nameAr: 'عاطفات المرفق (Biceps & Brachialis)',
    nameEn: 'Elbow Flexors',
    actionNameAr: 'ثني المرفق',
    actionNameEn: 'Elbow Flexion',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'elbow_extensors',
    nameAr: 'باسطات المرفق (Triceps Brachii)',
    nameEn: 'Elbow Extensors',
    actionNameAr: 'بسط المرفق للأمام',
    actionNameEn: 'Elbow Extension',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'wrist_extensors',
    nameAr: 'باسطات الرسغ (ECRL, ECRB, ECU)',
    nameEn: 'Wrist Extensors',
    actionNameAr: 'بسط الرسغ للخلف',
    actionNameEn: 'Wrist Extension',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'hip_flexors',
    nameAr: 'عاطفات الورك (Iliopsoas)',
    nameEn: 'Hip Flexors',
    actionNameAr: 'ثني مفصل الورك',
    actionNameEn: 'Hip Flexion',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'hip_abductors',
    nameAr: 'مبعدات الورك (Gluteus Medius & Minimus)',
    nameEn: 'Hip Abductors',
    actionNameAr: 'تبعيد الفخذ للوحشي',
    actionNameEn: 'Hip Abduction',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'knee_extensors',
    nameAr: 'باسطات الركبة (Quadriceps Femoris)',
    nameEn: 'Knee Extensors',
    actionNameAr: 'بسط الركبة للأمام',
    actionNameEn: 'Knee Extension',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'knee_flexors',
    nameAr: 'عاطفات الركبة (Hamstrings)',
    nameEn: 'Knee Flexors',
    actionNameAr: 'ثني مفصل الركبة',
    actionNameEn: 'Knee Flexion',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'ankle_dorsiflexors',
    nameAr: 'عاطفات الكاحل الظهرية (Tibialis Anterior)',
    nameEn: 'Ankle Dorsiflexors',
    actionNameAr: 'عطف الكاحل للأعلى',
    actionNameEn: 'Ankle Dorsiflexion',
    applicableLateralities: ['right', 'left'],
  },
  {
    muscleGroupId: 'ankle_plantarflexors',
    nameAr: 'عاطفات الكاحل الأخمصية (Gastrocnemius & Soleus)',
    nameEn: 'Ankle Plantarflexors',
    actionNameAr: 'دفع مشط القدم للأسفل',
    actionNameEn: 'Ankle Plantarflexion',
    applicableLateralities: ['right', 'left'],
  },
];

// -----------------------------------------------------------------------
// 3. Pure Validation & Calculation Helpers
// -----------------------------------------------------------------------

/**
 * Validates the structure and scientific invariants of a RomAssessmentBatteryData object.
 * CLINICAL INVARIANT: If isTested === false, measuredAngleDegrees must be null AND reasonNotTested must be provided.
 * If isTested === true, measuredAngleDegrees must be a valid number between -45 and 360.
 */
export function validateRomBatteryData(battery?: RomAssessmentBatteryData): boolean {
  if (!battery) return true;
  if (battery.batteryVersion !== '1.0.0') return false;
  if (!Array.isArray(battery.entries)) return false;

  const validMovementTypes = Object.keys(ROM_MOVEMENT_TYPES);
  const validLateralities = Object.keys(BODY_LATERALITIES);
  const validReasons = Object.keys(CLINICAL_NON_TESTABLE_REASONS);

  for (const entry of battery.entries) {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.entryId !== 'string' || !entry.entryId.trim()) return false;
    if (typeof entry.jointId !== 'string' || !entry.jointId.trim()) return false;
    if (typeof entry.movementId !== 'string' || !entry.movementId.trim()) return false;
    if (!validMovementTypes.includes(entry.movementType)) return false;
    if (!validLateralities.includes(entry.laterality)) return false;

    // Strict Separation: isTested: false vs measured value
    if (entry.isTested === false) {
      if (entry.measuredAngleDegrees !== null) return false;
      if (!entry.reasonNotTested || !validReasons.includes(entry.reasonNotTested)) return false;
    } else if (entry.isTested === true) {
      if (typeof entry.measuredAngleDegrees !== 'number' || isNaN(entry.measuredAngleDegrees)) return false;
      if (entry.measuredAngleDegrees < -45 || entry.measuredAngleDegrees > 360) return false;
    } else {
      return false;
    }

    if (entry.painNrsScore !== undefined) {
      if (typeof entry.painNrsScore !== 'number' || isNaN(entry.painNrsScore) || entry.painNrsScore < 0 || entry.painNrsScore > 10) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates the structure and scientific invariants of a MmtAssessmentBatteryData object.
 * CLINICAL INVARIANT: If isTested === false, gradeValue must be null AND reasonNotTested must be provided.
 * If isTested === true, gradeValue must be a valid recognized MRC grade.
 */
export function validateMmtBatteryData(battery?: MmtAssessmentBatteryData): boolean {
  if (!battery) return true;
  if (battery.batteryVersion !== '1.0.0') return false;
  if (!Array.isArray(battery.entries)) return false;

  const validMrcGrades = Object.keys(MRC_GRADES_CATALOG);
  const validLateralities = Object.keys(BODY_LATERALITIES);
  const validReasons = Object.keys(CLINICAL_NON_TESTABLE_REASONS);

  for (const entry of battery.entries) {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.entryId !== 'string' || !entry.entryId.trim()) return false;
    if (typeof entry.muscleGroupId !== 'string' || !entry.muscleGroupId.trim()) return false;
    if (!validLateralities.includes(entry.laterality)) return false;
    if (entry.gravityCondition !== 'against_gravity' && entry.gravityCondition !== 'gravity_eliminated') return false;

    // Strict Separation: isTested: false vs measured grade
    if (entry.isTested === false) {
      if (entry.gradeValue !== null) return false;
      if (!entry.reasonNotTested || !validReasons.includes(entry.reasonNotTested)) return false;
    } else if (entry.isTested === true) {
      if (!entry.gradeValue || !validMrcGrades.includes(entry.gradeValue)) return false;
    } else {
      return false;
    }

    if (entry.painNrsScore !== undefined) {
      if (typeof entry.painNrsScore !== 'number' || isNaN(entry.painNrsScore) || entry.painNrsScore < 0 || entry.painNrsScore > 10) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculates Bilateral Symmetry Index (BSI %) and Deficit Degrees compared to uninvolved reference side.
 */
export function calculateBilateralSymmetry(
  involvedAngle: number | null,
  uninvolvedAngle?: number | null
): { deficitDegrees: number | null; symmetryIndexPercent: number | null } {
  if (involvedAngle === null || uninvolvedAngle === null || uninvolvedAngle === undefined || uninvolvedAngle <= 0) {
    return { deficitDegrees: null, symmetryIndexPercent: null };
  }

  const deficit = uninvolvedAngle - involvedAngle;
  const rawRatio = (involvedAngle / uninvolvedAngle) * 100;
  const symmetryIndex = Math.min(100, Math.max(0, Number(rawRatio.toFixed(1))));

  return {
    deficitDegrees: Number(deficit.toFixed(1)),
    symmetryIndexPercent: symmetryIndex,
  };
}

export interface LongitudinalRomComparisonResult {
  isComparable: boolean;
  deltaDegrees: number | null;
  reasonAr?: string;
  reasonEn?: string;
}

/**
 * Longitudinal Comparability Predicate:
 * CLINICAL SAFETY INVARIANT: Prohibits mixing AROM with PROM, ensures same joint, movement, and laterality,
 * and handles unexamined/non-testable states cleanly without false zero math.
 */
export function compareLongitudinalRomEntries(
  baseline: RomMeasurementEntry,
  current: RomMeasurementEntry
): LongitudinalRomComparisonResult {
  // 1. Joint & Movement Mismatch Check
  if (
    baseline.jointId !== current.jointId ||
    baseline.movementId !== current.movementId ||
    baseline.laterality !== current.laterality
  ) {
    return {
      isComparable: false,
      deltaDegrees: null,
      reasonAr: 'المفصل أو الحركة أو الجهة المفحوصة غير متطابقة.',
      reasonEn: 'Joint, movement or laterality mismatch.',
    };
  }

  // 2. Strict Movement Type Matching (AROM === AROM only; PROM === PROM only)
  if (baseline.movementType !== current.movementType) {
    return {
      isComparable: false,
      deltaDegrees: null,
      reasonAr: 'لا تجوز المقارنة المباشرة بين المدى الفاعل (AROM) والمدى المنفعل (PROM).',
      reasonEn: 'Cannot directly compare Active (AROM) and Passive (PROM) movements.',
    };
  }

  // 3. Not Tested Gap Check
  if (!baseline.isTested || !current.isTested || baseline.measuredAngleDegrees === null || current.measuredAngleDegrees === null) {
    return {
      isComparable: false,
      deltaDegrees: null,
      reasonAr: 'أحد القياسين غير مفحوص سريرياً (Not Tested).',
      reasonEn: 'One of the measurements was not clinically tested.',
    };
  }

  // 4. Valid Comparable Delta Calculation
  const delta = Number((current.measuredAngleDegrees - baseline.measuredAngleDegrees).toFixed(1));
  return {
    isComparable: true,
    deltaDegrees: delta,
  };
}
