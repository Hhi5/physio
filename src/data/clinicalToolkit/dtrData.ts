// =======================================================================
// PhysioRecord — Deep Tendon Reflexes (DTR) Reference Dataset (Phase 2C)
// Sources: NINDS Guidelines, Bickley's Bates' Guide to Physical Examination,
// DeJong's Neurologic Examination (8th Ed), Campbell WW (2013)
// =======================================================================

import type { DtrDefinition, DtrGradeDefinition } from '../../types/clinicalToolkit';

export const DTR_ASYMMETRY_RULE_EN =
  'Bilateral side-to-side asymmetry (e.g., 1+ on the involved side vs. 2+ on the uninvolved side) is far more diagnostically significant than symmetric hyporeflexia or briskness, which can represent normal physiological variation. True asymmetry strongly points to focal radiculopathy or peripheral nerve injury.';

export const DTR_ASYMMETRY_RULE_AR =
  'يُعد عدم التناظر بين الجانبين الأيمن والأيسر (Asymmetry) العلامة السريرية الأهم في فحص المنعكسات؛ إذ إن وجود فارق بين الطرفين (مثل 1+ في الطرف المصاب مقابل 2+ في الطرف السليم) يرجح بقوة وجود اعتلال جذري أو عصبي موضعي، بينما الخمول المتناظر أو النشاط المتناظر في كلا الطرفين قد يكون تبايناً فسيولوجياً طبيعياً لدى الفرد.';

export const JENDRASSIK_MANEUVER_NOTE_EN =
  'Jendrassik Maneuver: A reinforcement technique where the patient interlocks flexed fingers and pulls apart forcefully during lower extremity reflex testing (or clenches teeth/fists during upper extremity testing). It facilitates spinal alpha motor neuron pool excitability by reducing presynaptic inhibition. A reflex must NEVER be documented as absent (Grade 0) until reinforcement has been systematically attempted.';

export const JENDRASSIK_MANEUVER_NOTE_AR =
  'مناورة جيندراسيك (Jendrassik Maneuver): مناورة تعزيز إرادية يقوم فيها المريض بتشبيك أصابع يديه وشدهما بقوة للخارج أثناء فحص منعكسات الطرف السفلي (أو إطباق الأسنان بقوة عند فحص الطرف العلوي). تزيد هذه المناورة من استثارة العصبونات الحركية الشوكية عبر تقليل التثبيط قبل المشبكي. لا يجوز طبياً توثيق المنعكس بأنه غائب (الدرجة 0) إلا بعد تطبيق مناورة التعزيز وفشلها.';

export const DTR_DEFINITIONS: DtrDefinition[] = [
  {
    reflexId: 'biceps',
    nameEn: 'Biceps Reflex',
    nameAr: 'منعكس ذات الرأسين العضدية',
    primaryRoot: 'C5',
    contributingRoots: ['C5', 'C6'],
    peripheralNerveEn: 'Musculocutaneous Nerve',
    peripheralNerveAr: 'العصب الجلدي العضلي',
    tappingSiteEn: 'Biceps brachii tendon in the antecubital fossa (examiner places thumb firmly on tendon and strikes thumb)',
    tappingSiteAr: 'وتر العضلة ذات الرأسين في ثنية المرفق (يضع الفاحص إبهامه بثبات فوق الوتر ويقرع على ظفر إبهامه بالشاكوش)',
    normalResponseEn: 'Prompt visible and palpable contraction of the biceps muscle with brief flexion of the elbow',
    normalResponseAr: 'انقباض سريع مرئي ومحسوس للعضلة ذات الرأسين مع ثني فاعل خاطف لمفصل المرفق',
    reinforcementTechniqueEn: 'Clenching teeth firmly or squeezing contralateral fist while relaxing the tested arm',
    reinforcementTechniqueAr: 'إطباق الأسنان بقوة أو ضغط قبضة اليد المقابلة مع استرخاء الذراع المفحوصة',
    clinicalSignificanceAr: 'ضعفه أو غيابه يدل على اعتلال جذر C5 أو C6 أو إصابة العصب الجلدي العضلي. اشتداده مع انتشاره يشير لآفة عصبية عليا (UMN).'
  },
  {
    reflexId: 'brachioradialis',
    nameEn: 'Brachioradialis Reflex (Supinator Reflex)',
    nameAr: 'منعكس العضدية الكعبرية (منعكس الكب)',
    primaryRoot: 'C6',
    contributingRoots: ['C5', 'C6'],
    peripheralNerveEn: 'Radial Nerve',
    peripheralNerveAr: 'العصب الكعبري',
    tappingSiteEn: 'Styloid process of the radius, approximately 2–3 cm proximal to the wrist with forearm in neutral mid-pronation',
    tappingSiteAr: 'فوق الناتئ الإبري لعظم الكعبرة بمسافة 2-3 سم أعلى الرسغ مع وضع الساعد في وضع نصف كب مسترخٍ',
    normalResponseEn: 'Elbow flexion accompanied by slight forearm pronation and radial deviation of the hand',
    normalResponseAr: 'ثني مفصل المرفق مع كب خفيف للساعد وانحراف كعبري خفيف لليد',
    reinforcementTechniqueEn: 'Clenching teeth or squeezing eyes shut during the strike',
    reinforcementTechniqueAr: 'إطباق الأسنان بقوة أثناء نقر الشاكوش',
    clinicalSignificanceAr: 'المنعكس الأساسي المعتمد لجذر C6. ظاهرة المنعكس المعكوس (Inverted Reflex) بعطف أصابع اليد دون ثني المرفق علامة كلاسيكية على اعتلال النخاع الشوكي الرقبي (Cervical Spondylotic Myelopathy).'
  },
  {
    reflexId: 'triceps',
    nameEn: 'Triceps Reflex',
    nameAr: 'منعكس ثلاثية الرؤوس العضدية',
    primaryRoot: 'C7',
    contributingRoots: ['C7', 'C8'],
    peripheralNerveEn: 'Radial Nerve',
    peripheralNerveAr: 'العصب الكعبري',
    tappingSiteEn: 'Triceps tendon directly above the olecranon process with arm supported at 90° abduction and flexion',
    tappingSiteAr: 'وتر العضلة ثلاثية الرؤوس مباشرة فوق ناتئ الزج مع إسناد ذراع المريض في وضع تبعيد وثني 90 درجة باسترخاء',
    normalResponseEn: 'Brisk contraction of the triceps muscle with visible extension of the elbow',
    normalResponseAr: 'انقباض سريع لثلاثية الرؤوس مع بسط لمفصل المرفق نحو الأمام',
    reinforcementTechniqueEn: 'Hooking fingers of other hand or clenching jaw firmly',
    reinforcementTechniqueAr: 'تشبيك أصابع اليد الأخرى أو إطباق الفك بقوة',
    clinicalSignificanceAr: 'المنعكس الأكثر تأثراً بالانزلاقات الغضروفية الرقبية C6-C7. غيابه منفرداً يُعد دليلاً موضوعياً قوياً على اعتلال جذر C7.'
  },
  {
    reflexId: 'patellar',
    nameEn: 'Patellar Reflex (Knee Jerk)',
    nameAr: 'منعكس الرضفة (نفضة الركبة)',
    primaryRoot: 'L4',
    contributingRoots: ['L3', 'L4'],
    peripheralNerveEn: 'Femoral Nerve',
    peripheralNerveAr: 'العصب الفخذي',
    tappingSiteEn: 'Patellar tendon midway between the inferior pole of the patella and the tibial tuberosity with knee hanging freely at 90°',
    tappingSiteAr: 'وتر الرضفة في منتصف المسافة بين القطب السفلي للصابونة وأحدوبة الظنبوب والساق متدلية باسترخاء 90 درجة',
    normalResponseEn: 'Brisk contraction of the quadriceps femoris muscle with extension of the knee joint',
    normalResponseAr: 'انقباض خاطف وحاسم للعضلة رباعية الرؤوس مع بسط مفصل الركبة للأمام',
    reinforcementTechniqueEn: 'Standard Jendrassik Maneuver: interlocking curved fingers across chest and pulling apart forcefully at moment of strike',
    reinforcementTechniqueAr: 'مناورة جيندراسيك الكلاسيكية: تشبيك أصابع اليدين أمام الصدر وشدهما بقوة للخارج عند نقر الوتر بالشاكوش',
    clinicalSignificanceAr: 'المنعكس الأساسي لجذر L4 والعصب الفخذي. غيابه أو خموله يترافق مع ضعف عضلات الفخذ وصعوبة نزول السلالم وخيانة الركبة (Giving Way).'
  },
  {
    reflexId: 'achilles',
    nameEn: 'Achilles Reflex (Ankle Jerk)',
    nameAr: 'منعكس العرقوب (وتر أخيل)',
    primaryRoot: 'S1',
    contributingRoots: ['S1', 'S2'],
    peripheralNerveEn: 'Tibial Nerve',
    peripheralNerveAr: 'العصب الظنبوبي',
    tappingSiteEn: 'Achilles tendon directly above calcaneal insertion while maintaining passive dorsiflexion of the ankle',
    tappingSiteAr: 'وتر أخيل مباشرة فوق مغرزه في عظم العقب مع وضع كاحل المريض في عطف ظهري خفيف باليد الأخرى لشد الوتر',
    normalResponseEn: 'Decisive contraction of gastrocnemius-soleus complex with plantarflexion of the foot',
    normalResponseAr: 'انقباض حاسم لعضلات الساق الخلفية مع عطف أخمصي سريع للقدم نحو الأسفل',
    reinforcementTechniqueEn: 'Jendrassik Maneuver or clenching hands while kneeling on chair',
    reinforcementTechniqueAr: 'مناورة جيندراسيك أو الجثو على ركبتيه على الكرسي مع تدلي القدمين لتسهيل الاسترخاء التام',
    clinicalSignificanceAr: 'المنعكس الحاسم لانزلاق L5-S1 واعتلال جذر S1. غيابه علامة رئيسية مميزة لأذية الجذر العجزي أو اعتلال الأعصاب المحيطية المتعدد (Peripheral Neuropathy).'
  }
];

export const NINDS_REFLEX_GRADES: DtrGradeDefinition[] = [
  {
    grade: '0',
    labelEn: 'Grade 0 — Absent / No Response',
    labelAr: 'الدرجة 0 — غائب تماماً (لا استجابة)',
    clinicalInterpretationEn: 'No muscular contraction seen or felt, even after reinforcement (Jendrassik maneuver). Pathological hyporeflexia.',
    clinicalInterpretationAr: 'غياب تام لأي انقباض عضلي مرئي أو محسوس حتى مع مناورة جيندراسيك. خمول مرضي يشير لآفة عصبية سفلية (LMN).',
    isPhysiological: false
  },
  {
    grade: '1+',
    labelEn: 'Grade 1+ — Hypoactive / Diminished',
    labelAr: 'الدرجة 1+ — خامل أو كليل (استجابة طفيفة)',
    clinicalInterpretationEn: 'Sluggish or diminished response; muscular contraction only elicited or significantly augmented with reinforcement. May be physiological or mild early radiculopathy.',
    clinicalInterpretationAr: 'استجابة بطيئة أو ضعيفة؛ انقباض لا يظهر بوضوح إلا مع مناورة التعزيز. قد يكون تبايناً فسيولوجياً إذا كان متناظراً في الطرفين.',
    isPhysiological: true
  },
  {
    grade: '2+',
    labelEn: 'Grade 2+ — Normal / Active Physiological',
    labelAr: 'الدرجة 2+ — طبيعي فسيولوجي (استجابة معتادة)',
    clinicalInterpretationEn: 'Standard physiological response with brisk, visible muscle contraction and definite joint motion without spread.',
    clinicalInterpretationAr: 'الاستجابة الفسيولوجية المعيارية مع انقباض مرئي واضح وحركة مفصلية محددة دون انتشار للقطع المجاورة.',
    isPhysiological: true
  },
  {
    grade: '3+',
    labelEn: 'Grade 3+ — Hyperactive / Brisk with Spread',
    labelAr: 'الدرجة 3+ — نشط بزيادة مع اتساع منطقة المنعكس',
    clinicalInterpretationEn: 'More brisk than average; transient spread to adjacent muscle groups without clonus. May be physiological tension or mild upper motor neuron finding.',
    clinicalInterpretationAr: 'استجابة سريعة ونشطة تفوق المعتاد مع اتساع خفيف للمنعكس نحو العضلات المجاورة دون ارتعاش عضلي متواصل. قد تعكس قلقاً أو آفة UMN مبكرة.',
    isPhysiological: true
  },
  {
    grade: '4+',
    labelEn: 'Grade 4+ — Markedly Hyperactive with Clonus',
    labelAr: 'الدرجة 4+ — مفرط مصحوب بارتعاش عضلي (Clonus)',
    clinicalInterpretationEn: 'Hyperactive response with transient (>= 3-4 beats) or sustained clonus. Strongly indicative of Upper Motor Neuron (UMN) corticospinal pathway lesion.',
    clinicalInterpretationAr: 'استجابة مفرطة مصحوبة بارتعاش عضلي ارتجافي (Clonus مستمر أو متكرر لأكثر من 3-4 نبضات). دلالة قاطعة على آفة في السبيل القشري الشوكي (UMN).',
    isPhysiological: false
  }
];

export function getDtrById(id: string): DtrDefinition | undefined {
  return DTR_DEFINITIONS.find(d => d.reflexId === id);
}
