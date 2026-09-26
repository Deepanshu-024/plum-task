import { z } from 'zod';

export const DocumentIntegritySchema = z.object({
  is_original: z.boolean().nullable(),
  tampering_flags: z.array(z.string()),
  scan_quality: z.enum(["GOOD", "PARTIAL", "POOR", "UNREADABLE"]),
  physical_condition_flags: z.array(z.string()),
  consistency_checks: z.object({
    ink_consistency: z.enum(["CONSISTENT", "INCONSISTENT", "CANNOT_DETERMINE"]),
    paper_background_consistency: z.enum(["CONSISTENT", "INCONSISTENT", "CANNOT_DETERMINE"]),
    date_plausibility: z.enum(["PLAUSIBLE", "SUSPICIOUS", "CANNOT_DETERMINE"]),
    amount_plausibility: z.enum(["PLAUSIBLE", "SUSPICIOUS", "CANNOT_DETERMINE"])
  }),
  integrity_confidence: z.number().min(0).max(1)
});

export const PrescriptionSchema = z.object({
  document_type: z.enum(["PRESCRIPTION"]),
  confidence_score: z.number().min(0).max(1),
  illegible_fields: z.array(z.string()),
  document_integrity: DocumentIntegritySchema,
  patient_name: z.string().nullable(),
  patient_age_or_dob: z.string().nullable(),
  doctor_name: z.string().nullable(),
  doctor_registration: z.string().nullable(),
  clinic_or_hospital_name: z.string().nullable(),
  prescription_date: z.string().nullable(),
  diagnoses: z.array(z.string()),
  investigations: z.array(z.string()),
  medicines: z.array(z.object({
    name: z.string(),
    dosage: z.string().nullable(),
    frequency: z.string().nullable(),
    duration: z.string().nullable()
  })).nullable(),
  treatment_type: z.string().nullable()
});

export const HospitalBillSchema = z.object({
  document_type: z.enum(["HOSPITAL_BILL", "PHARMACY_BILL"]),
  confidence_score: z.number().min(0).max(1),
  illegible_fields: z.array(z.string()),
  document_integrity: DocumentIntegritySchema,
  patient_name: z.string().nullable(),
  bill_date: z.string().nullable(),
  hospital_name: z.string().nullable(),
  hospital_address: z.string().nullable(),
  gstin: z.string().nullable(),
  line_items: z.array(z.object({
    description: z.string(),
    amount: z.number()
  })),
  subtotal: z.number().nullable(),
  tax_amount: z.number().nullable(),
  total_amount: z.number().nullable()
});

export const LabReportSchema = z.object({
  document_type: z.enum(["LAB_REPORT", "DIAGNOSTIC_REPORT"]),
  confidence_score: z.number().min(0).max(1),
  illegible_fields: z.array(z.string()),
  document_integrity: DocumentIntegritySchema,
  patient_name: z.string().nullable(),
  report_date: z.string().nullable(),
  test_name: z.string().nullable(),
  test_category: z.enum(["MRI", "CT_SCAN", "PET_SCAN", "X_RAY", "ULTRASOUND", "BLOOD_TEST", "URINE_TEST", "ECG", "BIOPSY", "ENDOSCOPY", "OTHER"]).nullable(),
  lab_name: z.string().nullable(),
  referring_doctor: z.string().nullable(),
  findings_summary: z.string().nullable(),
  report_amount: z.number().nullable()
});

export interface VerifiedDocument {
  url: string;
  detectedType: string;
  mimeType?: string;
}
