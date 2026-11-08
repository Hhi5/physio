// =======================================================================
// PhysioRecord — Clinical Terminology Registry (v2.0)
// Standard International English reference paired with Arabic clarification
// =======================================================================

import type { ClinicalSpecialty, EpisodeStatus, OnsetMechanism } from '../types/clinical';

export interface TerminologyItem<T extends string = string> {
  code: T;
  en: string; // Standard International English
  ar: string; // Approved Arabic Explanatory Clarification
  descriptionAr?: string;
  badgeClass?: string;
}

export const CLINICAL_SPECIALTIES: Record<ClinicalSpecialty, TerminologyItem<ClinicalSpecialty>> = {
  musculoskeletal: {
    code: 'musculoskeletal',
    en: 'Musculoskeletal / Orthopedic',
    ar: 'العضلي الهيكلي وجراحة العظام',
    descriptionAr: 'إصابات المفاصل والعظام والأوتار والأربطة والعمود الفقري والتأهيل بعد الكسور والجراحات.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  neurological: {
    code: 'neurological',
    en: 'Neurological Rehabilitation',
    ar: 'التأهيل العصبي والسكتة الدماغية',
    descriptionAr: 'السكتات الدماغية، إصابات النخاع الشوكي، التصلب اللويحي، الشلل الرعاش، واعتلال الأعصاب.',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  cardiopulmonary: {
    code: 'cardiopulmonary',
    en: 'Cardiopulmonary Rehabilitation',
    ar: 'إعادة تأهيل القلب والجهاز التنفسي',
    descriptionAr: 'أمراض الشرايين التاجية، جراحات القلب المفتوح، مرض الانسداد الرئوي المزمن، وتأهيل ما بعد العناية المركزة.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  pediatric: {
    code: 'pediatric',
    en: 'Pediatric Physical Therapy',
    ar: 'العلاج الطبيعي للأطفال والنمو',
    descriptionAr: 'الشلل الدماغي، تأخر النمو الحركي، التشوهات القوامية الخلقية، وأمراض العضلات لدى الأطفال.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  sports: {
    code: 'sports',
    en: 'Sports Physical Therapy',
    ar: 'إصابات الملاعب والتأهيل الرياضي',
    descriptionAr: 'إصابات الرياضيين التنافسية، إعادة التأهيل المتقدم، واختبارات العودة الآمنة للملاعب (Return-to-Play).',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  general: {
    code: 'general',
    en: 'General Physical Therapy',
    ar: 'العلاج الطبيعي العام',
    descriptionAr: 'الحالات العامة غير التخصصية، التقييم الأولي الشامل، وتأهيل متلازمات الألم والجهد العضلي العام.',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  geriatric: {
    code: 'geriatric',
    en: 'Geriatric Physical Therapy',
    ar: 'العلاج الطبيعي لكبار السن (مجال سكاني)',
    descriptionAr: 'تأهيل الشيخوخة، هشاشة العظام، برامج التوازن والوقاية من السقوط، وتحسين الاستقلالية الحركية لكبار السن.',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

export const EPISODE_STATUSES: Record<EpisodeStatus, TerminologyItem<EpisodeStatus>> = {
  active: {
    code: 'active',
    en: 'Active Care',
    ar: 'خطة علاجية نشطة',
    descriptionAr: 'حلقة الرعاية جارية وتتلقى جلسات علاجية دورية.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  on_hold: {
    code: 'on_hold',
    en: 'On Hold / Paused',
    ar: 'معلقة مؤقتاً',
    descriptionAr: 'تم تعليق العلاج مؤقتاً لسفر أو عارض صحي أو انتظار مراجعة طبية.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  completed: {
    code: 'completed',
    en: 'Completed / Discharged',
    ar: 'مكتملة / تم التخريج',
    descriptionAr: 'تم إنهاء الخطة العلاجية وتحقيق الأهداف أو الوصول لأقصى تحسن سريري.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  archived: {
    code: 'archived',
    en: 'Archived',
    ar: 'مؤرشفة',
    descriptionAr: 'حلقة رعاية سابقة مؤرشفة ومحفوظة ضمن السجل التاريخي للمريض.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export const ONSET_MECHANISMS: Record<OnsetMechanism, TerminologyItem<OnsetMechanism>> = {
  traumatic: {
    code: 'traumatic',
    en: 'Traumatic / Acute Injury',
    ar: 'حادثة / إصابة رضية حادة',
    descriptionAr: 'سقوط، حادث مروري، أو إصابة مباشرة أثناء الرياضة.',
  },
  insidious: {
    code: 'insidious',
    en: 'Insidious Onset',
    ar: 'بداية تدريجية غير ملحوظة (غير واضحة)',
    descriptionAr: 'تطور تدريجي بطيء للأعراض دون حادثة واضحة أو رض صريح.',
  },
  post_surgical: {
    code: 'post_surgical',
    en: 'Post-Surgical',
    ar: 'بعد تدخل جراحي',
    descriptionAr: 'إحالة تأهيلية تالية لعملية جراحية كزراعة المفاصل أو تثبيت الكسور.',
  },
  congenital: {
    code: 'congenital',
    en: 'Congenital / Developmental',
    ar: 'خلقي / نمائي',
    descriptionAr: 'حالة موجودة منذ الولادة أو مرتبطة بمراحل النمو.',
  },
};

export const COMMON_BODY_REGIONS = [
  { en: 'Cervical Spine', ar: 'الفقرات العنقية' },
  { en: 'Thoracic Spine', ar: 'الفقرات الصدرية' },
  { en: 'Lumbar Spine & Sacroiliac', ar: 'الفقرات القطنية والعجزية' },
  { en: 'Shoulder Complex', ar: 'مجمع الكتف ولوح الكتف' },
  { en: 'Elbow & Forearm', ar: 'المرفق والساعد' },
  { en: 'Wrist & Hand', ar: 'الرسغ واليد' },
  { en: 'Pelvis & Hip Joint', ar: 'الحوض ومفصل الورك' },
  { en: 'Knee Complex', ar: 'مفصل الركبة والأربطة المحيطة' },
  { en: 'Ankle & Foot Complex', ar: 'الكاحل والقدم' },
  { en: 'Neurological / Cranial & Facial', ar: 'الأعصاب القحفية والوجه' },
  { en: 'Cardiopulmonary / Thorax', ar: 'القفص الصدري والجهاز التنفسي' },
  { en: 'Full Body / General Axial', ar: 'محوري / كامل الجسم' },
];
