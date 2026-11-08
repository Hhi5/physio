# PhysioRecord Enterprise EHR & Physical Therapy Clinic Management System (R&D & Re-Engineering Blueprint)

A complete Research & Development study and architectural re-engineering plan transforming **PhysioRecord** into a specialized **Physical Therapy EHR/EMR & Iraqi Clinic Management System** modeled after global rehabilitation platforms (**Prompt EMR, WebPT, Jane App, Cliniko, Practice Perfect EMR**) and tailored to Iraqi clinical and financial workflows (**IQD billing, multi-session packages, partial cash payments, patient debt ledger, and clinic expenses**).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core architectural decisions have been confirmed from your answers and govern the entire re-engineering specification:

- **Confirmed Decision 1 — Modular Workspace Switcher (Clinical EHR vs. Reception Admin Mode)**: The sidebar and top workspace bar provide a seamless mode switcher between **Clinical EHR Mode** (Patient Directory, Patient-Centric Profile Hub, Episode-Scoped Assessments, Session Flowsheets, Exercise Library & HEP Builder) and **Reception & Clinic Admin Mode** (Reception Command Dashboard, Daily/Weekly Therapist Appointment Calendar & Waiting List, Iraqi IQD Financial Ledger & Packages, Clinic Expenses, and Analytics Reports).
- **Confirmed Decision 2 — Strict Episode-Scoped Clinical Assessments & Longitudinal Flowsheets**: Every injury or condition is strictly isolated inside its own **Episode of Care**. Initial Evaluations, Re-evaluations, SOAP Notes, Outcome Measures (`ODI`, `NDI`, `SPADI`, `LEFS`, `QuickDASH`, `PSFS`), and Exercise Flowsheets belong to a specific Episode and Visit—eliminating cross-episode data mixing and enabling side-by-side longitudinal comparison tables across **Initial Evaluation → Re-evaluation → Daily Sessions**.
- **Confirmed Decision 3 — Iraqi Clinic Financial Model (`IQD` Primary Currency)**: Built natively for Iraqi private physical therapy clinics using **Iraqi Dinar (`IQD` / `د.ع`)** as the primary currency, supporting per-session billing, multi-session rehabilitation packages (e.g., 6, 10, or 12-session bundles), cash and partial payments, automated patient debt/balance tracking, daily clinic expense logging, and clean financial summaries without US Medicare/insurance bloat.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an end-to-end encrypted Physical Therapy Electronic Health Record (EHR) and Clinic Operations Platform combining patient-centric longitudinal charting, structured biomechanical assessments (AROM/PROM, MMT, Special Tests, Dermatomes, NPRS Pain Mapping, Standardized Outcome Measures), exercise prescription flowsheets with printable Home Exercise Programs (HEP), appointment scheduling with waiting list management, Iraqi Dinar (`IQD`) billing/debt ledgers, and Role-Based Access Control (RBAC) with immutable clinical audit trails.
- **Target Audience / Persona**: Physical therapists (`Senior PT`, `Assistant PT`), clinic directors (`Admin`), and front-desk coordinators (`Receptionist`) in modern Iraqi rehabilitation and orthopedic physical therapy centers.
- **Key Value**: Bridges the gap between front-desk reception operations (appointments, waitlist, IQD package collections, patient debt balances) and high-speed clinical documentation (Episode-isolated Initial Evaluations, longitudinal ROM/MMT/Outcome progression tables, and carried-forward Exercise Flowsheets).

---

## 2. Phase 1 & Phase 2 — Reference Systems Study & 22-Dimension Comparative Analysis

### A. Reference Systems Studied (Evidence & Scope Disclosure)

1. **Prompt EMR (`prompthealth.com`)**: Analyzed official Physical Therapy specialty documentation and product walkthroughs. Prompt excels at **intake-to-evaluation synchronization** and **Visit-to-Visit Exercise Flowsheets**, where prescribed exercises, sets, reps, load, and objective baselines carry forward across sessions in a tabular grid rather than requiring repetitive free-text typing.
2. **WebPT (`webpt.com/products/emr`)**: Analyzed WebPT's rehabilitation documentation structure. WebPT sets the industry standard for the **Initial Evaluation → Progress Note / Re-evaluation → Discharge Summary** clinical lifecycle, linking standardized **Outcome Measures** (`ODI`, `NDI`, `LEFS`, `QuickDASH`, `SPADI`, `PSFS`) directly to measurable Short-Term Goals (STG) and Long-Term Goals (LTG).
3. **Jane App (`jane.app` & Chart Template Library)**: Analyzed Jane's scheduling interface and physical therapy chart templates. Jane excels at **side-by-side split-screen charting** (viewing previous notes or initial eval baselines alongside the active session), interactive **Body Charts**, and a clean **Multi-Practitioner Calendar with Integrated Waitlist**.
4. **Cliniko (`cliniko.com/features`)**: Analyzed Cliniko's clinic management workflows. Cliniko excels at **Reception Clarity**: one-click transition from an appointment card to invoice creation, clear **Patient Financial Summaries** inside the patient profile, and rapid **Waiting List** slot filling.
5. **Practice Perfect EMR (`practiceperfectemr.com/features`)**: Analyzed Practice Perfect's operational and financial controls. Practice Perfect excels at **Patient Account Ledgers** (tracking total charges, partial payments, remaining package visits, and outstanding debt balances on a single screen) as well as strict **Role-Based Security & Finalized Note Locks**.

> [!NOTE]
> *Transparency Note*: Publicly accessible product documentation, official feature galleries, workflow guides, and Jane's public chart template structures were inspected directly. Private authenticated sandboxes behind enterprise sales walls were not accessed; all workflow patterns below are derived from verified public product specifications and clinical PT documentation standards.

### B. Comparative Matrix Across 22 Clinical & Operational Dimensions

| # | Dimension | Best Reference Benchmark | Why It Excels | How We Apply It in PhysioRecord |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Dashboard & Reception** | **Cliniko + Prompt EMR** | Combines today's arrival queue, therapist load, waitlist matches, and unpaid balances on one actionable screen. | Build a **Reception & Clinical Command Center** showing today's appointments by status, active waitlist, unpaid IQD balances, and unfinalized notes. |
| **2** | **Patient Management** | **Cliniko** | Fast search by name/phone/ID with immediate visibility into active episode, last visit, and account balance. | Enhance the **Patient Directory** with multi-filter search, active episode indicators, remaining package sessions, and outstanding IQD debt badges. |
| **3** | **Patient Profile Hub** | **Jane App + Cliniko** | Acts as the permanent demographic, medical safety, attachment, and financial hub above individual episodes. | Expand **Patient Profile** to house Personal Info, Medical History, Allergies, Medications, Precautions/Contraindications, Referring Physician, Emergency Contact, Attachments, and IQD Financial Summary. |
| **4** | **Episodes of Care** | **WebPT** | Strictly isolates each injury/condition (e.g., *Right ACL Reconstruction* vs. *Cervical Radiculopathy*) with its own timeline. | Enforce **Strict Episode Isolation**: every Evaluation, Reassessment, Goal set, HEP, and Session belongs to one Episode with an Episode Switcher bar. |
| **5** | **Clinical Documentation** | **Jane App** | Modular, structured clinical blocks combined with fast narrative templates and split-screen historical context. | Replace unencrypted global widget state with **Episode- & Session-Scoped Encrypted Documentation** and historical baseline comparison. |
| **6** | **Initial Evaluation** | **WebPT + Prompt EMR** | Guides the PT through Subjective (HPI, MOI, Aggravating/Relieving), Objective, Outcome Scales, Clinical Impression, and Plan of Care. | Create a dedicated **Initial Evaluation Workflow** capturing complete Subjective/Objective baselines, Initial Outcome Score, Diagnosis, STG/LTG, and Treatment Plan. |
| **7** | **SOAP Notes** | **Prompt EMR** | Auto-loads previous baselines and active goals so daily SOAP documentation takes under 2 minutes. | Upgrade **SOAP Note Editor** with structured Subjective delta, Objective deltas, Intervention summary, and one-click Sign & Lock. |
| **8** | **ROM & MMT** | **WebPT** | Bilateral comparison (`Left` vs. `Right`, `AROM` vs. `PROM`, `MMT 0–5`, pain on motion) with normal reference degrees. | Upgrade **Objective ROM/MMT Module** with bilateral tables, normal reference indicators, and automatic delta calculation (`+18°` vs. Initial Eval). |
| **9** | **Special Tests** | **WebPT** | Organized by anatomical region with sensitivity/specificity context and `Positive / Negative / Inconclusive` bilateral grading. | Keep and link **Orthopedic Special Tests** directly to the active Episode's anatomical region and longitudinal comparison table. |
| **10** | **Pain Assessment** | **Jane App** | Interactive Anterior/Posterior/Lateral body map paired with NPRS (0–10) at rest, on activity, worst/best, and pain quality. | Enhance **Pain Assessment** with NPRS tracking across visits, pain nature/distribution, and longitudinal pain trend charts. |
| **11** | **Functional Assessment** | **WebPT** | Region-specific validated questionnaires (`ODI`, `NDI`, `SPADI`, `LEFS`, `QuickDASH`, `PSFS`) scored as percentages with MCID tracking. | Build a comprehensive **Outcome Measures Engine** supporting `ODI`, `NDI`, `SPADI`, `LEFS`, `QuickDASH`, and `PSFS` with score history per Episode. |
| **12** | **Goal Tracking** | **WebPT + Prompt EMR** | Structured **Short-Term Goals (STG)** and **Long-Term Goals (LTG)** linked to measurable ROM/MMT/Pain/Functional targets and deadlines. | Upgrade **Goal Tracking** to classify goals into `Short-Term (2–4 wks)` and `Long-Term (6–12 wks)` with target metrics, % progress bars, and status. |
| **13** | **Treatment Plans** | **Prompt EMR** | Defines treatment frequency (e.g., `3x/week for 4 weeks`), planned modalities, manual therapy, and progression phases. | Add a structured **Plan of Care (POC)** section inside each Episode defining frequency, duration, rehabilitation phase, and precautions. |
| **14** | **Daily Treatment Sessions** | **Prompt EMR** | Tabular **Exercise & Modality Flowsheet** carrying forward the patient's program so PTs log sets, reps, weight, hold, and response rapidly. | Build an interactive **Session Flowsheet** logging Therapeutic Exercises (`Sets × Reps × Hold × Load/Band`), Manual Therapy grades, and Physical Agents. |
| **15** | **Exercise Prescription & HEP** | **Prompt EMR + Jane** | Searchable exercise library by body region, goal, and equipment that compiles into a patient-friendly Home Exercise Program (HEP). | Build a searchable **PT Exercise Library & HEP Builder** with bilingual (Arabic/English) patient instructions, dosage, and printable HEP view. |
| **16** | **Progress Reports** | **WebPT** | Summarizes Initial Eval vs. Current Status across Pain, ROM, MMT, Outcome Scores, and Goal Achievement for referring physicians. | Create an automated **Longitudinal Progress & Physician Report** view comparing Initial Eval vs. Re-evaluations vs. Latest Session. |
| **17** | **Reassessment** | **WebPT** | Periodic re-evaluation visit (e.g., every 6th or 10th session) that snapshots updated ROM, MMT, and Outcome Scores against baseline. | Support formal **Re-evaluation Visits** (`re_evaluation` session type) that record a new clinical snapshot and update the Longitudinal Comparison Matrix. |
| **18** | **Discharge Summary** | **WebPT** | Formal episode closure capturing final outcome scores, goals met, reason for discharge, and ongoing home maintenance plan. | Build a structured **Discharge Summary Workflow** when closing an Episode, recording discharge reason, final metrics, and post-discharge HEP. |
| **19** | **Appointment Scheduling** | **Jane App + Cliniko** | Multi-therapist calendar with status badges (`Scheduled`, `Arrived`, `In Session`, `Completed`, `Cancelled`, `No-Show`) and Waitlist sidebar. | Build the **Appointment Calendar & Waiting List Module** linked directly to patients, episodes, therapists, and session creation. |
| **20** | **Financial Management** | **Practice Perfect + Cliniko** | Clear patient ledger showing session charges, package deductions, partial cash payments, outstanding debt, and clinic expenses. | Build the **Iraqi Clinic Financial System (`IQD`)** supporting single-session billing, multi-session packages, partial cash payments, debt ledger, and clinic expenses. |
| **21** | **Reports & Analytics** | **Practice Perfect** | Actionable clinic KPIs: completed visits, attendance/no-show rate, active episodes, total IQD collected, outstanding debt, and net revenue. | Build the **Clinic Reports & Analytics Dashboard** with clinical, operational, and Iraqi financial performance breakdowns. |
| **22** | **User Roles & Permissions** | **Practice Perfect** | Role-based access (`Admin`, `Senior PT`, `Assistant PT`, `Receptionist`) + immutable audit logs + Sign & Lock with formal Addenda. | Implement **RBAC Role Guardrails & Immutable Audit Log** alongside existing SHA-256 note finalization and `ClinicalAddendum` records. |

---

## 3. Phase 3 — Audit of Current Project (`PhysioRecord`)

### A. What Currently Exists & Works Well
- **Cryptographic & Local-First Core**: AES-256-GCM envelope encryption, PBKDF2 key derivation, BIP-39 recovery phrase, and Dexie IndexedDB tables (`patients`, `episodes`, `sessions`, `soapNotes`, `clinicalAddenda`, `episodeSequences`).
- **Clinical Design Tokens & OrganUI Visuals**: Crisp Clinical Light Mode + Dark Mode toggle, `OrganDermatomeMap`, `OrganMedicationSchedule`, `OrganClinicalCharts`, and interactive SVG Body Chart.
- **Note Finalization & Addenda**: Cryptographic SHA-256 digest signing on SOAP notes with post-finalization `ClinicalAddendum` creation.

### B. Critical Architectural & Functional Deficiencies Identified
1. **Cross-Episode Data Contamination (Major Bug)**: Currently, clinical widgets (`bodyChart`, `objective`, `specialTests`, `gaitPosture`, `functionalScales`) are saved in unencrypted `localStorage` under `physiorecord_patient_widgets_${patient.id}`. If a patient has two Episodes of Care (e.g., Episode 1: *Lumbar Disc Herniation*, Episode 2: *Right Shoulder Impingement*), their clinical exams overwrite each other and bypass AES-256-GCM Episode/Session storage.
2. **No Longitudinal Baseline vs. Reassessment Comparison**: Because objective measurements are overwritten in a single state object rather than stored as timestamped Episode/Visit snapshots, therapists cannot view a side-by-side table comparing **Initial Evaluation vs. Re-evaluation #1 vs. Latest Session**.
3. **Incomplete Patient Profile**: Missing Referring Physician, Referring Clinic/Hospital, Emergency Contact (Name, Relation, Phone), Contraindications/Precautions, Clinical Attachments/Documents, and Patient Financial Summary (`IQD` billed, paid, debt balance).
4. **Incomplete Outcome Measures**: Currently only `QuickDASH` is implemented. Standard PT scales (`ODI`, `NDI`, `SPADI`, `LEFS`, `PSFS`) are missing.
5. **Free-Text Session Interventions Instead of Flowsheets**: `TreatmentSessionView` relies on a single free-text textarea with 7 static chips instead of a structured **Exercise & Modality Flowsheet** (`Sets`, `Reps`, `Hold`, `Resistance/Weight`, `Manual Therapy Grade`, `Physical Agents`) and lacks a searchable **Exercise Library & HEP Builder**.
6. **Zero Clinic Operations & Iraqi Financial Management**: No Reception Dashboard, no Appointment Calendar, no Waiting List, no `IQD` Invoicing / Multi-Session Packages / Partial Cash Payment / Debt Ledger, no Clinic Expense tracker, no Operational Reports, and no RBAC / Audit Log UI.

---

## 4. User Experience & Visual Design (Phase 8 Compliance)

- **Key User Flows**:
  1. **Reception & Front-Desk Flow**: Receptionist opens **Reception Mode** → views today's **Appointment Calendar & Arrival Queue** → registers a new patient or marks an arriving patient as `Arrived` → collects a full or partial payment in `IQD` (or deducts 1 visit from an active 10-session package) → logs any daily clinic expense.
  2. **Initial Evaluation Flow**: Physical Therapist opens **Clinical EHR Mode** → selects the Patient → opens or creates an isolated **Episode of Care** → completes the structured **Initial Evaluation** (Subjective HPI/MOI/Aggravating-Relieving, Pain Map & NPRS, Bilateral ROM/MMT, Special Tests, Outcome Measure `ODI`/`NDI`/`SPADI`/`LEFS`/`QuickDASH`/`PSFS`, Clinical Impression, Short-Term & Long-Term Goals, and Plan of Care) → signs & locks the Initial Evaluation.
  3. **Daily Treatment Session & Flowsheet Flow**: Therapist starts a **Treatment Session** (or **Re-evaluation**) inside the Episode → previous Exercise Flowsheet rows automatically carry forward → therapist adjusts `Sets × Reps × Hold × Weight/Band`, logs Manual Therapy & Physical Agents, records pre/post session NPRS pain, updates the **Home Exercise Program (HEP)**, and signs/locks the note.
  4. **Longitudinal Comparison & Discharge Flow**: At any point, the therapist switches to the **Longitudinal Progress & Comparison Tab** to inspect side-by-side tables and charts comparing **Initial Eval → Re-evals → Latest Visit** across ROM, MMT, Pain, and Outcome Scores, and generates a structured **Discharge Summary** upon completion.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-precision clinical SaaS workspace inspired by Prompt EMR, Jane App, and Linear—prioritizing tabular scannability, zero visual clutter, and rapid keyboard/mouse clinical entry.
  - *Color Palette & Mood*: 60% crisp clinical neutral canvas (`#F8FAFC` light / `#090D16` dark), 30% clean structural surfaces (`#FFFFFF` / `#0F172A` with `1px` `#E2E8F0` / `#1E293B` borders), and 10% clinical teal accent (`#0D9488`) plus semantic clinical status indicators (`#16A34A` improvement/paid, `#D97706` precaution/partial payment, `#DC2626` red flag/contraindication/debt overdue).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` for crisp clinical headers and bilingual UI navigation (`15px–24px`), paired with `JetBrains Mono` (`tabular-nums`) for all ROM degrees (`165°`), MMT grades (`4+/5`), Outcome scores (`42%`), and Iraqi Dinar financial figures (`250,000 د.ع`).
  - *Bilingual Clinical Ergonomics*: Seamless Arabic interface labels for reception, patient instructions (HEP), and financial receipts, paired with internationally standard English medical terminology (`AROM`, `PROM`, `MMT`, `NPRS`, `ODI`, `SPADI`, `SOAP`) for clinical charting.

---

## 5. Key Product Decisions & Trade-Offs

- **Decision 1 — Episode-Scoped Assessment Snapshots vs. Global Patient Widget State**
  - *Chosen Approach*: Store all clinical assessments, ROM/MMT tables, special tests, outcome scores, and exercise flowsheets inside Episode-scoped and Session-scoped records rather than a single patient-level `localStorage` key.
  - *Why*: Guarantees strict separation between different injuries/episodes and enables accurate longitudinal comparison across Initial Evaluation, Re-evaluations, and Daily Sessions.
- **Decision 2 — Carry-Forward Exercise Flowsheet + Searchable HEP Builder**
  - *Chosen Approach*: Embed a structured Exercise & Modality Flowsheet in every session with a `"Copy Previous Session Flowsheet"` action and link it to a searchable PT Exercise Library (organized by Anatomical Region, Therapeutic Goal, and Modality) that exports a bilingual patient Home Exercise Program (HEP).
  - *Why*: Eliminates repetitive data entry during busy clinic hours while giving patients a clear, structured home rehabilitation plan tied to their Episode goals.
- **Decision 3 — Iraqi Dinar (`IQD`) Ledger & Multi-Session Packages**
  - *Chosen Approach*: Purpose-built financial ledger in `IQD` supporting single sessions, prepaid/installment session packages (e.g., 6 or 12 sessions), partial cash payments, automated patient debt balances, and clinic operating expenses.
  - *Why*: Matches real-world Iraqi private physical therapy clinic operations directly without irrelevant US insurance clearinghouse or CPT/8-minute rule complexity.

---

## 6. Technical Architecture & Data Strategy *(Technical Reference)*

### A. System Architecture & Component Hierarchy Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     PhysioRecord Cryptographic & Persistence Layer                        │
│  ┌─────────────────────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Encrypted Dexie IndexedDB Vault         │  │ Clinic Operations & Audit Store        │ │
│  │ • Patients (Demographics, Meds, Alerts) │  │ • Appointments & Waiting List          │ │
│  │ • Episodes of Care (Isolated Timelines) │  │ • IQD Invoices, Packages & Payments    │ │
│  │ • Sessions & Signed SOAP / Snapshots    │  │ • Clinic Expenses (Daily/Monthly IQD)  │ │
│  │ • Clinical Addenda (SHA-256 Verified)   │  │ • RBAC Role State & Immutable AuditLog │ │
│  └────────────────────┬────────────────────┘  └───────────────────┬────────────────────┘ │
└───────────────────────┼───────────────────────────────────────────┼──────────────────────┘
                        ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                App Shell: Sidebar + Mode Switcher + RBAC Role Guard                      │
├───────────────────────────────────────────┬──────────────────────────────────────────────┤
│         CLINICAL EHR WORKSPACE            │        RECEPTION & CLINIC ADMIN MODE         │
│                                           │                                              │
│ ┌───────────────────────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ 1. Patient Directory & Central Hub    │ │ │ 1. Reception Command Dashboard           │ │
│ │  • Demographics, Referring MD, EmgCy  │ │ │  • Today's Queue, Waitlist, Alerts, KPIs │ │
│ │  • Medical History, Allergies, Meds   │ │ └──────────────────────────────────────────┘ │
│ │  • Contraindications & Attachments    │ │ ┌──────────────────────────────────────────┐ │
│ │  • Patient IQD Financial Summary      │ │ │ 2. Appointment Calendar & Waiting List   │ │
│ └───────────────────┬───────────────────┘ │ │  • Multi-Therapist Schedule & Statuses   │ │
│                     ▼                     │ │  • 1-Click Check-In / Start Session      │ │
│ ┌───────────────────────────────────────┐ │ │  • Waiting List Slot Matching            │ │
│ │ 2. Isolated Episode of Care Workspace │ │ └──────────────────────────────────────────┘ │
│ │  • Episode Switcher (Strict Isolation)│ │ ┌──────────────────────────────────────────┐ │
│ │  • Initial Eval (Subj/Obj/POC/Goals)  │ │ │ 3. Iraqi Financial Ledger (IQD / د.ع)    │ │
│ │  • Validated Outcomes (ODI, NDI,      │ │ │  • Single Visit & Multi-Visit Packages   │ │
│ │    SPADI, LEFS, QuickDASH, PSFS)      │ │ │  • Cash & Partial Payments Collection    │ │
│ │  • Longitudinal Comparison Matrix     │ │ │  • Patient Debt Ledger & Receipts        │ │
│ │    (Eval vs Re-eval vs Latest Visit)  │ │ │  • Clinic Expenses & Net Profit Reports  │ │
│ │  • Daily Session Exercise Flowsheet   │ │ └──────────────────────────────────────────┘ │
│ │    (Sets×Reps×Hold×Load + Modalities) │ │ ┌──────────────────────────────────────────┐ │
│ │  • Discharge Summary & Outcome Lock   │ │ │ 4. Exercise Library, Analytics & Audit   │ │
│ └───────────────────────────────────────┘ │ │  • Searchable PT Exercise & HEP Catalog  │ │
│                                           │ │  •RBAC Permissions & Security Audit Log  │ │
│                                           │ └──────────────────────────────────────────┘ │
└───────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### B. Data Model & Domain Entities

1. **Enhanced `PatientClinicalData` (Central Patient Hub)**:
   - Adds `referringPhysician`, `referringClinic`, `emergencyContactName`, `emergencyContactRelation`, `emergencyContactPhone`, `contraindications` (e.g., pacemaker, DVT history, osteoporosis), `precautions` (e.g., weight-bearing status `NWB / PWB / WBAT`), and `attachments` (metadata + base64/URI for X-ray/MRI reports and referrals).
2. **Isolated `EpisodeClinicalData` & Longitudinal `ClinicalAssessmentSnapshot`**:
   - Scoped strictly by `episodeId`. Stores:
     - **Subjective Baseline**: `chiefComplaint`, `historyOfPresentIllness` (HPI), `mechanismOfInjury`, `painCharacteristics` (rest, activity, worst, best NPRS 0–10, nature, 24h pattern), `aggravatingFactors`, `relievingFactors`, `functionalLimitations`, `patientGoals`.
     - **Objective Baseline & Snapshots**: `observation`, `postureGait`, `palpation`, bilateral `rom` & `mmt` entries, `neuro` (dermatomes, myotomes, reflexes), `specialTests`, `clinicalMeasurements` (circumference/edema, leg length, timed tests like TUG / 5xSTS).
     - **Standardized Outcome Measures (`OutcomeMeasureRecord[]`)**: Supports `ODI` (Oswestry Disability Index), `NDI` (Neck Disability Index), `SPADI` (Shoulder Pain and Disability Index), `LEFS` (Lower Extremity Functional Scale), `QuickDASH`, and `PSFS` (Patient-Specific Functional Scale) with item responses, calculated score (`0–100%` or `0–80`), clinical interpretation, and timestamp linked to `Initial Eval`, `Re-evaluation`, or `Discharge`.
     - **Clinical Impression & Plan of Care**: `clinicalImpression`, `functionalProblems`, `shortTermGoals` (`STG`), `longTermGoals` (`LTG`), `treatmentFrequency` (e.g., `3 sessions/week`), `plannedDurationWeeks`, and `dischargeSummary` (final status, goals achieved, discharge reason, final outcome delta).
3. **Structured Session Flowsheet (`SessionFlowsheetData`) & HEP (`HepPrescription`)**:
   - Each session stores an array of `FlowsheetExerciseEntry` (`exerciseId`, `name`, `category`, `sets`, `reps`, `holdSeconds`, `loadKgOrBand`, `rpeOrPainResponse`, `notes`), `ManualTherapyEntry` (`technique`, `jointOrRegion`, `grade`, `durationMinutes`), and `PhysicalAgentEntry` (`modality`: TENS, Ultrasound, NMES, Dry Needling, Laser, Cryo/Thermo, `parameters`, `durationMinutes`).
   - Episode-level `HepPrescription` stores assigned home exercises with Arabic/English instructions, frequency per day/week, and completion tracking.
4. **Clinic Operations, Iraqi Financial Ledger (`IQD`) & RBAC Audit Store**:
   - `ClinicAppointment`: `id`, `patientId`, `episodeId`, `therapistName`, `date`, `startTime`, `durationMinutes`, `visitType` (`initial_eval`, `follow_up`, `re_evaluation`, `discharge`), `status` (`scheduled`, `arrived`, `in_session`, `completed`, `cancelled`, `no_show`), `notes`.
   - `WaitingListEntry`: `id`, `patientId`, `patientName`, `phone`, `preferredDays`, `preferredTimeSlot`, `priority` (`urgent`, `normal`), `anatomicalRegion`, `addedAt`.
   - `FinancialInvoiceIQD`: `id`, `patientId`, `episodeId`, `sessionId`, `invoiceType` (`single_session` | `package`), `description`, `totalAmountIQD`, `discountIQD`, `netAmountIQD`, `paidAmountIQD`, `balanceDueIQD` (`netAmountIQD - paidAmountIQD`), `status` (`paid` | `partial` | `unpaid`), `packageTotalSessions`, `packageUsedSessions`, `payments` (`PaymentTransactionIQD[]` with timestamp, amount in `IQD`, method `cash` | `zain_cash` | `qi_card`, receivedBy).
   - `ClinicExpenseIQD`: `id`, `date`, `category` (`rent`, `equipment`, `consumables`, `salaries`, `utilities`, `other`), `title`, `amountIQD`, `recordedBy`, `notes`.
   - `RbacRole` (`admin` | `senior_pt` | `assistant_pt` | `receptionist`) & `AuditLogEntry` (`id`, `timestamp`, `actorName`, `actorRole`, `actionType`, `entityType`, `entityId`, `summary`).

### C. Interactive Component & State Mapping

- **Mode & Role Switcher (`Sidebar` & `AppLayout`)**:
  - Switching between **Clinical EHR Mode** and **Reception & Clinic Admin Mode** updates the active navigation view immediately.
  - Switching the active **RBAC Role** (`Admin`, `Senior PT`, `Assistant PT`, `Receptionist`) enforces permission boundaries in real time (e.g., `Receptionist` can manage Appointments, Waitlist, Patient Demographics, and IQD Billing, but cannot sign/lock clinical evaluations; `Assistant PT` can log daily session flowsheets but only `Senior PT` / `Admin` can finalize Initial Evaluations, Discharge Summaries, or delete financial records).
- **Episode-Scoped Assessment & Longitudinal Comparison Handlers**:
  - Selecting an **Episode of Care** loads that specific Episode's Initial Evaluation, Re-evaluations, Goals, HEP, and Sessions.
  - Clicking **"Save Snapshot to Episode"** or finalizing an **Initial Evaluation / Re-evaluation** records a timestamped `ClinicalAssessmentSnapshot` inside the Episode, immediately populating the **Longitudinal Comparison Matrix** (computing exact ROM degree gains, MMT grade improvements, NPRS pain reduction, and Outcome Measure % improvement).
- **Session Flowsheet & HEP Handlers**:
  - Clicking **"Carry Forward Last Session Flowsheet"** copies all therapeutic exercises, sets, reps, and weights from the previous session in the same Episode so the therapist only edits progressions.
  - Clicking **"Assign to HEP"** adds any exercise from the searchable **Exercise Library** directly to the patient's Episode Home Exercise Program with customizable Arabic/English instructions and printable layout.
- **Iraqi Financial Ledger (`IQD`) Handlers**:
  - Creating a **Single Session Invoice** or **Multi-Session Package** (`e.g., 10 Sessions = 200,000 IQD`) automatically calculates `netAmountIQD` and `balanceDueIQD`.
  - Recording a **Partial Cash Payment** (`e.g., 75,000 IQD paid today`) appends a `PaymentTransactionIQD`, recalculates the patient's total outstanding debt across the clinic, and logs an immutable `AuditLogEntry`.
