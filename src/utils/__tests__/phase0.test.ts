import { describe, it, expect } from 'vitest';
import { localDate, formatClinicalDate, computePatientAge } from '../date';
import {
  findMatchingBaselineRomEntry,
  compareLongitudinalRomEntries,
  findMatchingBaselineMmtEntry,
  compareLongitudinalMmtEntries,
} from '../../data/clinicalToolkit/romMmtCatalog';
import { SessionService } from '../../services/sessionService';
import { SYNTHETIC_PATIENTS } from '../../data/syntheticPatients';
import type { RomMeasurementEntry, MmtMeasurementEntry } from '../../types/clinical';

describe('Phase 0 — Dates, Age, ROM/MMT Matching & Session Numbering', () => {
  describe('localDate()', () => {
    it('formats a local Date as YYYY-MM-DD using local calendar components', () => {
      const sample = new Date(2026, 4, 9, 0, 30, 0); // May 9, 2026 00:30 local time
      expect(localDate(sample)).toBe('2026-05-09');
    });

    it('preserves already formatted YYYY-MM-DD strings without UTC shifting', () => {
      expect(localDate('2026-11-08')).toBe('2026-11-08');
    });
  });

  describe('formatClinicalDate()', () => {
    it('renders Gregorian calendar with Latin digits (0-9) in Arabic and English', () => {
      const arFormatted = formatClinicalDate('2026-03-15', 'ar');
      const enFormatted = formatClinicalDate('2026-03-15', 'en');

      expect(arFormatted).toMatch(/2026/);
      expect(enFormatted).toMatch(/2026/);
      // Ensure no Eastern Arabic-Indic digits (٠-٩)
      expect(arFormatted).not.toMatch(/[٠-٩]/);
      expect(enFormatted).not.toMatch(/[٠-٩]/);
    });
  });

  describe('computePatientAge()', () => {
    it('computes age dynamically from dateOfBirth relative to reference date', () => {
      const refDate = new Date(2026, 5, 15); // June 15, 2026
      expect(computePatientAge('1990-06-15', 20, refDate)).toBe(36);
      expect(computePatientAge('1990-06-16', 20, refDate)).toBe(35);
    });

    it('falls back to legacy age when dateOfBirth is missing or empty', () => {
      expect(computePatientAge(undefined, 42)).toBe(42);
      expect(computePatientAge('', 42)).toBe(42);
      expect(computePatientAge(undefined, undefined)).toBeUndefined();
    });
  });

  describe('ROM longitudinal matching (jointId + movementId + laterality + movementType)', () => {
    const makeRomEntry = (
      overrides: Partial<RomMeasurementEntry> & {
        movementType: 'AROM' | 'PROM';
        measuredAngleDegrees: number | null;
      }
    ): RomMeasurementEntry => ({
      entryId: `rom_${overrides.movementType}`,
      jointId: 'shoulder',
      jointNameAr: 'الكتف',
      jointNameEn: 'Shoulder',
      movementId: 'shoulder_flexion',
      movementNameAr: 'ثني الكتف',
      movementNameEn: 'Shoulder Flexion',
      laterality: 'right',
      isTested: true,
      ...overrides,
    });

    it('distinguishes AROM and PROM entries for the same joint, movement, and side', () => {
      const baselineEntries: RomMeasurementEntry[] = [
        makeRomEntry({ movementType: 'AROM', measuredAngleDegrees: 110 }),
        makeRomEntry({ movementType: 'PROM', measuredAngleDegrees: 145 }),
      ];

      const currentProm = makeRomEntry({ movementType: 'PROM', measuredAngleDegrees: 160 });
      const currentArom = makeRomEntry({ movementType: 'AROM', measuredAngleDegrees: 130 });

      const matchedProm = findMatchingBaselineRomEntry(baselineEntries, currentProm);
      const matchedArom = findMatchingBaselineRomEntry(baselineEntries, currentArom);

      expect(matchedProm).toBeDefined();
      expect(matchedProm?.movementType).toBe('PROM');
      expect(matchedProm?.measuredAngleDegrees).toBe(145);
      expect(compareLongitudinalRomEntries(matchedProm!, currentProm).deltaDegrees).toBe(15);

      expect(matchedArom).toBeDefined();
      expect(matchedArom?.movementType).toBe('AROM');
      expect(matchedArom?.measuredAngleDegrees).toBe(110);
      expect(compareLongitudinalRomEntries(matchedArom!, currentArom).deltaDegrees).toBe(20);
    });

    it('does not match AROM against PROM when movementType differs', () => {
      const baselineOnlyArom: RomMeasurementEntry[] = [
        makeRomEntry({ movementType: 'AROM', measuredAngleDegrees: 110 }),
      ];
      const currentProm = makeRomEntry({ movementType: 'PROM', measuredAngleDegrees: 150 });

      expect(findMatchingBaselineRomEntry(baselineOnlyArom, currentProm)).toBeUndefined();
      expect(
        compareLongitudinalRomEntries(baselineOnlyArom[0], currentProm).isComparable
      ).toBe(false);
    });
  });

  describe('MMT longitudinal matching', () => {
    const makeMmtEntry = (
      overrides: Partial<MmtMeasurementEntry>
    ): MmtMeasurementEntry => ({
      entryId: 'mmt_1',
      muscleGroupId: 'quadriceps',
      muscleNameAr: 'العضلة رباعية الرؤوس',
      muscleNameEn: 'Quadriceps',
      actionNameAr: 'بسط الركبة',
      actionNameEn: 'Knee Extension',
      laterality: 'left',
      isTested: true,
      gradeValue: '3+',
      gravityCondition: 'against_gravity',
      ...overrides,
    });

    it('matches MMT baseline by muscleGroupId + laterality and computes grade delta', () => {
      const baseline = makeMmtEntry({ gradeValue: '3+' });
      const current = makeMmtEntry({ gradeValue: '4+' });

      const matched = findMatchingBaselineMmtEntry([baseline], current);
      expect(matched).toBeDefined();

      const comp = compareLongitudinalMmtEntries(matched!, current);
      expect(comp.isComparable).toBe(true);
      expect(comp.rankDelta).toBe(3);
      expect(comp.baselineGrade).toBe('3+');
      expect(comp.currentGrade).toBe('4+');
    });
  });

  describe('Session numbering uniqueness', () => {
    it('computes max(sessionNumber) + 1 even when earlier drafts were deleted or manual numbers exist', () => {
      // Suppose sessions #1 and #2 were created, #2 was deleted, and #4 was manually numbered
      const existing = [
        { sessionNumber: 1, data: { sessionNumber: 1 } },
        { sessionNumber: 4, data: { sessionNumber: 4 } },
      ];
      expect(SessionService.computeNextSessionNumber(existing)).toBe(5);
      expect(SessionService.computeNextSessionNumber([])).toBe(1);
    });
  });

  describe('Synthetic patient seeds (fixed IDs)', () => {
    it('assigns a unique, non-empty deterministic id to every synthetic patient seed', () => {
      expect(SYNTHETIC_PATIENTS.length).toBeGreaterThan(0);
      const ids = SYNTHETIC_PATIENTS.map((p) => p.id);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.trim().length).toBeGreaterThan(0);
      }
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

