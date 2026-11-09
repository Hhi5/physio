# PhysioRecord — Engineering Audit, Hardening & Clinical Unification Plan

## 1. Executive Summary & Confirmed Decisions

PhysioRecord is a local-first physiotherapy Electronic Health Record (EHR) built for clinicians in Iraq operating primarily on tablets and phones in offline-first environments, with an Arabic-first RTL and English interface backed by an encrypted IndexedDB vault.

Following a full audit of the repository against every item in the engineering brief, this plan documents which claims were verified as active issues, which items are already satisfied in the current architecture, and how each phase will be executed safely without losing existing local data.

### Confirmed Execution & Scope Decisions
- **Execution Pacing**: **Execute Phase 0 only first, then stop for review.** After completing Phase 0, we will provide the list of updated modules, verification results, and testing instructions, and wait for explicit approval before starting Phase 1.
- **Demo Seeding Restriction**: **Gate demo seeding behind development mode only.** The synthetic clinical dataset generator will only be accessible in development builds and will skip any patient record that already exists so existing patient data is never overwritten.
- **Parallel Views Handling**: **Fix Phase 0 hygiene issues across all active views first, then unify in Phase 3.** Date handling, strict TypeScript types, age calculation, and modal state stability will be corrected across all existing views in Phase 0, while screen consolidation and freezing secondary clinic administration modules behind a feature flag will occur in Phase 3.

---

## 2. Repository Verification Audit (Claims vs. Current Codebase)

Before planning changes, every claim in the brief was verified against the actual implementation:

### Phase 0 Verification
1. **Strict TypeScript & `any` usage (`Verified Issue`)**: Strict mode is currently disabled in the TypeScript configuration, and explicit `any` types exist across cryptographic utilities, database wrappers, clinical services, and UI components.
2. **UTC Date Bug via `.toISOString().split('T')[0]` (`Verified Issue`)**: Confirmed 24+ occurrences across session, episode, SOAP, and modal modules. For clinicians in Iraq (UTC+3), creating a session or episode between midnight and 03:00 AM local time records the previous day's date.
3. **Inconsistent Date Display Locales (`Verified Issue`)**: Confirmed usages of Saudi, Egyptian, and US locale codes across the patient directory, backup modal, and audit views. Saudi locale defaults can render Hijri dates instead of Gregorian dates.
4. **ROM & MMT Longitudinal Comparison Matching (`Verified Issue`)**:
   - **ROM**: Longitudinal baseline matching currently checks only Joint + Movement + Laterality and omits Movement Type (`AROM` vs. `PROM` vs. `AAROM`). When a baseline session records both `AROM` and `PROM` for the same joint movement (which the synthetic dataset itself creates), `.find()` returns the first entry (`AROM`) even when comparing against a `PROM` entry, causing the comparison engine to reject the pair or compute mismatched deltas.
   - **MMT**: Longitudinal baseline matching checks Muscle Group + Laterality without verifying matching Gravity Condition (`gravity_eliminated` vs. `against_gravity`).
5. **Patient Date of Birth vs. Static Age (`Verified Issue`)**: While the patient schema includes an optional birth date field, the patient directory, profile header, and forms still read and write a static `age` integer directly instead of computing age dynamically from Date of Birth with legacy `age` as a fallback.
6. **Session Numbering Uniqueness (`Partially Implemented — Edge Case Found`)**: The session service already uses an atomic database sequence table with HMAC tokens and releases numbers when draft sessions are deleted. However, candidate token pre-computation only checks a 30-slot window above the last sequence number, and the new-session modal previews `existingSessionCount + 1` instead of querying the true next sequence number when drafts have been deleted or manual numbers assigned.
7. **Modals Resetting While User Types (`Verified Issue`)**: Modal initialization hooks in the Episode, Session, and Patient modals depend on unstable object references or live session counts in their dependency arrays, causing form state to reset if a parent re-renders while the clinician is typing.
8. **Synthetic Data Seeding Overwriting Existing Patients (`Verified Issue`)**: The synthetic data loader searches for an existing patient by name and passes `existing?.id` into the save routine, overwriting existing patient records. It is also visible in production builds.
9. **Package Identity & Unused Dependencies (`Verified Issue`)**: The project package is still named `react-example`, includes unused server and AI dependencies (`@google/genai`, `express`, `dotenv`, `autoprefixer`, `esbuild`, `tsx`, `@types/express`) despite having no backend server, and lacks project documentation.

### Phase 1–5 Preview Verification
- **Password Key Derivation (`Already Implemented — Needs Only Legacy Guard`)**: Inspection of the vault cryptography module confirms that both primary vault unlocking and backup key derivation **already use `PBKDF2-HMAC-SHA256` with 600,000 iterations and a 16-byte random salt** (`v1.1` vault format), using `HKDF-SHA256` strictly as a secondary domain-separation step after PBKDF2 master key stretching. In Phase 1, we will preserve this implementation and only add a runtime check to upgrade any legacy vault metadata below 600,000 iterations.
- **Unencrypted LocalStorage in Secondary Clinic Views (`Verified Issue`)**: The clinic operations service stores scheduling, waitlist, and financial records in plaintext `localStorage` rather than the encrypted vault. This will be isolated and disabled by default in Phase 1/Phase 3.

---

## 3. Target Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                        PhysioRecord Client (Offline-First PWA)                    |
+-----------------------------------------------------------------------------------+
|  Presentation Layer (Arabic RTL / English LTR — Responsive Desktop/Tablet/Phone)  |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  |   Patient Directory   |  |   Patient Chart &      |  |   Session SOAP &     |  |
|  |   (Search, Triage,    |->|   Episodes of Care     |->|   Clinical Toolkit   |  |
|  |    Computed Age/DOB)  |  |   (Baseline vs Latest) |  |   (Body, ROM, MMT,   |  |
|  +-----------------------+  +------------------------+  |    Neuro, Addenda)   |  |
|                                                         +----------------------+  |
+-----------------------------------------------------------------------------------+
|  Domain & Shared Utilities Layer                                                  |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  |   Date & Age Engine   |  |   Longitudinal Match   |  |   Atomic Sequence    |  |
|  |   - localDate()       |  |   - ROM (Joint+Move+   |  |   Reservation        |  |
|  |   - Gregorian/Latin   |  |     Side+MovementType) |  |   - No collision on  |  |
|  |   - DOB -> Age calc   |  |   - MMT (+GravityCond) |  |     draft deletion   |  |
|  +-----------------------+  +------------------------+  +----------------------+  |
+-----------------------------------------------------------------------------------+
|  Zero-Knowledge Cryptographic Vault & Persistence Layer                           |
|  +-----------------------------------------------------------------------------+  |
|  | WebCrypto API: PBKDF2-HMAC-SHA256 (600k iter) -> KEK -> AES-256-GCM DEK     |  |
|  | HMAC-SHA256 Blind Indexing + Authenticated Additional Data (AAD)            |  |
|  +-----------------------------------------------------------------------------+  |
|  | IndexedDB (Dexie Versioned Stores: Patients, Episodes, Sessions, SOAP, etc.)|  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Phased Implementation Roadmap

> **Note on Execution**: Upon approval of this plan, **only Phase 0 will be executed**. At the end of Phase 0, execution will pause with a full summary of modified modules and verification steps.

### Phase 0 — Bugs, Strict Type Safety, Date Accuracy & Hygiene (Immediate Execution)
1. **Strict TypeScript Compilation**:
   - Enable `"strict": true` in the TypeScript configuration.
   - Replace all explicit and implicit `any` usages across cryptography, database schemas, services, contexts, and UI components with strongly typed interfaces and type guards.
2. **Local Timezone Date Helper (`localDate`)**:
   - Create a unified `localDate(date?: Date): string` utility using local year, month, and day values (`YYYY-MM-DD`) so post-midnight charting in Iraq (UTC+3) always records the accurate local calendar date.
   - Replace all 24+ occurrences of `new Date().toISOString().split('T')[0]` across services, modals, drawers, and views.
3. **Unified Gregorian + Latin Digit Date Formatter**:
   - Create a single date/time display formatter supporting `'ar-IQ-u-ca-gregory-nu-latn'` for Arabic and `'en-GB'` for English.
   - Remove all `'ar-SA'`, `'ar-EG'`, and `'en-US'` date formatting calls so dates never unexpectedly render in Hijri or inconsistent month-first formats.
4. **Longitudinal ROM & MMT Matching + Unit Tests**:
   - Update baseline-to-latest ROM matching to require identical `jointId + movementId + laterality + movementType` (`AROM`, `PROM`, `AAROM`).
   - Update longitudinal MMT matching to require identical `muscleGroupId + laterality` and compatible `gravityCondition`, extracting pure comparison helpers.
   - Add automated unit tests covering `localDate()`, ROM longitudinal matching (including mixed AROM/PROM baselines), and MMT longitudinal comparison.
5. **Patient Date of Birth & Dynamic Age Calculation**:
   - Add a `computePatientAge(dateOfBirth?: string, legacyAge?: number)` utility that calculates exact age from `dateOfBirth` and falls back to `legacyAge` only when `dateOfBirth` is absent.
   - Update patient creation/editing forms to capture `dateOfBirth` primarily (with an optional quick-age converter that populates birth year if only age is known) and update all patient cards, headers, and episode summaries to display computed age.
6. **Session Numbering Uniqueness**:
   - Refine atomic sequence allocation so manual session numbers and deleted drafts never collide even beyond a 30-session window, and ensure the new-session modal previews the true next unique session number for the episode.
7. **Modal Form State Stability**:
   - Refactor initialization effects in Patient, Episode, Session, SOAP, and Addendum modals/drawers to trigger strictly on modal open transition (`isOpen` becoming `true` or target record ID changing), preventing background parent re-renders from wiping user input mid-typing.
8. **Safe Development-Only Demo Seeding**:
   - Restrict the synthetic data generator trigger and modal to `import.meta.env.DEV`.
   - Change seeding logic so that if a patient with the same name or identifier already exists, that record is skipped rather than overwritten.
9. **Package Hygiene & Documentation**:
   - Rename the package to `"physiorecord"`.
   - Remove unused server and AI packages (`@google/genai`, `express`, `dotenv`, `autoprefixer`, `esbuild`, `tsx`, `@types/express`) and add `vitest` for running unit tests.
   - Write a clear `README.md` covering architecture, local development, testing, and security principles.

---

### Phase 1 — Security Verification & Hardening (After Phase 0 Approval)
1. **KDF Verification & Legacy Upgrade Guard**: Confirm `PBKDF2-HMAC-SHA256` (>= 600,000 iterations, 16-byte random salt) across vault and backup headers, and add transparent re-wrapping if an older vault with fewer iterations is unlocked.
2. **Password Policy**: Enforce a minimum password length of 10 characters on vault setup, password change, and backup encryption, with a clear, non-blocking strength indicator.
3. **Recovery Key at Vault Setup**: Generate a random 256-bit recovery key displayed once as a formatted recovery code during initial vault setup (and regenerable from Settings), wrapping the master DEK independently so clinicians can recover their vault if a password is forgotten.
4. **Configurable Auto-Lock & Background Lock**: Default inactivity auto-lock to 10 minutes (configurable in Settings: 5 / 10 / 15 / 30 min) and lock automatically when the application tab remains hidden in the background beyond a short grace threshold.
5. **Eliminate Unencrypted LocalStorage Clinical Data**: Ensure no clinical or scheduling data is written to plaintext `localStorage`.
6. **Honest Security Copy**: Remove exaggerated marketing badges (such as "Zero-Trust Encryption") from the UI in favor of clear, factual descriptions of local AES-256-GCM encryption.

---

### Phase 2 — Clinical Data Model & Workflow Integrity (After Phase 1 Approval)
1. **Explicit Episode Link**: Ensure every session stores and validates a mandatory `episodeId`, migrating any legacy unlinked sessions into an initial episode automatically without data loss.
2. **Enforce Signed Session Immutability at Service Layer**: Enforce in the session and SOAP services that once a session status is `signed` or `completed`, direct edits and deletions are rejected; modifications can only occur via append-only `SoapAddendum` records.
3. **Quick Copy Forward ("Same as Last Session")**: Add a single-action button when creating a new draft session in an episode to pre-fill subjective/objective structure, ROM/MMT baselines, and treatment plan fields from the previous session in that episode for rapid editing.
4. **Printable Bilingual Patient Summary**: Add a clean, print-styled (`@media print`) summary view for an Episode of Care (Patient demographics, diagnosis, baseline vs. latest ROM/MMT table, VAS pain trend, and discharge/progress summary) formatted for A4 printing or PDF export in Arabic RTL and English LTR.

---

### Phase 3 — UI Consolidation & Screen Simplification (After Phase 2 Approval)
1. **Single Canonical Flow**: Consolidate the overlapping layout wrappers and duplicate views into one coherent clinician workflow:
   - **Screen 1**: Patient Directory (search, triage filter, add patient).
   - **Screen 2**: Patient Profile & Episodes of Care (episode selector, longitudinal ROM/MMT & pain progress, session timeline, print summary).
   - **Screen 3**: Session Workspace & SOAP Documentation (structured SOAP editor, collapsible clinical shelf for Body Map, ROM/MMT, Neuro screening, and signed addenda).
2. **Single Modal Implementation**: Retire duplicate drawer vs. modal variants so each entity (Patient, Episode, Session, Addendum) has exactly one clean, accessible modal implementation.
3. **Feature Flag for Secondary Clinic Admin Modules**: Freeze the multi-screen clinic reception/billing/RBAC showcase views behind an explicit feature flag (`VITE_ENABLE_CLINIC_ADMIN=false` by default) so the core clinician EHR remains fast, focused, and clutter-free.

---

### Phase 4 — Offline PWA & Backup Reliability (After Phase 3 Approval)
1. **Offline Service Worker & Manifest**: Configure a production PWA manifest and service worker caching all application shell assets, fonts, and icons for reliable offline tablet and phone operation in Iraqi clinics.
2. **Backup Reminder & Atomic Restore Verification**: Track the last encrypted backup timestamp, show a subtle non-intrusive reminder banner when more than 7 days have passed (or 20+ new records created), and ensure backup restore validates schema integrity inside a transaction before swapping data.

---

### Phase 5 — Final Verification, Tests & Polish (After Phase 4 Approval)
1. **Unit & Integration Test Suite**: Expand unit tests to cover vault crypto round-trips, PBKDF2/HKDF backup key derivation, signed session immutability, longitudinal ROM/MMT comparisons, and date utilities.
2. **RTL & Responsive Audit**: Verify touch targets (>= 44px), logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`), and clean responsive behavior across Phone (375px), Tablet (768px–1024px), and Desktop viewports.
