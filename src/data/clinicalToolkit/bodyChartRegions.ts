// =======================================================================
// PhysioRecord — Patient Body Chart Anatomical Regions & Resolution
// Pure coordinate clamping, region resolution, and data validation
// =======================================================================

import type { BodyChartView, PatientBodyChartData, BodySymptomType } from '../../types/clinical';
import { BODY_SYMPTOM_TYPES } from '../../types/clinical';

export interface AnatomicalRegionDefinition {
  regionCode: string;
  labelAr: string;
  labelEn: string;
  applicableViews: BodyChartView[];
}

export const ANATOMICAL_BODY_REGIONS: Record<string, AnatomicalRegionDefinition> = {
  head_neck: {
    regionCode: 'head_neck',
    labelAr: 'الرأس والرقبة',
    labelEn: 'Head & Neck',
    applicableViews: ['anterior', 'posterior'],
  },
  shoulder_right: {
    regionCode: 'shoulder_right',
    labelAr: 'الكتف الأيمن',
    labelEn: 'Right Shoulder',
    applicableViews: ['anterior', 'posterior'],
  },
  shoulder_left: {
    regionCode: 'shoulder_left',
    labelAr: 'الكتف الأيسر',
    labelEn: 'Left Shoulder',
    applicableViews: ['anterior', 'posterior'],
  },
  chest_thorax: {
    regionCode: 'chest_thorax',
    labelAr: 'الصدر والقفص الصدري',
    labelEn: 'Chest / Thorax',
    applicableViews: ['anterior'],
  },
  upper_back_thoracic: {
    regionCode: 'upper_back_thoracic',
    labelAr: 'أعلى الظهر والفقرات الصدرية',
    labelEn: 'Upper Back / Thoracic Spine',
    applicableViews: ['posterior'],
  },
  abdomen: {
    regionCode: 'abdomen',
    labelAr: 'البطن وجدار البطن',
    labelEn: 'Abdomen',
    applicableViews: ['anterior'],
  },
  low_back_lumbar: {
    regionCode: 'low_back_lumbar',
    labelAr: 'أسفل الظهر والفقرات القطنية',
    labelEn: 'Low Back / Lumbar Spine',
    applicableViews: ['posterior'],
  },
  pelvis_groin: {
    regionCode: 'pelvis_groin',
    labelAr: 'الحوض والمنطقة الإربية',
    labelEn: 'Pelvis & Groin',
    applicableViews: ['anterior'],
  },
  gluteal_sacral: {
    regionCode: 'gluteal_sacral',
    labelAr: 'الإلية والمنطقة العجزية',
    labelEn: 'Gluteal & Sacral Region',
    applicableViews: ['posterior'],
  },
  arm_right_upper: {
    regionCode: 'arm_right_upper',
    labelAr: 'العضد الأيمن',
    labelEn: 'Right Upper Arm',
    applicableViews: ['anterior', 'posterior'],
  },
  arm_left_upper: {
    regionCode: 'arm_left_upper',
    labelAr: 'العضد الأيسر',
    labelEn: 'Left Upper Arm',
    applicableViews: ['anterior', 'posterior'],
  },
  elbow_forearm_right: {
    regionCode: 'elbow_forearm_right',
    labelAr: 'المرفق والساعد الأيمن',
    labelEn: 'Right Forearm & Elbow',
    applicableViews: ['anterior', 'posterior'],
  },
  elbow_forearm_left: {
    regionCode: 'elbow_forearm_left',
    labelAr: 'المرفق والساعد الأيسر',
    labelEn: 'Left Forearm & Elbow',
    applicableViews: ['anterior', 'posterior'],
  },
  wrist_hand_right: {
    regionCode: 'wrist_hand_right',
    labelAr: 'الرسغ واليد اليمنى',
    labelEn: 'Right Wrist & Hand',
    applicableViews: ['anterior', 'posterior'],
  },
  wrist_hand_left: {
    regionCode: 'wrist_hand_left',
    labelAr: 'الرسغ واليد اليسرى',
    labelEn: 'Left Wrist & Hand',
    applicableViews: ['anterior', 'posterior'],
  },
  thigh_right: {
    regionCode: 'thigh_right',
    labelAr: 'الفخذ الأيمن',
    labelEn: 'Right Thigh',
    applicableViews: ['anterior', 'posterior'],
  },
  thigh_left: {
    regionCode: 'thigh_left',
    labelAr: 'الفخذ الأيسر',
    labelEn: 'Left Thigh',
    applicableViews: ['anterior', 'posterior'],
  },
  knee_right: {
    regionCode: 'knee_right',
    labelAr: 'الركبة اليمنى',
    labelEn: 'Right Knee',
    applicableViews: ['anterior', 'posterior'],
  },
  knee_left: {
    regionCode: 'knee_left',
    labelAr: 'الركبة اليسرى',
    labelEn: 'Left Knee',
    applicableViews: ['anterior', 'posterior'],
  },
  leg_shin_right: {
    regionCode: 'leg_shin_right',
    labelAr: 'الساق وظنبوب القدم اليمنى',
    labelEn: 'Right Lower Leg / Shin',
    applicableViews: ['anterior'],
  },
  leg_calf_right: {
    regionCode: 'leg_calf_right',
    labelAr: 'بطة الساق اليمنى (ربلة الساق)',
    labelEn: 'Right Calf',
    applicableViews: ['posterior'],
  },
  leg_shin_left: {
    regionCode: 'leg_shin_left',
    labelAr: 'الساق وظنبوب القدم اليسرى',
    labelEn: 'Left Lower Leg / Shin',
    applicableViews: ['anterior'],
  },
  leg_calf_left: {
    regionCode: 'leg_calf_left',
    labelAr: 'بطة الساق اليسرى (ربلة الساق)',
    labelEn: 'Left Calf',
    applicableViews: ['posterior'],
  },
  ankle_foot_right: {
    regionCode: 'ankle_foot_right',
    labelAr: 'الكاحل والقدم اليمنى',
    labelEn: 'Right Ankle & Foot',
    applicableViews: ['anterior', 'posterior'],
  },
  ankle_foot_left: {
    regionCode: 'ankle_foot_left',
    labelAr: 'الكاحل والقدم اليسرى',
    labelEn: 'Left Ankle & Foot',
    applicableViews: ['anterior', 'posterior'],
  },
};

/**
 * Clamps coordinates to [0.00, 100.00] and maps a canvas percentage point (xPercent, yPercent)
 * to standard anatomical region codes and bilingual labels.
 * In Anterior view: patient's Right is canvas Left (x < 50%), patient's Left is canvas Right (x > 50%).
 * In Posterior view: patient's Left is canvas Left (x < 50%), patient's Right is canvas Right (x > 50%).
 */
export function resolveAnatomicalRegionFromPoint(
  view: BodyChartView,
  xPercentRaw: number,
  yPercentRaw: number,
  explicitRegionCode?: string
): {
  regionCode: string;
  labelAr: string;
  labelEn: string;
  xPercent: number;
  yPercent: number;
} {
  // 1. Strict Clamping & Precision to 2 decimal places
  const x = Math.min(100, Math.max(0, Number(Number(xPercentRaw).toFixed(2))));
  const y = Math.min(100, Math.max(0, Number(Number(yPercentRaw).toFixed(2))));

  // 2. If explicit code provided and recognized, use it
  if (explicitRegionCode && ANATOMICAL_BODY_REGIONS[explicitRegionCode]) {
    const reg = ANATOMICAL_BODY_REGIONS[explicitRegionCode];
    return {
      regionCode: reg.regionCode,
      labelAr: reg.labelAr,
      labelEn: reg.labelEn,
      xPercent: x,
      yPercent: y,
    };
  }

  // 3. Coordinate-based anatomical zone partitioning
  let code = 'head_neck';

  if (y <= 13) {
    code = 'head_neck';
  } else if (y <= 24) {
    if (view === 'anterior') {
      if (x < 35) code = 'shoulder_right';
      else if (x > 65) code = 'shoulder_left';
      else code = 'chest_thorax';
    } else {
      if (x < 35) code = 'shoulder_left';
      else if (x > 65) code = 'shoulder_right';
      else code = 'upper_back_thoracic';
    }
  } else if (y <= 40) {
    if (view === 'anterior') {
      if (x < 28) code = 'arm_right_upper';
      else if (x > 72) code = 'arm_left_upper';
      else code = 'abdomen';
    } else {
      if (x < 28) code = 'arm_left_upper';
      else if (x > 72) code = 'arm_right_upper';
      else code = 'low_back_lumbar';
    }
  } else if (y <= 49) {
    if (view === 'anterior') {
      if (x < 22) code = 'elbow_forearm_right';
      else if (x > 78) code = 'elbow_forearm_left';
      else code = 'pelvis_groin';
    } else {
      if (x < 22) code = 'elbow_forearm_left';
      else if (x > 78) code = 'elbow_forearm_right';
      else code = 'gluteal_sacral';
    }
  } else if (y <= 66) {
    if (view === 'anterior') {
      if (x < 18) code = 'wrist_hand_right';
      else if (x > 82) code = 'wrist_hand_left';
      else if (x <= 50) code = 'thigh_right';
      else code = 'thigh_left';
    } else {
      if (x < 18) code = 'wrist_hand_left';
      else if (x > 82) code = 'wrist_hand_right';
      else if (x <= 50) code = 'thigh_left';
      else code = 'thigh_right';
    }
  } else if (y <= 77) {
    if (view === 'anterior') {
      code = x <= 50 ? 'knee_right' : 'knee_left';
    } else {
      code = x <= 50 ? 'knee_left' : 'knee_right';
    }
  } else if (y <= 89) {
    if (view === 'anterior') {
      code = x <= 50 ? 'leg_shin_right' : 'leg_shin_left';
    } else {
      code = x <= 50 ? 'leg_calf_left' : 'leg_calf_right';
    }
  } else {
    // y > 89: Ankle and foot
    if (view === 'anterior') {
      code = x <= 50 ? 'ankle_foot_right' : 'ankle_foot_left';
    } else {
      code = x <= 50 ? 'ankle_foot_left' : 'ankle_foot_right';
    }
  }

  const resolved = ANATOMICAL_BODY_REGIONS[code] || ANATOMICAL_BODY_REGIONS.head_neck;
  return {
    regionCode: resolved.regionCode,
    labelAr: resolved.labelAr,
    labelEn: resolved.labelEn,
    xPercent: x,
    yPercent: y,
  };
}

/**
 * Pure validator function for PatientBodyChartData structure, ranges, and types.
 */
export function validatePatientBodyChartData(chart?: PatientBodyChartData): boolean {
  if (!chart) return true; // Optional field

  if (chart.chartVersion !== '1.0.0') return false;
  if (!Array.isArray(chart.markers)) return false;

  const validSymptomKeys = Object.keys(BODY_SYMPTOM_TYPES) as BodySymptomType[];

  for (const m of chart.markers) {
    if (!m || typeof m !== 'object') return false;
    if (typeof m.markerId !== 'string' || !m.markerId.trim()) return false;
    if (m.view !== 'anterior' && m.view !== 'posterior') return false;
    if (typeof m.xPercent !== 'number' || isNaN(m.xPercent) || m.xPercent < 0 || m.xPercent > 100) return false;
    if (typeof m.yPercent !== 'number' || isNaN(m.yPercent) || m.yPercent < 0 || m.yPercent > 100) return false;
    if (!validSymptomKeys.includes(m.symptomType)) return false;
    if (typeof m.anatomicalRegionCode !== 'string' || !m.anatomicalRegionCode.trim()) return false;
    if (m.severityNrs !== undefined) {
      if (typeof m.severityNrs !== 'number' || isNaN(m.severityNrs) || m.severityNrs < 0 || m.severityNrs > 10) {
        return false;
      }
    }
    if (m.description !== undefined && typeof m.description !== 'string') return false;
    if (typeof m.createdAt !== 'string' || !m.createdAt.trim()) return false;
  }

  if (chart.clinicianSummaryNotes !== undefined && typeof chart.clinicianSummaryNotes !== 'string') {
    return false;
  }
  if (typeof chart.lastUpdatedAt !== 'string' || !chart.lastUpdatedAt.trim()) {
    return false;
  }

  return true;
}
