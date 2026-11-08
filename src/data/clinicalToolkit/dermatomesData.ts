// =======================================================================
// PhysioRecord — Dermatomes Clinical Reference Dataset (Phase 2C)
// Sources: ASIA / ISNCSCI Standards (2025 Revised), Foerster (1933),
// Keegan & Garrett (1948), Lee et al. (2008, Annals of Neurology / Spine)
// =======================================================================

import type { DermatomeDefinition, SpinalLevel } from '../../types/clinicalToolkit';

export const DERMATOMAL_OVERLAP_GENERAL_NOTE_EN = 
  'Anatomical studies (Foerster 1933; Keegan & Garrett 1948; Lee et al. 2008) confirm that adjacent dermatomes overlap substantially (>50%). Complete loss of sensation (anesthesia) rarely occurs from isolated single nerve root lesions; instead, hypoesthesia or altered sensation (paresthesia/dysesthesia) is typical. Complete dense anesthesia typically suggests peripheral nerve transection rather than single-root radiculopathy.';

export const DERMATOMAL_OVERLAP_GENERAL_NOTE_AR = 
  'تؤكد الدراسات التشريحية الكلاسيكية والحديثة (Foerster 1933؛ Lee et al. 2008) أن القطاعات الجلدية المتجاورة تتداخل بنسبة تزيد عن 50%. لذلك فإن انضغاط أو أذية جذر عصبي منفرد نادراً ما تؤدي إلى تخدير أو فقدان تام للإحساس في كامل القطاع، بل تؤدي غالباً إلى نقص حس (Hypoesthesia) أو خدر ونمل، بينما يشير الفقدان الحسي التام الحاد والمحدد إلى أذية عصب محيطي مباشر وليس جذر شوكي.';

export const DERMATOME_DEFINITIONS: DermatomeDefinition[] = [
  // --- CERVICAL DERMATOMES (C2 - C8) ---
  {
    rootLevel: 'C2',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Occipital protuberance and posterior scalp',
    canonicalRegionAr: 'البروز القذالي وخلف فروة الرأس وأعلى العنق',
    keySensoryPointEn: 'Occipital protuberance (at least 3 cm behind ear)',
    keySensoryPointAr: 'البروز القذالي الخارجي (على بعد 3 سم خلف صيوان الأذن)',
    asiaCode: 'C2',
    overlapClinicalNotesEn: 'Extensive overlap with C3; mediated primarily through greater and lesser occipital nerves. Trigeminal nerve (V1/V2/V3) innervates face anteriorly.',
    overlapClinicalNotesAr: 'تداخل واسع مع الجذر C3؛ ينتقل عبر العصبين القذاليين الأكبر والأصغر. الوجه الأمامي يعصب بالعصب ثلاثي التوائم (العصب القحفي الخامس).',
    svgRegionIdsAnterior: ['dm-ant-c2'],
    svgRegionIdsPosterior: ['dm-post-c2'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025); Foerster O. Brain (1933).'
  },
  {
    rootLevel: 'C3',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Supraclavicular fossa and upper neck',
    canonicalRegionAr: 'الحفرة فوق الترقوة وقاعدة العنق',
    keySensoryPointEn: 'Supraclavicular fossa at the midclavicular line',
    keySensoryPointAr: 'الحفرة فوق الترقوة عند خط منتصف الترقوة',
    asiaCode: 'C3',
    overlapClinicalNotesEn: 'Supplies neck base; fibers contribute to phrenic nerve (C3-C5) for diaphragmatic motor control.',
    overlapClinicalNotesAr: 'يغذي قاعدة الرقبة وأعلى الترقوة؛ تشارك أليافه مع C4 و C5 في تغذية العصب الحجابي (Phrenic Nerve) المحرك للحجاب الحاجز.',
    svgRegionIdsAnterior: ['dm-ant-c3'],
    svgRegionIdsPosterior: ['dm-post-c3'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'C4',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Shoulder tip and acromioclavicular region',
    canonicalRegionAr: 'قمة الكتف والمفصل الأخرمي الترقوي وأعلى الصدر',
    keySensoryPointEn: 'Over the acromioclavicular (AC) joint',
    keySensoryPointAr: 'مباشرة فوق المفصل الأخرمي الترقوي (AC Joint)',
    asiaCode: 'C4',
    overlapClinicalNotesEn: 'Innervates shoulder cape; variation includes pre-fixed brachial plexus where C4 contributes significantly to upper trunk.',
    overlapClinicalNotesAr: 'يغذي أعلى الكتف (قبعة الكتف)؛ قد يشارك بتفرع متقدم (Pre-fixed Plexus) لتغذية عضلات الطرف العلوي.',
    svgRegionIdsAnterior: ['dm-ant-c4-l', 'dm-ant-c4-r'],
    svgRegionIdsPosterior: ['dm-post-c4-l', 'dm-post-c4-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'C5',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Lateral aspect of upper arm (deltoid area)',
    canonicalRegionAr: 'الوجه الوحشي لأعلى العضد (منطقة العضلة الدالية)',
    keySensoryPointEn: 'Lateral (radial) side of the antecubital fossa just proximal to the elbow',
    keySensoryPointAr: 'الجانب الوحشي (الكعبري) للحفرة المرفقية الأمامية أعلى المرفق مباشرة',
    asiaCode: 'C5',
    overlapClinicalNotesEn: 'Corresponds clinically to axillary nerve sensory distribution over badge area. Overlaps C6 distally.',
    overlapClinicalNotesAr: 'يتطابق سريرياً مع التوزع الحسي للعصب الإبطي في منطقة شارة الكتف. يتداخل سفلياً مع C6.',
    svgRegionIdsAnterior: ['dm-ant-c5-l', 'dm-ant-c5-r'],
    svgRegionIdsPosterior: ['dm-post-c5-l', 'dm-post-c5-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'C6',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Lateral forearm, thumb, and radial hand',
    canonicalRegionAr: 'الجانب الوحشي للساعد وإبهام اليد والسبابة جزئياً',
    keySensoryPointEn: 'Dorsal surface of the proximal phalanx of the thumb',
    keySensoryPointAr: 'السطح الظهري للسلامى القريبة لإبهام اليد',
    asiaCode: 'C6',
    overlapClinicalNotesEn: 'Classic radial root. Tested at thumb dorsum to avoid median nerve autonomous palmar zone.',
    overlapClinicalNotesAr: 'الجذر الكعبري الكلاسيكي. يُفحص سريرياً على ظهر إبهام اليد لتفادي التداخل مع منطقة العصب الناصف في راحة اليد.',
    svgRegionIdsAnterior: ['dm-ant-c6-l', 'dm-ant-c6-r'],
    svgRegionIdsPosterior: ['dm-post-c6-l', 'dm-post-c6-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025); Lee MWL et al. Spine (2008).'
  },
  {
    rootLevel: 'C7',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Middle finger and central palm/dorsum of hand',
    canonicalRegionAr: 'الإصبع الأوسط ووسط ظهر وراحة اليد',
    keySensoryPointEn: 'Dorsal surface of the proximal phalanx of the middle finger',
    keySensoryPointAr: 'السطح الظهري للسلامى القريبة للإصبع الأوسط',
    asiaCode: 'C7',
    overlapClinicalNotesEn: 'Most commonly compressed cervical root in disc herniation (C6-C7). May overlap index and ring fingers.',
    overlapClinicalNotesAr: 'الجذر الأكثر عرضة للانضغاط في الانزلاقات الغضروفية الرقبية (C6-C7). قد يمتد تداخله للسبابة والبنصر.',
    svgRegionIdsAnterior: ['dm-ant-c7-l', 'dm-ant-c7-r'],
    svgRegionIdsPosterior: ['dm-post-c7-l', 'dm-post-c7-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'C8',
    regionGroup: 'cervical',
    canonicalRegionEn: 'Medial hand, little finger, and distal ulnar forearm',
    canonicalRegionAr: 'إصبع الخنصر والجانب الإنسي (الزندي) لليد وأسفل الساعد',
    keySensoryPointEn: 'Dorsal surface of the proximal phalanx of the little finger',
    keySensoryPointAr: 'السطح الظهري للسلامى القريبة لإصبع الخنصر (الإصبع الخامس)',
    asiaCode: 'C8',
    overlapClinicalNotesEn: 'Corresponds clinically with ulnar border of hand. Compression at C7-T1 disc or thoracic outlet.',
    overlapClinicalNotesAr: 'يتطابق مع الحافة الزندية لليد. قد يتأثر بانضغاط مخرج الصدر (TOS) أو انزلاق C7-T1.',
    svgRegionIdsAnterior: ['dm-ant-c8-l', 'dm-ant-c8-r'],
    svgRegionIdsPosterior: ['dm-post-c8-l', 'dm-post-c8-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },

  // --- THORACIC DERMATOMES (T1 - T12) ---
  {
    rootLevel: 'T1',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Medial forearm and proximal antecubital area',
    canonicalRegionAr: 'الوجه الإنسي للساعد وأعلى المرفق من الداخل',
    keySensoryPointEn: 'Medial (ulnar) side of the antecubital fossa, just proximal to the medial epicondyle',
    keySensoryPointAr: 'الجانب الإنسي (الزندي) للحفرة المرفقية الأمامية أعلى اللقيمية الإنسية',
    asiaCode: 'T1',
    overlapClinicalNotesEn: 'Part of lower trunk of brachial plexus. Lesions may associate with Horner syndrome if sympathetic chain involved.',
    overlapClinicalNotesAr: 'جزء من الجذع السفلي للضفيرة العضدية. قد يترافق مع متلازمة هورنر في حال تأثر السلسلة الودية الصدرية.',
    svgRegionIdsAnterior: ['dm-ant-t1-l', 'dm-ant-t1-r'],
    svgRegionIdsPosterior: ['dm-post-t1-l', 'dm-post-t1-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T2',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Apex of axilla and upper anterior chest',
    canonicalRegionAr: 'قمة الحفرة الإبطية وأعلى جدار الصدر',
    keySensoryPointEn: 'Apex of the axilla',
    keySensoryPointAr: 'قمة الحفرة الإبطية',
    asiaCode: 'T2',
    overlapClinicalNotesEn: 'Demarcates thoracic trunk from upper extremity innervation.',
    overlapClinicalNotesAr: 'الحد الفاصل الحسي بين تعصيب الجذع الصدري وأعصاب الطرف العلوي.',
    svgRegionIdsAnterior: ['dm-ant-t2'],
    svgRegionIdsPosterior: ['dm-post-t2'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T3',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Third intercostal space',
    canonicalRegionAr: 'المسافة الوربية الثالثة بجدار الصدر',
    keySensoryPointEn: 'Midclavicular line at the 3rd intercostal space',
    keySensoryPointAr: 'المسافة الوربية الثالثة عند خط منتصف الترقوة',
    asiaCode: 'T3',
    overlapClinicalNotesEn: 'Circumferential thoracic band with adjacent overlap.',
    overlapClinicalNotesAr: 'حزام صدري دائري متداخل مع T2 و T4.',
    svgRegionIdsAnterior: ['dm-ant-t3'],
    svgRegionIdsPosterior: ['dm-post-t3'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T4',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Nipple line (fourth intercostal space)',
    canonicalRegionAr: 'مستوى الحلمتين (المسافة الوربية الرابعة)',
    keySensoryPointEn: 'Midclavicular line at the 4th intercostal space (nipple level)',
    keySensoryPointAr: 'المسافة الوربية الرابعة عند خط منتصف الترقوة (مستوى الحلمة)',
    asiaCode: 'T4',
    overlapClinicalNotesEn: 'Critical clinical landmark in acute spinal cord trauma sensory level determination.',
    overlapClinicalNotesAr: 'معلم سريري حاسم لتحديد المستوى الحسي في إصابات النخاع الشوكي الحادة.',
    svgRegionIdsAnterior: ['dm-ant-t4'],
    svgRegionIdsPosterior: ['dm-post-t4'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T5',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Fifth intercostal space',
    canonicalRegionAr: 'المسافة الوربية الخامسة',
    keySensoryPointEn: 'Midway between T4 (nipple) and T6 (xiphisternum)',
    keySensoryPointAr: 'منتصف المسافة بين مستوى الحلمة وناتئ القص الخنجري',
    asiaCode: 'T5',
    overlapClinicalNotesEn: 'Thoracic band.',
    overlapClinicalNotesAr: 'شريط صدري وسطي.',
    svgRegionIdsAnterior: ['dm-ant-t5'],
    svgRegionIdsPosterior: ['dm-post-t5'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T6',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Xiphoid process level',
    canonicalRegionAr: 'مستوى الناتئ الخنجري لعظم القص',
    keySensoryPointEn: 'Midclavicular line at the horizontal level of the xiphisternum',
    keySensoryPointAr: 'خط منتصف الترقوة عند المستوى الأفقي للناتئ الخنجري',
    asiaCode: 'T6',
    overlapClinicalNotesEn: 'Marks epigastric sensory transition.',
    overlapClinicalNotesAr: 'يعلم الانتقال الحسي لأعلى فم المعدة والبطن.',
    svgRegionIdsAnterior: ['dm-ant-t6'],
    svgRegionIdsPosterior: ['dm-post-t6'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T7',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Seventh intercostal space (subxiphoid)',
    canonicalRegionAr: 'المسافة الوربية السابعة أسفل الناتئ الخنجري',
    keySensoryPointEn: 'Midway between T6 and T8 at midclavicular line',
    keySensoryPointAr: 'منتصف المسافة بين T6 و T8 عند خط منتصف الترقوة',
    asiaCode: 'T7',
    overlapClinicalNotesEn: 'Thoracoabdominal strip.',
    overlapClinicalNotesAr: 'شريط صدري بطني.',
    svgRegionIdsAnterior: ['dm-ant-t7'],
    svgRegionIdsPosterior: ['dm-post-t7'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T8',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Eighth intercostal space',
    canonicalRegionAr: 'المسافة الوربية الثامنة أعلى السرة',
    keySensoryPointEn: 'Midway between T6 (xiphisternum) and T10 (umbilicus)',
    keySensoryPointAr: 'منتصف المسافة بين الناتئ الخنجري ومستوى السرة',
    asiaCode: 'T8',
    overlapClinicalNotesEn: 'Upper abdominal wall.',
    overlapClinicalNotesAr: 'أعلى جدار البطن.',
    svgRegionIdsAnterior: ['dm-ant-t8'],
    svgRegionIdsPosterior: ['dm-post-t8'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T9',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Ninth intercostal space',
    canonicalRegionAr: 'المسافة الوربية التاسعة فوق السرة مباشرة',
    keySensoryPointEn: 'Midway between T8 and T10 at midclavicular line',
    keySensoryPointAr: 'فوق مستوى السرة بقليل عند خط منتصف الترقوة',
    asiaCode: 'T9',
    overlapClinicalNotesEn: 'Periumbilical superior margin.',
    overlapClinicalNotesAr: 'الحافة العلوية المحيطة بالسرة.',
    svgRegionIdsAnterior: ['dm-ant-t9'],
    svgRegionIdsPosterior: ['dm-post-t9'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T10',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Umbilicus level',
    canonicalRegionAr: 'مستوى السرة وجدار البطن الأوسط',
    keySensoryPointEn: 'Midclavicular line at the horizontal level of the umbilicus',
    keySensoryPointAr: 'خط منتصف الترقوة عند المستوى الأفقي للسرة',
    asiaCode: 'T10',
    overlapClinicalNotesEn: 'Major clinical neurological landmark; corresponds to lower spinal cord segments (T10-L1 myelum).',
    overlapClinicalNotesAr: 'معلم عصبي رئيسي؛ تخدير ما دونه يحدد أذية T10 الصدرية فما دون.',
    svgRegionIdsAnterior: ['dm-ant-t10'],
    svgRegionIdsPosterior: ['dm-post-t10'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T11',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Eleventh intercostal space',
    canonicalRegionAr: 'المسافة الوربية الحادية عشرة أسفل السرة',
    keySensoryPointEn: 'Midway between T10 (umbilicus) and T12 (inguinal ligament)',
    keySensoryPointAr: 'منتصف المسافة بين السرة والرباط الإربي',
    asiaCode: 'T11',
    overlapClinicalNotesEn: 'Infraumbilical region.',
    overlapClinicalNotesAr: 'منطقة أسفل السرة.',
    svgRegionIdsAnterior: ['dm-ant-t11'],
    svgRegionIdsPosterior: ['dm-post-t11'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'T12',
    regionGroup: 'thoracic',
    canonicalRegionEn: 'Inguinal ligament level',
    canonicalRegionAr: 'أعلى المنطقة الإربية وأسفل جدار البطن',
    keySensoryPointEn: 'Midpoint of the inguinal ligament',
    keySensoryPointAr: 'منتصف الرباط الإربي',
    asiaCode: 'T12',
    overlapClinicalNotesEn: 'Demarcates lower trunk from lumbosacral plexus innervation.',
    overlapClinicalNotesAr: 'الحد الفاصل بين الجذع والضفيرة القطنية العجزية.',
    svgRegionIdsAnterior: ['dm-ant-t12'],
    svgRegionIdsPosterior: ['dm-post-t12'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },

  // --- LUMBAR DERMATOMES (L1 - L5) ---
  {
    rootLevel: 'L1',
    regionGroup: 'lumbar',
    canonicalRegionEn: 'Upper anterior groin and proximal thigh',
    canonicalRegionAr: 'أعلى المنطقة الإربية والوجه الأمامي العلوي للفخذ',
    keySensoryPointEn: 'Midway between T12 key point and L2 key point on anterior thigh',
    keySensoryPointAr: 'منتصف المسافة بين نقطة T12 الإربية ونقطة L2 بمنتصف الفخذ',
    asiaCode: 'L1',
    overlapClinicalNotesEn: 'Transition zone between thoracic and lumbar radicular distributions.',
    overlapClinicalNotesAr: 'منطقة انتقالية بين الجذور الصدرية والقطنية.',
    svgRegionIdsAnterior: ['dm-ant-l1-l', 'dm-ant-l1-r'],
    svgRegionIdsPosterior: ['dm-post-l1-l', 'dm-post-l1-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'L2',
    regionGroup: 'lumbar',
    canonicalRegionEn: 'Mid-anterior thigh',
    canonicalRegionAr: 'منتصف الوجه الأمامي للفخذ',
    keySensoryPointEn: 'Midpoint of the anterior thigh between inguinal crease and medial femoral condyle',
    keySensoryPointAr: 'منتصف الوجه الأمامي للفخذ بين الثنية الإربية واللقمة الفخذية الإنسية',
    asiaCode: 'L2',
    overlapClinicalNotesEn: 'Extensive overlap with L1 proximally and L3 distally.',
    overlapClinicalNotesAr: 'تداخل واسع مع L1 في الأعلى ومع L3 في الأسفل.',
    svgRegionIdsAnterior: ['dm-ant-l2-l', 'dm-ant-l2-r'],
    svgRegionIdsPosterior: ['dm-post-l2-l', 'dm-post-l2-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'L3',
    regionGroup: 'lumbar',
    canonicalRegionEn: 'Distal anterior thigh and medial femoral condyle (knee)',
    canonicalRegionAr: 'أسفل الوجه الأمامي للفخذ واللقمة الفخذية الإنسية للركبة',
    keySensoryPointEn: 'Medial femoral condyle above the knee joint line',
    keySensoryPointAr: 'اللقمة الفخذية الإنسية مباشرة فوق خط مفصل الركبة',
    asiaCode: 'L3',
    overlapClinicalNotesEn: 'Radiates obliquely across anterior thigh to medial knee. Overlaps patellar reflex arc.',
    overlapClinicalNotesAr: 'يمتد مائلاً عبر الفخذ إلى الجهة الإنسية للركبة؛ يشارك في القوس الانعكاسي لمنعكس الرضفة.',
    svgRegionIdsAnterior: ['dm-ant-l3-l', 'dm-ant-l3-r'],
    svgRegionIdsPosterior: ['dm-post-l3-l', 'dm-post-l3-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'L4',
    regionGroup: 'lumbar',
    canonicalRegionEn: 'Medial lower leg, medial malleolus, and medial foot',
    canonicalRegionAr: 'الوجه الإنسي للساق والكعب الإنسي والحافة الداخلية للقدم',
    keySensoryPointEn: 'Medial malleolus of the tibia',
    keySensoryPointAr: 'الكعب الإنسي لعظم الظنبوب (Medial Malleolus)',
    asiaCode: 'L4',
    overlapClinicalNotesEn: 'Crosses anterior knee to medial ankle. Primary sensory root evaluated in L3-L4 disc herniations.',
    overlapClinicalNotesAr: 'يمتد عبر أمام الركبة إلى الكاحل الإنسي. الجذر الحسي الأساسي المتأثر بالانزلاق الغضروفي L3-L4.',
    svgRegionIdsAnterior: ['dm-ant-l4-l', 'dm-ant-l4-r'],
    svgRegionIdsPosterior: ['dm-post-l4-l', 'dm-post-l4-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'L5',
    regionGroup: 'lumbar',
    canonicalRegionEn: 'Anterolateral leg, dorsum of foot, and great toe',
    canonicalRegionAr: 'الوجه الأمامي الوحشي للساق وظهر القدم وإبهام القدم',
    keySensoryPointEn: 'Dorsum of the foot at the third metatarsophalangeal (MTP) joint',
    keySensoryPointAr: 'ظهر القدم عند المفصل المشطي السلامي الثالث',
    asiaCode: 'L5',
    overlapClinicalNotesEn: 'Most frequently affected root in lumbar radiculopathy (L4-L5 disc). Must distinguish from deep peroneal nerve entrapment.',
    overlapClinicalNotesAr: 'الجذر الأكثر إصابة في عرق النسا واعتلال الجذور القطنية (انزلاق L4-L5). يجب تفريقه سريرياً عن انضغاط العصب الشظوي.',
    svgRegionIdsAnterior: ['dm-ant-l5-l', 'dm-ant-l5-r'],
    svgRegionIdsPosterior: ['dm-post-l5-l', 'dm-post-l5-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025); Lee MWL et al. Spine (2008).'
  },

  // --- SACRAL DERMATOMES (S1 - S5) ---
  {
    rootLevel: 'S1',
    regionGroup: 'sacral',
    canonicalRegionEn: 'Lateral heel, lateral foot, and posterior calf',
    canonicalRegionAr: 'الكعب الوحشي والحافة الخارجية للقدم وخلف ربلة الساق',
    keySensoryPointEn: 'Lateral aspect of the calcaneus (heel)',
    keySensoryPointAr: 'الجانب الوحشي لعظم العقب (الكعب الوحشي)',
    asiaCode: 'S1',
    overlapClinicalNotesEn: 'Evaluated in L5-S1 disc herniation. Correlates with Achilles reflex depression and gastrocnemius weakness.',
    overlapClinicalNotesAr: 'يتأثر بالانزلاق الغضروفي القطني العجزي L5-S1. يترافق مع غياب منعكس وتر أخيل وضعف عضلات ربلة الساق.',
    svgRegionIdsAnterior: ['dm-ant-s1-l', 'dm-ant-s1-r'],
    svgRegionIdsPosterior: ['dm-post-s1-l', 'dm-post-s1-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'S2',
    regionGroup: 'sacral',
    canonicalRegionEn: 'Posterior midline of thigh and popliteal fossa',
    canonicalRegionAr: 'خلف الفخذ في خط الوسط وخلف الركبة (الحفرة المأبضية)',
    keySensoryPointEn: 'Midpoint of the popliteal fossa',
    keySensoryPointAr: 'منتصف الحفرة المأبضية خلف الركبة',
    asiaCode: 'S2',
    overlapClinicalNotesEn: 'Posterior longitudinal stripe along midline of posterior thigh.',
    overlapClinicalNotesAr: 'شريط طولي خلفي يمتد على خط الوسط لخلف الفخذ.',
    svgRegionIdsAnterior: [],
    svgRegionIdsPosterior: ['dm-post-s2-l', 'dm-post-s2-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'S3',
    regionGroup: 'sacral',
    canonicalRegionEn: 'Ischial tuberosity and medial buttock',
    canonicalRegionAr: 'منطقة الأحدوبة الإسكية وأسفل الإلية',
    keySensoryPointEn: 'Over the ischial tuberosity (or infragluteal fold)',
    keySensoryPointAr: 'فوق الأحدوبة الإسكية (أو الثنية تحت الإليوية)',
    asiaCode: 'S3',
    overlapClinicalNotesEn: 'Medial buttock area; forms outer concentric circle of saddle area.',
    overlapClinicalNotesAr: 'منطقة أسفل الإلية؛ تشكل الدائرة الخارجية لمنطقة السرج.',
    svgRegionIdsAnterior: [],
    svgRegionIdsPosterior: ['dm-post-s3-l', 'dm-post-s3-r'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'S4',
    regionGroup: 'sacral',
    canonicalRegionEn: 'Perianal area (concentric saddle sensation)',
    canonicalRegionAr: 'المنطقة المحيطة بالشرج (خدر السرج)',
    keySensoryPointEn: 'Perianal area at the mucocutaneous junction',
    keySensoryPointAr: 'المنطقة المحيطة بالشرج عند الاتصال الجلدي المخاطي',
    asiaCode: 'S4-5',
    overlapClinicalNotesEn: 'Tested with S5 as S4-5. Loss indicates Cauda Equina Syndrome (emergency surgical red flag).',
    overlapClinicalNotesAr: 'يُفحص مع S5 ككتلة واحدة (S4-S5). فقدان الإحساس هنا (Saddle Anesthesia) علامة حمراء طارئة لمتلازمة ذيل الفرس.',
    svgRegionIdsAnterior: [],
    svgRegionIdsPosterior: ['dm-post-s4-s5'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  },
  {
    rootLevel: 'S5',
    regionGroup: 'sacral',
    canonicalRegionEn: 'Perianal area (innermost concentric zone)',
    canonicalRegionAr: 'المنطقة الشرجية المباشرة (أعمق نقطة سرجية)',
    keySensoryPointEn: 'Perianal area immediately surrounding the anal orifice',
    keySensoryPointAr: 'المنطقة المحيطة بفتحة الشرج مباشرة',
    asiaCode: 'S4-5',
    overlapClinicalNotesEn: 'Concentric sacral sensory zone evaluated for sacral sparing in spinal cord injury.',
    overlapClinicalNotesAr: 'يُقيّم للتأكد من وجود الإبقاء العجزي (Sacral Sparing) في إصابات النخاع الشوكي.',
    svgRegionIdsAnterior: [],
    svgRegionIdsPosterior: ['dm-post-s4-s5'],
    primarySourceCitation: 'ASIA / ISNCSCI Standards (2025).'
  }
];

export function getDermatomeByRoot(root: SpinalLevel): DermatomeDefinition | undefined {
  return DERMATOME_DEFINITIONS.find(d => d.rootLevel === root);
}

export function searchDermatomes(query: string): DermatomeDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return DERMATOME_DEFINITIONS;

  return DERMATOME_DEFINITIONS.filter(d => {
    return (
      d.rootLevel.toLowerCase().includes(q) ||
      d.canonicalRegionEn.toLowerCase().includes(q) ||
      d.canonicalRegionAr.includes(q) ||
      d.keySensoryPointEn.toLowerCase().includes(q) ||
      d.keySensoryPointAr.includes(q) ||
      (d.asiaCode && d.asiaCode.toLowerCase().includes(q))
    );
  });
}
