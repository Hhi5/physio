/**
 * Unified Date, Display Formatting, and Age Utilities for PhysioRecord.
 *
 * Ensures all clinical dates (session date, onset date, discharge date, assessment date)
 * use local calendar dates (critical for Iraq UTC+3 post-midnight charting) and all
 * date display uses Gregorian calendar with Latin digits ('ar-IQ-u-ca-gregory-nu-latn' / 'en-GB').
 */

/**
 * Returns a YYYY-MM-DD calendar date string in the user's local timezone.
 * If an ISO string or YYYY-MM-DD string is passed, parses it safely:
 * - If already YYYY-MM-DD, returns it directly.
 * - If an ISO timestamp, converts to local YYYY-MM-DD.
 */
export function localDate(input?: Date | string): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateParts(parsed);
    }
  }
  const d = input instanceof Date && !Number.isNaN(input.getTime()) ? input : new Date();
  return formatDateParts(d);
}

function formatDateParts(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type SupportedLocaleLang = 'ar' | 'en';

const LOCALE_MAP: Record<SupportedLocaleLang, string> = {
  ar: 'ar-IQ-u-ca-gregory-nu-latn',
  en: 'en-GB',
};

/**
 * Formats a date or timestamp using strictly Gregorian calendar + Latin digits.
 * Never uses 'ar-SA' (which defaults to Hijri) or 'ar-EG' / 'en-US'.
 */
export function formatClinicalDate(
  dateInput: string | Date | number | undefined | null,
  lang: SupportedLocaleLang = 'ar',
  options?: { includeTime?: boolean; monthFormat?: 'short' | 'numeric' | 'long' }
): string {
  if (!dateInput) return '—';

  let dateObj: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    dateObj = new Date(y, m - 1, d, 12, 0, 0);
  } else {
    dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
  }

  if (Number.isNaN(dateObj.getTime())) {
    return String(dateInput);
  }

  const locale = LOCALE_MAP[lang] || LOCALE_MAP.ar;
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: options?.monthFormat ?? 'short',
    day: 'numeric',
    ...(options?.includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  };

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * Computes patient age dynamically from `dateOfBirth` (YYYY-MM-DD),
 * falling back to legacy `fallbackAge` only when `dateOfBirth` is missing or invalid.
 */
export function computePatientAge(
  dateOfBirth?: string | null,
  fallbackAge?: number | null,
  referenceDate: Date = new Date()
): number | undefined {
  if (dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
    const [birthYear, birthMonth, birthDay] = dateOfBirth.trim().split('-').map(Number);
    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth() + 1;
    const refDay = referenceDate.getDate();

    let age = refYear - birthYear;
    if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
      age -= 1;
    }
    if (age >= 0 && age <= 130) {
      return age;
    }
  }

  if (typeof fallbackAge === 'number' && !Number.isNaN(fallbackAge) && fallbackAge >= 0) {
    return fallbackAge;
  }

  return undefined;
}
