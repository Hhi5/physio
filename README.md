# PhysioRecord (فيزيو ريكورد)

Local-first physiotherapy and rehabilitation Electronic Health Record (EHR) built for clinicians in Iraq, designed for tablets, phones, and desktop browsers with offline-first encrypted storage.

## Overview

- **Domain Model**: `Patient -> Episode of Care -> Session -> SOAP Note (+ Append-Only Clinical Addenda)`
- **Clinical Toolkit**: Body Pain & Symptom Chart, Range of Motion (ROM: AROM/PROM/AAROM with longitudinal comparison), Manual Muscle Testing (MMT 0–5), Neurological Screening (Myotomes, Dermatomes, Deep Tendon Reflexes, Upper Motor Neuron signs), and Functional Outcome Scales.
- **Bilingual Interface**: Arabic-first RTL (`ar-IQ` Gregorian calendar with Latin digits) and English LTR (`en-GB`).
- **Local-First Encrypted Storage**:
  - IndexedDB via Dexie (`PhysioRecordDB` with versioned schema migrations).
  - WebCrypto `PBKDF2-HMAC-SHA256` (600,000 iterations, 16-byte random salt) key derivation wrapping a 256-bit `AES-256-GCM` master Data Encryption Key (DEK).
  - Authenticated Additional Data (AAD) binding each record to its store name, primary key, and schema version.
  - Encrypted `.ptbackup` export and atomic restore with pre-restore safety recovery snapshots.

## Tech Stack

- **Frontend**: React 19, TypeScript (strict mode), Tailwind CSS v4, Vite
- **Persistence**: Dexie.js (IndexedDB)
- **Cryptography**: Browser WebCrypto API (`crypto.subtle`)
- **Testing**: Vitest

## Getting Started

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check with strict TypeScript
npm run lint

# Run unit tests
npm test

# Build for production
npm run build
```

## Clinical Data Safety

- Never hardcode real patient health information (PHI) in source code.
- Synthetic demo data seeding is restricted to development mode (`import.meta.env.DEV`) and never overwrites existing patient records.
- Database schema updates must always add a new versioned Dexie migration and preserve readability of existing local records.
