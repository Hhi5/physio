// =======================================================================
// PhysioRecord — Myotomes Clinical Reference Dataset (Phase 2C)
// Sources: ASIA / ISNCSCI Standards, Kendall's Muscles (5th Ed),
// Magee Orthopedic Physical Assessment (7th Ed), DeJong's Neurologic Exam
// =======================================================================

import type { MyotomeDefinition, SpinalLevel } from '../../types/clinicalToolkit';

export const MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_EN =
  'Almost all skeletal muscles receive multisegmental innervation from two or more spinal roots through nerve plexuses. Consequently, a single-root radiculopathy typically causes paresis (partial weakness) rather than complete paralysis of a muscle group. Testing multiple muscles innervated by the same root (via different peripheral nerves) is the cornerstone for differentiating radiculopathy from peripheral nerve entrapment.';

export const MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_AR =
  'تتلقى معظم العضلات الهيكلية تعصيباً مشتركاً متعدد المستويات من جذرين شوكيين أو أكثر عبر الضفائر العصبية. لذلك، فإن اعتلال الجذر المنفرد (Radiculopathy) يؤدي عادةً إلى ضعف جزئي (Paresis) في العضلة وليس شللاً كاملاً. يُعد فحص عدة عضلات يشترك في تغذيتها نفس الجذر العصبي عبر أعصاب محيطية مختلفة هو الأساس السريري للتفريق بين اعتلال الجذر وانضغاط العصب المحيطي.';

export const MYOTOME_DEFINITIONS: MyotomeDefinition[] = [
  // --- CERVICAL & UPPER EXTREMITY MYOTOMES (C1 - T1) ---
  {
    rootLevel: 'C1',
    regionGroup: 'cervical',
    predominantMovementEn: 'Cervical flexion and upper neck nodding',
    predominantMovementAr: 'ثني الرقبة العلوي وإيماءة الرأس للأمام',
    keyMuscles: [
      {
        nameEn: 'Longus capitis and Rectus capitis anterior',
        nameAr: 'العضلة الرأسية الطويلة والعضلة المستقيمة الرأسية الأمامية',
        peripheralNerveEn: 'Cervical ventral rami (C1-C2)',
        peripheralNerveAr: 'الفروع الأمامية للأعصاب الرقبية (C1-C2)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Supine; patient tucks chin and flexes craniocervical junction against gentle resistance on forehead.',
    testingPositionAr: 'استلقاء على الظهر؛ يطلب من المريض ضم الذقن للداخل وثني أعلى الرقبة ضد مقاومة خفيفة على الجبهة.',
    differentialClinicalNotesEn: 'Pure C1 weakness is rare; evaluated in atlanto-occipital instability or upper cervical trauma.',
    differentialClinicalNotesAr: 'ضعف C1 المنعزل نادر جداً؛ يُقيّم في حالات عدم ثبات المفصل الفهقي القذالي وإصابات أعلى الرقبة.',
    primarySourceCitation: "Magee DJ. Orthopedic Physical Assessment; DeJong's Neurologic Examination."
  },
  {
    rootLevel: 'C2',
    regionGroup: 'cervical',
    predominantMovementEn: 'Cervical extension and upper cervical stabilization',
    predominantMovementAr: 'بسط الرقبة للخلف وتثبيت العمود الفقري الرقبي العلوي',
    keyMuscles: [
      {
        nameEn: 'Suboccipital muscles and Longus colli',
        nameAr: 'عضلات تحت القذال والعضلة العنقية الطويلة',
        peripheralNerveEn: 'Suboccipital nerve and cervical plexus (C1-C2)',
        peripheralNerveAr: 'العصب تحت القذالي والضفيرة الرقبية (C1-C2)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Prone or seated; patient extends upper cervical spine against manual resistance on the occiput.',
    testingPositionAr: 'جلوس أو استلقاء بطني؛ يدفع المريض رأسه للخلف ضد مقاومة يد الفاحص على مؤخرة الرأس.',
    differentialClinicalNotesEn: 'Associated with severe occipital headaches or subluxation in rheumatoid arthritis.',
    differentialClinicalNotesAr: 'يرتبط بالصداع القذالي الشديد وانخلاع المفصل الفهقي المحوري لدى مرضى الروماتويد.',
    primarySourceCitation: 'Kendall FP. Muscles: Testing and Function.'
  },
  {
    rootLevel: 'C3',
    regionGroup: 'cervical',
    predominantMovementEn: 'Lateral cervical flexion',
    predominantMovementAr: 'العطف (الإمالة) الجانبي للرقبة',
    keyMuscles: [
      {
        nameEn: 'Scalenus anterior, medius, and posterior',
        nameAr: 'العضلات الأخمعية (الأمامية، الوسطى، والخلفية)',
        peripheralNerveEn: 'Cervical plexus branches (C3-C4)',
        peripheralNerveAr: 'فروع الضفيرة الرقبية (C3-C4)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Sternocleidomastoid (accessory)',
        nameAr: 'العضلة القصية الترقوية الحلمية (مساعدة)',
        peripheralNerveEn: 'Spinal accessory nerve (CN XI) & C2-C3',
        peripheralNerveAr: 'العصب الشوكي الإضافي (CN XI) وجذور C2-C3',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Seated upright; patient tilts ear toward shoulder against resistance applied to lateral temporal bone.',
    testingPositionAr: 'جلوس مستقيم؛ يميل المريض أذنه نحو الكتف ضد مقاومة يد الفاحص على جانب الرأس فوق الأذن.',
    differentialClinicalNotesEn: 'Main root contributor to the phrenic nerve (C3, C4, C5 keep the diaphragm alive).',
    differentialClinicalNotesAr: 'المساهم الرئيسي في العصب الحجابي (Phrenic Nerve) المسؤول عن تنفس الحجاب الحاجز.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Magee DJ.'
  },
  {
    rootLevel: 'C4',
    regionGroup: 'cervical',
    predominantMovementEn: 'Shoulder elevation (shrug)',
    predominantMovementAr: 'رفع الكتفين للأعلى (حركة رفع الكتف Shrug)',
    keyMuscles: [
      {
        nameEn: 'Upper Trapezius',
        nameAr: 'العضلة شبه المنحرفة العلوية',
        peripheralNerveEn: 'Spinal accessory nerve (CN XI) with sensory C3-C4 rami',
        peripheralNerveAr: 'العصب الشوكي الإضافي (CN XI) مع ألياف C3-C4',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Levator scapulae',
        nameAr: 'العضلة رافعة لوح الكتف',
        peripheralNerveEn: 'Dorsal scapular nerve (C3-C5)',
        peripheralNerveAr: 'العصب الكتفي الظهراني (C3-C5)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Seated upright; patient shrugs both shoulders upward toward ears while examiner pushes down firmly.',
    testingPositionAr: 'جلوس مستقيم؛ يرفع المريض كتفيه نحو أذنيه بقوة بينما يدفع الفاحص الكتفين للأسفل بكلتا يديه.',
    differentialClinicalNotesEn: 'Differentiated from isolated CN XI palsy by presence of cervical radicular pain and sensory C4 patch.',
    differentialClinicalNotesAr: 'يُفرق عن شلل العصب القحفي الحادي عشر (CN XI) بوجود ألم رقبي جذري مترافق ونقص حس فوق الكتف.',
    primarySourceCitation: 'Kendall FP. Muscles: Testing and Function.'
  },
  {
    rootLevel: 'C5',
    regionGroup: 'cervical',
    predominantMovementEn: 'Shoulder abduction and elbow flexion',
    predominantMovementAr: 'تبعيد الكتف وثني مفصل المرفق',
    keyMuscles: [
      {
        nameEn: 'Deltoid (middle fibers)',
        nameAr: 'العضلة الدالية (الألياف الوسطى)',
        peripheralNerveEn: 'Axillary nerve (C5-C6)',
        peripheralNerveAr: 'العصب الإبطي (C5-C6)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Biceps brachii',
        nameAr: 'العضلة ذات الرأسين العضدية',
        peripheralNerveEn: 'Musculocutaneous nerve (C5-C6)',
        peripheralNerveAr: 'العصب الجلدي العضلي (C5-C6)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Seated; shoulder abducted to 90° in scapular plane with elbow flexed; examiner applies downward force to elbow.',
    testingPositionAr: 'جلوس؛ يبعّد المريض كتفه 90 درجة في مستوى اللوح ويثني المرفق؛ يدفع الفاحص المرفق للأسفل ضد مقاومة المريض.',
    differentialClinicalNotesEn: 'Crucial differential: Isolated axillary nerve palsy weakens Deltoid while sparing Biceps and C5/C6 reflex. C5 radiculopathy weakens both and depresses Biceps reflex.',
    differentialClinicalNotesAr: 'التفريق السريري الذهبي: أذية العصب الإبطي المنفردة تضعف الدالية فقط وتبقي ذات الرأسين ومنعكس Biceps سليمين. بينما اعتلال جذر C5 يضعف العضلتين ويخمد منعكس Biceps.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Wainner RS et al. Spine (2003).'
  },
  {
    rootLevel: 'C6',
    regionGroup: 'cervical',
    predominantMovementEn: 'Wrist extension and elbow flexion',
    predominantMovementAr: 'بسط مفصل الرسغ وثني المرفق في وضع نصف كب',
    keyMuscles: [
      {
        nameEn: 'Extensor carpi radialis longus and brevis (ECRL / ECRB)',
        nameAr: 'باسطة الرسغ الكعبرية الطويلة والقصيرة',
        peripheralNerveEn: 'Radial nerve (C6-C7)',
        peripheralNerveAr: 'العصب الكعبري (C6-C7)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Brachioradialis',
        nameAr: 'العضلة العضدية الكعبرية',
        peripheralNerveEn: 'Radial nerve (C5-C6)',
        peripheralNerveAr: 'العصب الكعبري (C5-C6)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Forearm in pronation/neutral; patient extends wrist with deviation toward radial side against resistance.',
    testingPositionAr: 'الساعد في وضع محايد أو كب جزئي؛ يثني المريض الرسغ للأعلى والجهة الكعبرية ضد مقاومة قبضة الفاحص.',
    differentialClinicalNotesEn: 'Wrist extension is the primary ASIA motor key test for C6. Corresponds to Brachioradialis reflex depression.',
    differentialClinicalNotesAr: 'بسط الرسغ هو الاختبار الحركي الأساسي المعتمد دولياً لجذر C6 في معايير ASIA. يترافق مع تراجع منعكس العضدية الكعبرية.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Kendall FP.'
  },
  {
    rootLevel: 'C7',
    regionGroup: 'cervical',
    predominantMovementEn: 'Elbow extension and wrist flexion',
    predominantMovementAr: 'بسط مفصل المرفق وثني مفصل الرسغ',
    keyMuscles: [
      {
        nameEn: 'Triceps brachii',
        nameAr: 'العضلة ثلاثية الرؤوس العضدية',
        peripheralNerveEn: 'Radial nerve (C6-C8)',
        peripheralNerveAr: 'العصب الكعبري (C6-C8)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Flexor carpi radialis (FCR)',
        nameAr: 'قابضة الرسغ الكعبرية',
        peripheralNerveEn: 'Median nerve (C6-C7)',
        peripheralNerveAr: 'العصب الناصف (C6-C7)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Shoulder abducted to 90°, elbow flexed to 45°; patient extends forearm against examiner resistance applied at wrist.',
    testingPositionAr: 'الكتف مبعّد 90 درجة والمرفق مثني 45 درجة؛ يمد المريض ساعده للأمام ضد دفع الفاحص للرسغ نحو الخلف.',
    differentialClinicalNotesEn: 'C7 is the single most commonly injured cervical root. Accompanied by diminished Triceps reflex and middle finger paresthesia.',
    differentialClinicalNotesAr: 'الجذر الأكثر إصابة بين جذور الرقبة (أكثر من 60% من حالات الانزلاق الرقبي). يرافقه ضعف منعكس Triceps وخدر الإصبع الأوسط.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Wainner RS et al. (2003).'
  },
  {
    rootLevel: 'C8',
    regionGroup: 'cervical',
    predominantMovementEn: 'Finger flexion (distal phalanx) and thumb extension',
    predominantMovementAr: 'ثني السلاميات البعيدة للأصابع وبسط إبهام اليد',
    keyMuscles: [
      {
        nameEn: 'Flexor digitorum profundus (middle finger tip flexion)',
        nameAr: 'قابضة الأصابع العميقة (ثني السلامى البعيدة للإصبع الأوسط)',
        peripheralNerveEn: 'Median (anterior interosseous) and Ulnar nerves (C8-T1)',
        peripheralNerveAr: 'العصب الناصف (بين العظام الأمامي) والعصب الزندي (C8-T1)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Extensor pollicis longus (EPL)',
        nameAr: 'باسطة الإبهام الطويلة',
        peripheralNerveEn: 'Posterior interosseous nerve (C7-C8)',
        peripheralNerveAr: 'العصب بين العظام الخلفي (C7-C8)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Forearm supinated on table; examiner stabilizes proximal phalanges while patient flexes distal interphalangeal (DIP) joint of middle finger.',
    testingPositionAr: 'الساعد مستند على الطاولة؛ يثبت الفاحص السلاميات الوسطى بينما يثني المريض عقلة الإصبع الأوسط الأخيرة ضد المقاومة.',
    differentialClinicalNotesEn: 'Differentiate from ulnar nerve entrapment at elbow (cubital tunnel): C8 lesion impairs median-innervated flexor pollicis longus as well.',
    differentialClinicalNotesAr: 'يُفرق عن انضغاط العصب الزندي في نفق المرفق: أذية جذر C8 تضعف أيضاً العضلات المغذاة بالعصب الناصف كقابضة الإبهام الطويلة.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards.'
  },
  {
    rootLevel: 'T1',
    regionGroup: 'thoracic',
    predominantMovementEn: 'Finger abduction (little finger abduction)',
    predominantMovementAr: 'تبعيد الأصابع (تبعيد إصبع الخنصر الصغير)',
    keyMuscles: [
      {
        nameEn: 'Abductor digiti minimi (ADM) and First dorsal interosseous (FDI)',
        nameAr: 'مبعدة الخنصر والعضلة بين العظام الظهرانية الأولى',
        peripheralNerveEn: 'Deep branch of ulnar nerve (C8-T1)',
        peripheralNerveAr: 'الفرع العميق للعصب الزندي (C8-T1)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Hand flat on table; patient spreads fingers apart against examiner trying to push little finger toward ring finger.',
    testingPositionAr: 'اليد ممدودة منبسطة؛ يباعد المريض أصابعه بقوة بينما يحاول الفاحص ضم إصبع الخنصر نحو البنصر.',
    differentialClinicalNotesEn: 'T1 roots run close to apical lung pleura. Pancoast tumor can compress T1 causing severe medial hand atrophy and Horner syndrome.',
    differentialClinicalNotesAr: 'يمر جذر T1 قرب قمة الرئة. أورام قمة الرئة (Pancoast Tumor) تضغط T1 مسببة ضمور عضلات اليد ومتلازمة هورنر.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Kendall FP.'
  },

  // --- LUMBAR & SACRAL MYOTOMES (L1 - S2) ---
  {
    rootLevel: 'L1',
    regionGroup: 'lumbar',
    predominantMovementEn: 'Hip flexion (initial swing contribution)',
    predominantMovementAr: 'ثني مفصل الورك (المساهمة الأولى في رفع الفخذ)',
    keyMuscles: [
      {
        nameEn: 'Iliopsoas (upper fibers)',
        nameAr: 'العضلة الحرقفية القطنية (الألياف العلوية)',
        peripheralNerveEn: 'Lumbar plexus branches & Femoral nerve (L1-L3)',
        peripheralNerveAr: 'فروع الضفيرة القطنية والعصب الفخذي (L1-L3)',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Seated; patient raises knee slightly off table against resistance on anterior distal thigh.',
    testingPositionAr: 'جلوس؛ يرفع المريض ركبته للأعلى قليلاً ضد ضغط الفاحص على أسفل الفخذ.',
    differentialClinicalNotesEn: 'L1 motor testing overlaps with L2. Weakness indicates high lumbar plexus or upper lumbar radiculopathy.',
    differentialClinicalNotesAr: 'يتداخل فحص L1 مع L2. ضعفه يعكس آفة في أعلى الضفيرة القطنية.',
    primarySourceCitation: "Magee DJ; DeJong's Neurologic Examination."
  },
  {
    rootLevel: 'L2',
    regionGroup: 'lumbar',
    predominantMovementEn: 'Hip flexion',
    predominantMovementAr: 'ثني مفصل الورك (رفع الفخذ للأعلى)',
    keyMuscles: [
      {
        nameEn: 'Iliopsoas (Psoas major and Iliacus)',
        nameAr: 'العضلة الحرقفية القطنية (القطنية الكبرى والحرقفية)',
        peripheralNerveEn: 'Femoral nerve (L2-L4)',
        peripheralNerveAr: 'العصب الفخذي (L2-L4)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Pectineus and Sartorius',
        nameAr: 'العضلة العانية والخياطية',
        peripheralNerveEn: 'Femoral nerve (L2-L3)',
        peripheralNerveAr: 'العصب الفخذي (L2-L3)',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Seated; hips and knees flexed to 90°; patient flexes hip upward against downward force applied to distal thigh.',
    testingPositionAr: 'جلوس مستقيم مع ثني الوركين والركبتين 90 درجة؛ يرفع المريض فخذه للأعلى ضد ضغط الفاحص القوي للأسفل.',
    differentialClinicalNotesEn: 'L2 is key motor level for hip flexors. Sparing of knee extension rules out major femoral nerve lesion.',
    differentialClinicalNotesAr: 'المستوى الحركي الرئيسي لثني الورك. سلامة بسط الركبة تنفي إصابة جذع العصب الفخذي الرئيسي.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Kendall FP.'
  },
  {
    rootLevel: 'L3',
    regionGroup: 'lumbar',
    predominantMovementEn: 'Knee extension',
    predominantMovementAr: 'بسط مفصل الركبة (مد الساق للأمام)',
    keyMuscles: [
      {
        nameEn: 'Quadriceps femoris (Rectus femoris, Vasti)',
        nameAr: 'العضلة رباعية الرؤوس الفخذية (المستقيمة الفخذية والمتسعات)',
        peripheralNerveEn: 'Femoral nerve (L2-L4)',
        peripheralNerveAr: 'العصب الفخذي (L2-L4)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Seated with knees at 90°; patient extends knee against resistance applied at anterior lower shin (above ankle).',
    testingPositionAr: 'جلوس مع تدلي الساق 90 درجة؛ يمد المريض ساقه للأمام ضد مقاومة يد الفاحص على أسفل الساق فوق الكاحل.',
    differentialClinicalNotesEn: 'Key ASIA motor level for knee extensors. L3 lesion depresses Patellar reflex and causes difficulty with stairs and squatting.',
    differentialClinicalNotesAr: 'المستوى الحركي المعتمد دولياً في ASIA لباسطات الركبة. أذيته تخمد منعكس الرضفة وتسبب صعوبة صعود الدرج والقرفصاء.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Magee DJ.'
  },
  {
    rootLevel: 'L4',
    regionGroup: 'lumbar',
    predominantMovementEn: 'Ankle dorsiflexion and inversion',
    predominantMovementAr: 'عطف القدم الظهري نحو الأعلى والداخل (Inversion)',
    keyMuscles: [
      {
        nameEn: 'Tibialis anterior',
        nameAr: 'العضلة الظنبوبية الأمامية',
        peripheralNerveEn: 'Deep peroneal (fibular) nerve (L4-L5)',
        peripheralNerveAr: 'العصب الشظوي العميق (L4-L5)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Quadriceps femoris (terminal contribution)',
        nameAr: 'العضلة رباعية الرؤوس الفخذية (مساهمة)',
        peripheralNerveEn: 'Femoral nerve (L3-L4)',
        peripheralNerveAr: 'العصب الفخذي (L3-L4)',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Supine or seated; patient dorsiflexes ankle with foot inverted; examiner pushes foot down into plantarflexion and eversion.',
    testingPositionAr: 'استلقاء أو جلوس؛ يسحب المريض قدمه للأعلى والداخل بقوة؛ يدفع الفاحص باطن مشط القدم للأسفل والخارج.',
    differentialClinicalNotesEn: 'Key motor level for ankle dorsiflexors. Correlates with Patellar reflex. L4 root lesions cause steppage gait.',
    differentialClinicalNotesAr: 'المستوى الحركي الأساسي لعطف القدم. يتطابق مع منعكس الرضفة. أذيته تسبب مشية الخبب (Steppage Gait) لضعف رفع مشط القدم.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; van der Windt DA et al. Cochrane (2010).'
  },
  {
    rootLevel: 'L5',
    regionGroup: 'lumbar',
    predominantMovementEn: 'Great toe extension and hip abduction',
    predominantMovementAr: 'بسط إبهام القدم للأعلى وتبعيد مفصل الورك',
    keyMuscles: [
      {
        nameEn: 'Extensor hallucis longus (EHL)',
        nameAr: 'العضلة باسطة إبهام القدم الطويلة',
        peripheralNerveEn: 'Deep peroneal (fibular) nerve (L5-S1)',
        peripheralNerveAr: 'العصب الشظوي العميق (L5-S1)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Extensor digitorum longus (EDL)',
        nameAr: 'العضلة باسطة الأصابع الطويلة للقدم',
        peripheralNerveEn: 'Deep peroneal nerve (L5-S1)',
        peripheralNerveAr: 'العصب الشظوي العميق (L5-S1)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Gluteus medius and minimus',
        nameAr: 'العضلة الألوية الوسطى والصغرى',
        peripheralNerveEn: 'Superior gluteal nerve (L4-S1, predominantly L5)',
        peripheralNerveAr: 'العصب الإليوي العلوي (L4-S1، L5 أساسي)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Patient dorsiflexes great toe against downward pressure on distal phalanx. Hip abduction tested side-lying.',
    testingPositionAr: 'يسحب المريض إبهام قدمه للأعلى منفرداً ضد ضغط إبهام الفاحص للأسفل. ويُفحص تبعيد الورك بالاستلقاء الجانبي.',
    differentialClinicalNotesEn: 'CRITICAL CLINICAL PEARL: Common Peroneal nerve compression at fibular head weakens EHL and Tibialis Anterior but SPARES Gluteus Medius (superior gluteal nerve). L5 radiculopathy WEAKENS Gluteus Medius as well (positive Trendelenburg sign).',
    differentialClinicalNotesAr: 'العلامة الفارقة الذهبية الحتمية: انضغاط العصب الشظوي المشترك عند عنق الشظية يضعف رفع القدم وإبهامها لكنه يترك مبعدة الورك (الألوية الوسطى) سليمة تماماً. بينما انضغاط جذر L5 يضعف الألوية الوسطى أيضاً وتظهر علامة ترندلينبورغ (Trendelenburg Sign).',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Kendall FP; Magee DJ.'
  },
  {
    rootLevel: 'S1',
    regionGroup: 'sacral',
    predominantMovementEn: 'Ankle plantarflexion and foot eversion',
    predominantMovementAr: 'عطف القدم الأخمصي للأسفل وقلب القدم للخارج (Eversion)',
    keyMuscles: [
      {
        nameEn: 'Gastrocnemius and Soleus',
        nameAr: 'عضلات ربلة الساق (الساقية والنعلية)',
        peripheralNerveEn: 'Tibial nerve (S1-S2)',
        peripheralNerveAr: 'العصب الظنبوبي (S1-S2)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Peroneus longus and brevis (Fibularis)',
        nameAr: 'العضلة الشظوية الطويلة والقصيرة',
        peripheralNerveEn: 'Superficial peroneal nerve (L5-S1)',
        peripheralNerveAr: 'العصب الشظوي السطحي (L5-S1)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Gluteus maximus',
        nameAr: 'العضلة الألوية الكبرى',
        peripheralNerveEn: 'Inferior gluteal nerve (L5-S2)',
        peripheralNerveAr: 'العصب الإليوي السفلي (L5-S2)',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Weight-bearing: patient performs single-leg heel raises (at least 10 reps). In bed: examiner resists forceful plantarflexion.',
    testingPositionAr: 'تحميل الوزن: يطلب من المريض الوقوف على قدم واحدة ورفع العقب 10 مرات متتالية. في السرير: دفع مشط القدم للأسفل بقوة.',
    differentialClinicalNotesEn: 'Manual testing in bed often misses grade 4 weakness because calf muscles are stronger than examiner arms; single-leg heel raise is necessary. Correlates with depressed Achilles reflex.',
    differentialClinicalNotesAr: 'الفحص اليدوي في السرير يغفل ضعف الدرجة 4 لأن ربلة الساق أقوى من يد الفاحص؛ لذلك فإن فحص الوقوف ورفع العقب على ساق واحدة إلزامي. يترافق مع تراجع منعكس العرقوب.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Bohannon RW (2005).'
  },
  {
    rootLevel: 'S2',
    regionGroup: 'sacral',
    predominantMovementEn: 'Knee flexion and intrinsic toe flexion',
    predominantMovementAr: 'ثني مفصل الركبة وثني أصابع القدم للأسفل',
    keyMuscles: [
      {
        nameEn: 'Hamstrings (Biceps femoris, Semitendinosus, Semimembranosus)',
        nameAr: 'عضلات باطن الركبة الخلفية (العضلة ذات الرأسين الفخذية ونصف الوترية)',
        peripheralNerveEn: 'Sciatic nerve (Tibial and Peroneal divisions, L5-S2)',
        peripheralNerveAr: 'العصب الوركي (القسم الظنبوبي والشظوي L5-S2)',
        isPrimaryRoot: true
      },
      {
        nameEn: 'Flexor digitorum longus (FDL)',
        nameAr: 'قابضة الأصابع الطويلة للقدم',
        peripheralNerveEn: 'Tibial nerve (S1-S2)',
        peripheralNerveAr: 'العصب الظنبوبي (S1-S2)',
        isPrimaryRoot: false
      }
    ],
    testingPositionEn: 'Prone; knee flexed to 60-70°; examiner resists further flexion by pulling ankle toward extension.',
    testingPositionAr: 'استلقاء بطني؛ يثني المريض ركبته 60-70 درجة؛ يشد الفاحص الكاحل محاولاً بسط الركبة ضد مقاومة المريض.',
    differentialClinicalNotesEn: 'Hamstrings receive wide L5-S2 innervation. S2 weakness also affects intrinsic foot muscles and pelvic stability.',
    differentialClinicalNotesAr: 'تتلقى عضلات خلف الفخذ تعصيباً واسعاً من L5 إلى S2. ضعف S2 يؤثر أيضاً على عضلات باطن القدم الدقيقة.',
    primarySourceCitation: "Kendall FP; DeJong's Neurologic Examination."
  },
  {
    rootLevel: 'S3',
    regionGroup: 'sacral',
    predominantMovementEn: 'Voluntary anal sphincter contraction and pelvic floor support',
    predominantMovementAr: 'الانقباض الإرادي للمصرة الشرجية الخارجية ودعم قاع الحوض',
    keyMuscles: [
      {
        nameEn: 'External anal sphincter and Levator ani',
        nameAr: 'المصرة الشرجية الخارجية والعضلة رافعة الشرج',
        peripheralNerveEn: 'Pudendal nerve (S2-S4)',
        peripheralNerveAr: 'العصب الفرجي (Pudendal Nerve S2-S4)',
        isPrimaryRoot: true
      }
    ],
    testingPositionEn: 'Digital rectal examination or clinical sphincter control evaluation (in specialized context).',
    testingPositionAr: 'تقييم سريري متخصص للتحكم العضلي الإرادي بالشرج والمثانة.',
    differentialClinicalNotesEn: 'EMERGENCY RED FLAG: Bilateral loss of S3-S4 sphincter function with saddle numbness constitutes Cauda Equina Syndrome, requiring emergent neurosurgical MRI triage within hours.',
    differentialClinicalNotesAr: 'علامة حمراء طارئة (Red Flag): الفقدان ثنائي الجانب للتحكم بالمصرة الشرجية والبولية مع خدر السرج يمثل متلازمة ذيل الفرس (Cauda Equina) ويتطلب رنيناً مغناطيسياً إسعافياً وتحويلاً جراحياً فورياً خلال ساعات.',
    primarySourceCitation: 'ASIA / ISNCSCI Standards; Finucane LM et al. JOSPT (2020).'
  }
];

export function getMyotomeByRoot(root: SpinalLevel): MyotomeDefinition | undefined {
  return MYOTOME_DEFINITIONS.find(m => m.rootLevel === root);
}

export function searchMyotomes(query: string): MyotomeDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return MYOTOME_DEFINITIONS;
  const words = q.split(/\s+/).filter(Boolean);

  return MYOTOME_DEFINITIONS.filter(m => {
    const textCorpus = [
      m.rootLevel,
      m.predominantMovementEn,
      m.predominantMovementAr,
      m.testingPositionEn,
      m.testingPositionAr,
      m.differentialClinicalNotesEn,
      m.differentialClinicalNotesAr,
      ...m.keyMuscles.flatMap(k => [k.nameEn, k.nameAr, k.peripheralNerveEn, k.peripheralNerveAr])
    ].join(' ').toLowerCase();

    return words.every(w => textCorpus.includes(w));
  });
}
