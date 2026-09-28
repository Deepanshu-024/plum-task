# Agent 2: Information Extraction Schemas

This document explains the required output fields for every sub-agent in the Stage 2 extraction pipeline. It details what every single field represents and why it is necessary for downstream processing.

---

## 1. Shared Fields (Applies to all documents)

### Core Metadata
- **`document_type`**
  - **Need:** Identifies the exact nature of the document. Critical for routing the data to the correct policy rules in the Adjudicator agent.
- **`confidence_score`**
  - **Need:** Allows the system to flag extractions where the AI was uncertain. Low confidence triggers manual human review.
- **`illegible_fields`**
  - **Need:** Prevents the system from failing silently. If handwriting is unreadable, knowing exactly which field failed allows the UI to prompt the user.

### Document Integrity & Fraud Prevention (`document_integrity`)
- **`is_original`**
  - **Need:** Helps detect basic fraud. Photocopies or screenshots are highly suspicious and often violate standard submission policies.
- **`tampering_flags`**
  - **Need:** Flags active malicious behavior (e.g., digitally altered numbers). Directly feeds the Fraud Detector agent.
- **`scan_quality`**
  - **Need:** Differentiates between malicious tampering and simply a bad photo, helping the system decide whether to reject the claim or ask for a re-upload.
- **`physical_condition_flags`**
  - **Need:** Notes real-world damage (folds, stains), which increases confidence that the document is a genuine physical artifact rather than a digital fake.
- **`consistency_checks.ink_consistency`**
  - **Need:** Checks if different pens were used to alter numbers (e.g., changing a 1 to a 7).
- **`consistency_checks.paper_background_consistency`**
  - **Need:** Checks for digital splicing (e.g., pasting a higher amount from a different bill onto this one).
- **`consistency_checks.date_plausibility`**
  - **Need:** Verifies that the date wasn't visibly overwritten to fit within the active policy window.
- **`consistency_checks.amount_plausibility`**
  - **Need:** Verifies that the billed amount wasn't visibly overwritten to steal more money.
- **`integrity_confidence`**
  - **Need:** Provides a final numerical threshold for the Fraud Detector to automatically route the claim to the Special Investigations Unit if the score is low.

---

## 2. Prescription Agent Schema

- **`patient_name`**
  - **Need:** Identity verification. Must match the insured member's profile.
- **`patient_age_or_dob`**
  - **Need:** Secondary identity verification to prevent fraud (e.g., a father using a child's prescription).
- **`doctor_name`**
  - **Need:** Provider verification. Policies require treatments by licensed medical practitioners.
- **`doctor_registration`**
  - **Need:** Allows automated checks against medical council databases to ensure the doctor isn't blacklisted.
- **`clinic_or_hospital_name`**
  - **Need:** Verifies if the treatment occurred at a recognized or network facility.
- **`prescription_date`**
  - **Need:** Verifies the claim is filed within the eligible time window (e.g., within 30 days of the visit).
- **`diagnoses`**
  - **Need:** Medical necessity. The Adjudicator uses this to determine if the prescribed medicines are relevant to the illness and to check for policy exclusions.
- **`investigations`**
  - **Need:** Justifies the lab reports that the user uploaded alongside the prescription.
- **`medicines.name`**
  - **Need:** Used by the Policy Evaluator to check if the drug is an excluded consumable (like vitamins).
- **`medicines.dosage`**
  - **Need:** Required for the Financial Calculator to determine the total expected volume of medicine.
- **`medicines.frequency`**
  - **Need:** Multiplier for the dosage to prevent over-billing by pharmacies.
- **`medicines.duration`**
  - **Need:** Determines the total days supplied, ensuring the pharmacy bill doesn't charge for 60 days of medicine if the doctor only prescribed 5 days.
- **`treatment_type`**
  - **Need:** Broad categorization (e.g., Allopathic, Ayurvedic) to quickly check against policy coverage terms.

---

## 3. Hospital / Pharmacy Bill Agent Schema

- **`patient_name`**
  - **Need:** Ensures the bill belongs to the insured member.
- **`bill_date`**
  - **Need:** Verifies the billing date aligns with the prescription date.
- **`hospital_name`**
  - **Need:** Used to determine if the provider is in-network or out-of-network, changing co-pay logic.
- **`hospital_address`**
  - **Need:** Prevents fraud by cross-referencing known fake hospital addresses.
- **`gstin`**
  - **Need:** Fraud prevention. A valid tax ID ensures the hospital is a legally registered entity.
- **`line_items.description`**
  - **Need:** The Policy Evaluator scans each description to remove non-payable items (like gloves, masks, registration charges) before calculating payout.
- **`line_items.amount`**
  - **Need:** The base financial data used to calculate the payout.
- **`subtotal`**
  - **Need:** Financial integrity check. Compared against the sum of the line items to catch manual tampering.
- **`tax_amount`**
  - **Need:** Needed because some insurance policies exclude taxes from the payout.
- **`total_amount`**
  - **Need:** Financial integrity check. Cross-referenced against subtotal + tax to ensure the math is correct.

---

## 4. Lab / Diagnostic Report Agent Schema

- **`patient_name`**
  - **Need:** Identity verification.
- **`report_date`**
  - **Need:** Ensures the test aligns chronologically with the doctor's prescription.
- **`test_name`**
  - **Need:** Checked against the prescription's `investigations` field. If a patient claims an MRI but the doctor only prescribed a blood test, it is rejected.
- **`test_category`**
  - **Need:** Used to apply sub-limits. A policy might cap MRIs at ₹5000 but have no limit for Blood Tests.
- **`lab_name`**
  - **Need:** Provider network verification for diagnostic centers.
- **`referring_doctor`**
  - **Need:** Cross-referenced with the prescription's `doctor_name` to ensure continuity of care.
- **`findings_summary`**
  - **Need:** Verifies that the patient's ongoing treatment matches the actual test results (preventing claims for unnecessary hospital stays if the test was normal).
- **`report_amount`**
  - **Need:** Helps capture costs if the user forgot to upload a separate billing invoice for the diagnostic test.
