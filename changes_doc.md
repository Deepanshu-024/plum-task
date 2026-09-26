# Information Extractor Updates - v3.0

This document summarizes the changes applied to the `informationExtractor.ts` module to comply with the updated rules and v3.0 schema definitions.

## 1. Document Integrity Schema Implementation
- Added a robust `DocumentIntegritySchema` that assesses physical and visual integrity across all documents.
- Includes checks for `is_original`, `tampering_flags`, `scan_quality`, `physical_condition_flags`, and fine-grained `consistency_checks`.
- This ensures that agents report on physical tampering directly observed in the image without making policy decisions.

## 2. Updated Zod Schemas for Document Types
- Replaced the old schemas with updated ones that conform to the exact naming (e.g. `patient_name` instead of `patientName`) requested in the v3.0 spec.
- **PrescriptionSchema**: Added specific types for fields like `doctor_registration`, `diagnoses`, `medicines`, and `illegible_fields`.
- **HospitalBillSchema**: Refined `line_items`, `hospital_name`, `gstin`, and `tax_amount` extraction logic.
- **LabReportSchema**: Added constraints for `test_category` with specific enumerations (e.g., `"MRI"`, `"BLOOD_TEST"`) and strict findings summaries.

## 3. Strict Prompting Guidelines
- Rewrote `PRESCRIPTION_PROMPT`, `BILL_PROMPT`, and `LAB_REPORT_PROMPT` to enforce strict constraints:
  - *No policy rules application.*
  - *No sub-limits, discounts, or co-pay calculations.*
  - *Required assessment of document integrity (especially on tampering and alterations).*

## 4. Fallback Handling on Extraction Failure
- Created a `fallbackIntegrity` object representing an unreadable or crashed state.
- Wrapped each extraction call (Prescription, Bill, Lab Report) in a `try...catch` block.
- If an agent crashes or times out, it now safely returns the predefined `failure_fallback` structure with `confidence_score: 0.0`, `illegible_fields: ["ALL"]`, and default `null` values for other data points instead of crashing the pipeline.

## 5. Master Aggregator Adjustments
- The `extractAllClaimData` aggregator now deterministically processes results based on the new snake_case schema structures.
- Added `hasTamperingFlags` and `tamperingFlags` output lists by merging the observations from individual agents.
- Adjusts the `confidenceScore` appropriately based on the individual document's lowest confidence score. If no items were successfully processed, it defaults to a score of `0.0`.
- Retained `rawExtractions` for full audit trails to feed Agent 3 (Adjudication).
