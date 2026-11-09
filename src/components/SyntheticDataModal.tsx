// =======================================================================
// PhysioRecord — Synthetic Clinical Demonstration Data Modal
// Conforms to shadcn/ui visual standards & strict cryptographic invariants
// =======================================================================

import React, { useState } from 'react';
import { db } from '../db/db';
import { usePatients } from '../context/PatientContext';
import { useVault } from '../context/VaultContext';
import { useLanguage } from '../context/LanguageContext';
import { SYNTHETIC_PATIENTS } from '../data/syntheticPatients';
import { EpisodeService } from '../services/episodeService';
import { SessionService } from '../services/sessionService';
import { SoapService } from '../services/soapService';
import { computePatientAge } from '../utils/date';
import { X, Database, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import type {
  EpisodeClinicalData,
  SessionClinicalData,
  SoapNoteData,
} from '../types/clinical';

interface SyntheticDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyntheticDataModal: React.FC<SyntheticDataModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { patients, savePatient, refreshPatients } = usePatients();
  const { dek } = useVault();
  const { bi, isRtl } = useLanguage();
  const [seeding, setSeeding] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleSeedAll = async () => {
    setSeeding(true);
    setSuccessCount(null);
    try {
      let count = 0;
      for (let i = 0; i < SYNTHETIC_PATIENTS.length; i++) {
        const { id: fixedId, ...patientData } = SYNTHETIC_PATIENTS[i];
        if (!fixedId) {
          continue;
        }
        // Check both IndexedDB by fixed ID and in-memory decrypted patients by name
        const existingById = await db.patients.get(fixedId);
        const existingByName = patients.find(
          (p) =>
            p.id === fixedId ||
            p.data.fullNameAr === patientData.fullNameAr ||
            p.data.fullName === patientData.fullName
        );
        // Never overwrite an existing patient record
        if (existingById || existingByName) {
          continue;
        }
        const savedPatient = await savePatient(patientData, fixedId);
        count++;

        // For Patient 1 (Ahmed Al-Shammari - Knee ACL Rehab), seed Episode of Care + 2 Sessions + Full SOAP notes
        // Demonstrating Phase 2C Body Chart, ROM/MMT Batteries, and Longitudinal Progress Tracking
        if (i === 0 && dek) {
          try {
            const existingEpisodes = await EpisodeService.getEpisodesByPatient(savedPatient.id, dek);
            let episode = existingEpisodes.find((e) => e.status !== 'archived');

            if (!episode) {
              const episodeData: EpisodeClinicalData = {
                title: 'إعادة تأهيل الركبة اليمنى بعد ترميم الرباط الصليبي (Right ACL Rehab)',
                medicalDiagnosis: 'تمزق كامل بالرباط الصليبي الأمامي الأيمن بعد الجراحة التعويضية (ACL Reconstruction)',
                affectedBodyRegion: 'الركبة اليمنى',
                primarySpecialty: 'musculoskeletal',
                clinicalImpression: 'مرحلة التأهيل الحركي المبكر بعد الجراحة: عجز ثني وبسط وضعف رباعية الرؤوس',
                rehabilitationGoals: {
                  shortTerm: [
                    'استعادة عطف الركبة حتى 120 درجة',
                    'تحقيق الامتداد الكامل 0 درجة',
                    'تنشيط الرباعية دون عجز',
                  ],
                  longTerm: [
                    'العودة للمشي الطبيعي دون عرج',
                    'استعادة القوة العضلية والعودة للنشاط الرياضي',
                  ],
                },
              };

              episode = await EpisodeService.createEpisode(savedPatient.id, episodeData, dek);
            }

            const existingSessions = await SessionService.getSessionsByEpisode(episode.id, dek);
            if (existingSessions.length === 0) {
              // Session 1: Initial Evaluation
              const session1Data: Partial<SessionClinicalData> = {
                sessionDate: '2026-03-01',
                sessionTime: '09:00',
                sessionDurationMinutes: 60,
                therapistName: 'د. عبد الله الصالح',
                administrativeNotes: 'التقييم الأولي الشامل للركبة اليمنى، توثيق مخطط الجسم والشكاوى، وتسجيل قياسات ROM و MMT الأساسية.',
              };

              const session1 = await SessionService.createSession(
                savedPatient.id,
                episode.id,
                {
                  ...session1Data,
                  sessionType: 'initial_evaluation',
                  attendanceStatus: 'attended',
                },
                dek
              );

              const soap1Data: SoapNoteData = {
                subjective: {
                  chiefComplaint: 'ألم وتيبس وصعوبة ثني الركبة اليمنى بعد جراحة ترميم الرباط الصليبي.',
                  painNrsScore: 6,
                  bodyChart: {
                    chartVersion: '1.0.0',
                    markers: [
                      {
                        markerId: 'mk-knee-postop',
                        symptomType: 'pain_sharp',
                        view: 'anterior',
                        xPercent: 42.0,
                        yPercent: 72.0,
                        anatomicalRegionCode: 'knee_right',
                        anatomicalRegionLabelAr: 'الركبة اليمنى',
                        severityNrs: 6,
                        description: 'ألم حاد موضعي حول الشق الجراحي لمفصل الركبة',
                        createdAt: '2026-03-01T09:15:00.000Z',
                      },
                      {
                        markerId: 'mk-knee-stiff',
                        symptomType: 'stiffness',
                        view: 'posterior',
                        xPercent: 42.0,
                        yPercent: 72.0,
                        anatomicalRegionCode: 'knee_right',
                        anatomicalRegionLabelAr: 'الحفرة المأبضية خلف الركبة',
                        severityNrs: 7,
                        description: 'شعور بشد وتيبس ملحوظ خلف الركبة عند محاولة الثني',
                        createdAt: '2026-03-01T09:16:00.000Z',
                      },
                    ],
                    clinicianSummaryNotes: 'أعراض الألم والشد حول مفصل الركبة اليمنى مع تيبس خلفي ناجم عن أثر وثني أوتار الركبة.',
                    lastUpdatedAt: '2026-03-01T09:20:00.000Z',
                  },
                },
                objective: {
                  status: 'assessed',
                  clinicalObservations: 'مشية مع عرج خفيف واستخدام عكاز، انصباب خفيف حول الرضفة، التئام جيد للجرح.',
                  objectiveFindings: 'ألم بالجس حول خط المفصل الإنسي، نبض الشرايين الطرفية طبيعي.',
                  romBattery: {
                    batteryVersion: '1.0.0',
                    entries: [
                      {
                        entryId: 'rom-knee-flex-s1-arom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'flexion',
                        movementNameAr: 'ثني الركبة',
                        movementNameEn: 'Flexion',
                        movementType: 'AROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 90,
                        referenceUninvolvedAngleDegrees: 135,
                        endFeel: 'normal_soft_tissue_approximation',
                        painNrsScore: 5,
                        clinicalNotes: 'توقف الحركة بسبب شد وألم خلف الركبة',
                      },
                      {
                        entryId: 'rom-knee-flex-s1-prom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'flexion',
                        movementNameAr: 'ثني الركبة',
                        movementNameEn: 'Flexion',
                        movementType: 'PROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 100,
                        referenceUninvolvedAngleDegrees: 140,
                        endFeel: 'normal_capsular_firm',
                        painNrsScore: 6,
                      },
                      {
                        entryId: 'rom-knee-ext-s1-arom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'extension',
                        movementNameAr: 'بسط الركبة',
                        movementNameEn: 'Extension',
                        movementType: 'AROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 5,
                        referenceUninvolvedAngleDegrees: 0,
                        endFeel: 'normal_capsular_firm',
                        painNrsScore: 3,
                        clinicalNotes: 'عجز بسط بمقدار 5 درجات مقارنة بالطرف السليم.',
                      },
                    ],
                    updatedAt: '2026-03-01T09:40:00.000Z',
                  },
                  mmtBattery: {
                    batteryVersion: '1.0.0',
                    entries: [
                      {
                        entryId: 'mmt-knee-ext-s1',
                        muscleGroupId: 'knee_extensors',
                        muscleNameAr: 'باسطات الركبة (Quadriceps Femoris)',
                        muscleNameEn: 'Knee Extensors',
                        actionNameAr: 'بسط الركبة للأمام',
                        actionNameEn: 'Knee Extension',
                        laterality: 'right',
                        gravityCondition: 'against_gravity',
                        isTested: true,
                        gradeValue: '3+',
                        painNrsScore: 4,
                        substitutionObserved: false,
                        clinicalNotes: 'تثبيط انعكاسي طفيف في العضلة المتسعة الإنسية (VMO lag)',
                      },
                      {
                        entryId: 'mmt-knee-flex-s1',
                        muscleGroupId: 'knee_flexors',
                        muscleNameAr: 'عاطفات الركبة (Hamstrings)',
                        muscleNameEn: 'Knee Flexors',
                        actionNameAr: 'ثني مفصل الركبة',
                        actionNameEn: 'Knee Flexion',
                        laterality: 'right',
                        gravityCondition: 'against_gravity',
                        isTested: true,
                        gradeValue: '4-',
                        painNrsScore: 3,
                        substitutionObserved: false,
                      },
                    ],
                    updatedAt: '2026-03-01T09:45:00.000Z',
                  },
                  dailyInterventionsSummary: 'تحريك الرضفة، تمارين انقباض متساوي القياس، ثني منفعل، كمادات ثلجية لمدة 15 دقيقة.',
                },
                assessment: {
                  clinicalImpressionCurrent: 'عجز في مدى ثني وبسط الركبة اليمنى وضعف في العضلة الرباعية بعد جراحة ترميم الرباط الصليبي.',
                  progressStatus: 'improved',
                  patientTolerance: 'well_tolerated',
                },
                plan: {
                  nextSessionPlan: 'الاستمرار في برنامج زيادة المدى الحركي وتقوية العضلة الرباعية.',
                  homeInstructions: 'تمارين زحلق الكعب (Heel slides) والجليد 3 مرات يومياً.',
                },
              };

              await SoapService.createSoapNote(
                savedPatient.id,
                episode.id,
                session1.id,
                soap1Data,
                dek
              );

              // Finalize Session 1 to establish baseline evaluation
              await SessionService.finalizeSession(session1.id, 'د. عبد الله الصالح', dek);

              // Session 2: Follow-up Session (showing clear measurable longitudinal progress)
              const session2Data: Partial<SessionClinicalData> = {
                sessionDate: '2026-03-08',
                sessionTime: '10:00',
                sessionDurationMinutes: 45,
                therapistName: 'د. عبد الله الصالح',
                administrativeNotes: 'جلسة متابعة بعد أسبوع: تحسن ملحوظ في المدى الحركي وتراجع الألم واكتمال البسط.',
              };

              const session2 = await SessionService.createSession(
                savedPatient.id,
                episode.id,
                {
                  ...session2Data,
                  sessionType: 'follow_up',
                  attendanceStatus: 'attended',
                },
                dek
              );

              const soap2Data: SoapNoteData = {
                subjective: {
                  chiefComplaint: 'تحسن ملحوظ في ثني الركبة والمشي أصبح أكثر راحة وثباتاً.',
                  painNrsScore: 3,
                  symptomChangesSinceLastSession: 'انخفض الألم من 6/10 إلى 3/10، وتلاشى الشد الليلي.',
                },
                objective: {
                  status: 'assessed',
                  clinicalObservations: 'المشي دون عكازات مع نمط تناسقي أفضل وتلاشي العرج، انحسار التورم تماماً.',
                  romBattery: {
                    batteryVersion: '1.0.0',
                    entries: [
                      {
                        entryId: 'rom-knee-flex-s2-arom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'flexion',
                        movementNameAr: 'ثني الركبة',
                        movementNameEn: 'Flexion',
                        movementType: 'AROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 110, // Progress: +20°
                        referenceUninvolvedAngleDegrees: 135,
                        endFeel: 'normal_soft_tissue_approximation',
                        painNrsScore: 2,
                        clinicalNotes: 'تحسن كبير في المدى الفعال وسهولة الحركة',
                      },
                      {
                        entryId: 'rom-knee-flex-s2-prom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'flexion',
                        movementNameAr: 'ثني الركبة',
                        movementNameEn: 'Flexion',
                        movementType: 'PROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 118, // Progress: +18°
                        referenceUninvolvedAngleDegrees: 140,
                        endFeel: 'normal_soft_tissue_approximation',
                        painNrsScore: 3,
                      },
                      {
                        entryId: 'rom-knee-ext-s2-arom',
                        jointId: 'knee',
                        jointNameAr: 'مفصل الركبة',
                        jointNameEn: 'Knee',
                        movementId: 'extension',
                        movementNameAr: 'بسط الركبة',
                        movementNameEn: 'Extension',
                        movementType: 'AROM',
                        laterality: 'right',
                        isTested: true,
                        measuredAngleDegrees: 0, // Progress: +5° reaching full 0° extension!
                        referenceUninvolvedAngleDegrees: 0,
                        endFeel: 'normal_bone_to_bone',
                        painNrsScore: 1,
                        clinicalNotes: 'استعادة البسط الكامل 0 درجة بنجاح تام.',
                      },
                    ],
                    updatedAt: '2026-03-08T10:30:00.000Z',
                  },
                  mmtBattery: {
                    batteryVersion: '1.0.0',
                    entries: [
                      {
                        entryId: 'mmt-knee-ext-s2',
                        muscleGroupId: 'knee_extensors',
                        muscleNameAr: 'باسطات الركبة (Quadriceps Femoris)',
                        muscleNameEn: 'Knee Extensors',
                        actionNameAr: 'بسط الركبة للأمام',
                        actionNameEn: 'Knee Extension',
                        laterality: 'right',
                        gravityCondition: 'against_gravity',
                        isTested: true,
                        gradeValue: '4+', // Progress: improved from 3+ to 4+!
                        painNrsScore: 1,
                        substitutionObserved: false,
                        clinicalNotes: 'قوة ممتازة ضد مقاومة يدوية قوية دون أي تأخر في VMO',
                      },
                      {
                        entryId: 'mmt-knee-flex-s2',
                        muscleGroupId: 'knee_flexors',
                        muscleNameAr: 'عاطفات الركبة (Hamstrings)',
                        muscleNameEn: 'Knee Flexors',
                        actionNameAr: 'ثني مفصل الركبة',
                        actionNameEn: 'Knee Flexion',
                        laterality: 'right',
                        gravityCondition: 'against_gravity',
                        isTested: true,
                        gradeValue: '5', // Progress: improved from 4- to 5!
                        painNrsScore: 0,
                        substitutionObserved: false,
                      },
                    ],
                    updatedAt: '2026-03-08T10:35:00.000Z',
                  },
                  dailyInterventionsSummary: 'تمارين السلسلة المغلقة (Squats جزئي)، دراجة ثابتة بمقاومة خفيفة لمدة 10 دقائق، تقوية العضلة الرباعية.',
                },
                assessment: {
                  clinicalImpressionCurrent: 'تقدم سريري ممتاز في المدى الحركي والقوة العضلية مع اختفاء عجز البسط.',
                  progressStatus: 'improved',
                  patientTolerance: 'well_tolerated',
                },
                plan: {
                  nextSessionPlan: 'البدء في تمارين التوازن والمشي السريع والتوازن على لوحة التذبذب (Wobble board).',
                },
              };

              await SoapService.createSoapNote(
                savedPatient.id,
                episode.id,
                session2.id,
                soap2Data,
                dek
              );
            }
          } catch (clinicalSeedErr) {
            console.error('Failed to seed clinical episode/sessions for Ahmed Al-Shammari:', clinicalSeedErr);
          }
        }
      }
      await refreshPatients();
      setSuccessCount(count);
    } catch (err) {
      console.error('Failed to seed synthetic records:', err);
    } finally {
      setSeeding(false);
    }
  };

  if (!import.meta.env.DEV || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {bi('إدراج بيانات سريرية تجريبية', 'Insert Synthetic Clinical Demonstration Data')}
              </h2>
              <p className="text-xs text-slate-500">
                {bi(
                  'بيانات وهمية سريرية لاختبار وتجربة كافة ميزات النظام والمخططات الحركية',
                  'Clinical mock cases to test and verify all system features and kinetic progress'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>{bi('ضمان الخصوصية السريرية:', 'Clinical Privacy Guarantee:')}</strong>{' '}
              {bi(
                'هذه الحالات وهمية تماماً ومُصممة سريرياً لمحاكاة سيناريوهات التأهيل المختلفة (عظام، أعصاب، قلب، أطفال، إصابات رياضية) لغايات التدقيق والاختبار.',
                'These cases are synthetic and clinically structured to simulate rehab pathways (orthopedics, neuro, cardiac, pediatrics, sports).'
              )}
            </span>
          </div>

          <h3 className="text-xs font-bold text-slate-700">
            {bi(
              `الحالات السريرية الجاهزة للإدراج (${SYNTHETIC_PATIENTS.length} حالات):`,
              `Clinical Cases Ready for Seeding (${SYNTHETIC_PATIENTS.length} cases):`
            )}
          </h3>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {SYNTHETIC_PATIENTS.map((p, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                  <span>{isRtl ? p.fullNameAr : p.fullName}</span>
                  <span className="text-teal-700 font-normal">
                    {p.gender === 'male' ? bi('ذكر', 'Male') : bi('أنثى', 'Female')}، {computePatientAge(p.dateOfBirth, p.age)} {bi('سنة', 'yo')}
                  </span>
                </div>
                <p className="text-slate-500 line-clamp-1">{p.medicalHistory}</p>
              </div>
            ))}
          </div>

          {successCount !== null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                {bi(
                  `تم إدراج ${successCount} مرضى بنجاح، وتجهيز جلسات تأهيل الرباط الصليبي وسجلات التقدم الحركي.`,
                  `Successfully seeded ${successCount} patients with ACL rehabilitation progress sessions.`
                )}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            {bi('إغلاق', 'Close')}
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedAll}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
          >
            {seeding ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {bi('جارٍ التشفير والإدراج...', 'Encrypting & Seeding...')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                {bi('إدراج كافة الحالات السريرية الخمس', 'Seed All 5 Clinical Cases')}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
