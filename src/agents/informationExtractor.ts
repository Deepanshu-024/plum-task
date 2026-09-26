import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// ==========================================
// 1. ZOD SCHEMAS (Per Document Type)
// ==========================================

export const PrescriptionSchema = z.object({
  patientName: z.string().nullable().describe("The name of the patient"),
  patientAge: z.number().nullable().describe("Age in years"),
  patientGender: z.enum(["M", "F", "OTHER"]).nullable(),
  doctorName: z.string().nullable().describe("Name of the doctor"),
  date: z.string().nullable().describe("Date of consultation (YYYY-MM-DD)"),
  diagnoses: z.array(z.string()).describe("List of diagnosed conditions, diseases, or symptoms"),
  medicines: z.array(z.string()).describe("List of prescribed medicines"),
  investigations: z.array(z.string()).describe("Tests, scans, or lab work ordered"),
  confidenceScore: z.number().min(0).max(100).describe("How confident are you in this extraction? (0-100) Lower if handwriting is very messy.")
});

export const HospitalBillSchema = z.object({
  patientName: z.string().nullable().describe("The name of the patient on the bill"),
  hospitalName: z.string().nullable().describe("Name of the hospital or clinic"),
  billDate: z.string().nullable().describe("Date of the bill (YYYY-MM-DD)"),
  lineItems: z.array(z.object({
    description: z.string().describe("What was charged (e.g., 'Consultation Fee', 'Root Canal', 'Medicines')"),
    amount: z.number().describe("The exact numeric amount charged for this item")
  })).describe("Individual billed items"),
  totalAmount: z.number().nullable().describe("The final total amount on the bill"),
  confidenceScore: z.number().min(0).max(100)
});

export const LabReportSchema = z.object({
  patientName: z.string().nullable(),
  testName: z.string().nullable().describe("The main test performed (e.g., 'MRI Lumbar Spine', 'Blood Test')"),
  date: z.string().nullable().describe("Date of the test (YYYY-MM-DD)"),
  findings: z.array(z.string()).describe("Key medical findings, impressions, or results"),
  confidenceScore: z.number().min(0).max(100)
});

// ==========================================
// 2. INDIVIDUAL EXTRACTOR AGENTS
// ==========================================

const PRESCRIPTION_PROMPT = `You are an expert medical data extraction AI. Your task is to extract data from a medical PRESCRIPTION.
CRITICAL RULES:
1. DIAGNOSES ARE CRUCIAL: Look for sections titled "C/O", "Dx", "Diagnosis", or "Symptoms". We need exact conditions to check for waiting periods (e.g., "Diabetes") and exclusions (e.g., "Obesity", "Cosmetic").
2. INVESTIGATIONS: Look for "Adv", "Investigations", or "Tests". We need these to check if expensive tests like "MRI" were ordered for pre-authorization rules.
3. HANDWRITING: Prescriptions are often handwritten in cursive. Act as an expert OCR system. Do not guess if illegible; leave it null and lower the confidence score.
4. IGNORE NOISE: Ignore rubber stamps, signatures, or background shadows.`;

const BILL_PROMPT = `You are an expert financial data extraction AI. Your task is to extract data from a HOSPITAL or PHARMACY BILL.
CRITICAL RULES:
1. LINE ITEM ACCURACY: Extract every individual line item and its exact amount. We use this for partial claim adjudication (e.g., approving "Root Canal" but rejecting "Teeth Whitening" on the same bill).
2. TOTAL AMOUNT: Verify the total amount at the bottom of the bill.
3. HOSPITAL NAME: Precisely extract the hospital/clinic name from the letterhead. We use this to apply Network Hospital discounts (e.g., matching exactly to "Apollo Hospitals").
4. IGNORE NOISE: Ignore "PAID" or "DUPLICATE" stamps obscuring the text.`;

const LAB_REPORT_PROMPT = `You are a medical diagnostic extraction AI. Your task is to extract data from a LAB or DIAGNOSTIC REPORT (e.g., Blood Test, MRI, X-Ray).
CRITICAL RULES:
1. TEST NAME: Identify exactly what test was performed (e.g., "MRI Lumbar Spine"). This is critical for pre-authorization checks.
2. FINDINGS: Extract the core impression or conclusion from the radiologist/pathologist.
3. PATIENT NAME: Ensure the patient name is accurately extracted for identity verification.`;

function getMimeType(url: string, providedMimeType?: string) {
  if (providedMimeType) return providedMimeType;
  if (url.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

async function extractPrescription(url: string, mimeType: string) {
  const { output } = await generateText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'system', content: PRESCRIPTION_PROMPT },
      { role: 'user', content: [
          { type: 'text', text: 'Extract the structured data from this PRESCRIPTION.' },
          { type: 'file', data: new URL(url), mediaType: mimeType }
      ]}
    ],
    output: Output.object({ schema: PrescriptionSchema })
  });
  return output;
}

async function extractHospitalBill(url: string, mimeType: string) {
  const { output } = await generateText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'system', content: BILL_PROMPT },
      { role: 'user', content: [
          { type: 'text', text: 'Extract the structured financial and patient data from this HOSPITAL/PHARMACY BILL.' },
          { type: 'file', data: new URL(url), mediaType: mimeType }
      ]}
    ],
    output: Output.object({ schema: HospitalBillSchema })
  });
  return output;
}

async function extractLabReport(url: string, mimeType: string) {
  const { output } = await generateText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'system', content: LAB_REPORT_PROMPT },
      { role: 'user', content: [
          { type: 'text', text: 'Extract the structured findings and patient data from this LAB/DIAGNOSTIC REPORT.' },
          { type: 'file', data: new URL(url), mediaType: mimeType }
      ]}
    ],
    output: Output.object({ schema: LabReportSchema })
  });
  return output;
}

// ==========================================
// 3. MASTER AGGREGATOR
// ==========================================

export interface VerifiedDocument {
  url: string;
  detectedType: string;
  mimeType?: string;
}

/**
 * Runs individual extraction agents concurrently and merges the results 
 * into a single unified ClaimContext object for Agent 3 (Adjudication).
 */
export async function extractAllClaimData(documents: VerifiedDocument[]) {
  // 1. Fire off all extractions concurrently based on document type
  const extractionPromises = documents.map(async (doc) => {
    const mimeType = getMimeType(doc.url, doc.mimeType);
    
    try {
      if (doc.detectedType === 'PRESCRIPTION') {
        const data = await extractPrescription(doc.url, mimeType);
        return { type: 'PRESCRIPTION', data };
      } 
      else if (['HOSPITAL_BILL', 'PHARMACY_BILL', 'DENTAL_REPORT'].includes(doc.detectedType)) {
        const data = await extractHospitalBill(doc.url, mimeType);
        return { type: 'BILL', data };
      }
      else if (['LAB_REPORT', 'DIAGNOSTIC_REPORT', 'DISCHARGE_SUMMARY'].includes(doc.detectedType)) {
        const data = await extractLabReport(doc.url, mimeType);
        return { type: 'REPORT', data };
      }
      return null;
    } catch (err) {
      console.error(`Failed to extract data from ${doc.url}`, err);
      return { type: 'ERROR', error: true };
    }
  });

  const rawResults = await Promise.all(extractionPromises);

  // 2. Aggregate the data deterministically
  const aggregated = {
    patientNames: new Set<string>(),
    diagnoses: new Set<string>(),
    treatments: new Set<string>(),
    investigations: new Set<string>(),
    lineItems: [] as { description: string, amount: number }[],
    totalBilledAmount: 0,
    hospitalNames: new Set<string>(),
    doctorNames: new Set<string>(),
    lowestConfidence: 100,
    extractionErrors: 0
  };

  for (const result of rawResults) {
    if (!result) continue;
    
    if (result.type === 'ERROR') {
      aggregated.extractionErrors += 1;
      continue;
    }

    if (result.type === 'PRESCRIPTION') {
      const rx = result.data as z.infer<typeof PrescriptionSchema>;
      if (rx.patientName) aggregated.patientNames.add(rx.patientName);
      if (rx.doctorName) aggregated.doctorNames.add(rx.doctorName);
      rx.diagnoses.forEach(d => aggregated.diagnoses.add(d));
      rx.medicines.forEach(m => aggregated.treatments.add(m)); // Treating meds as treatments for aggregation
      rx.investigations.forEach(i => aggregated.investigations.add(i));
      if (rx.confidenceScore < aggregated.lowestConfidence) aggregated.lowestConfidence = rx.confidenceScore;
    }

    if (result.type === 'BILL') {
      const bill = result.data as z.infer<typeof HospitalBillSchema>;
      if (bill.patientName) aggregated.patientNames.add(bill.patientName);
      if (bill.hospitalName) aggregated.hospitalNames.add(bill.hospitalName);
      bill.lineItems.forEach(item => {
        aggregated.lineItems.push(item);
        aggregated.treatments.add(item.description);
      });
      if (bill.totalAmount) {
        aggregated.totalBilledAmount += bill.totalAmount;
      } else {
        aggregated.totalBilledAmount += bill.lineItems.reduce((sum, item) => sum + item.amount, 0);
      }
      if (bill.confidenceScore < aggregated.lowestConfidence) aggregated.lowestConfidence = bill.confidenceScore;
    }

    if (result.type === 'REPORT') {
      const report = result.data as z.infer<typeof LabReportSchema>;
      if (report.patientName) aggregated.patientNames.add(report.patientName);
      if (report.testName) aggregated.investigations.add(report.testName);
      if (report.confidenceScore < aggregated.lowestConfidence) aggregated.lowestConfidence = report.confidenceScore;
    }
  }

  // 3. Return clean context for Agent 3
  return {
    patientNamesFound: Array.from(aggregated.patientNames),
    diagnoses: Array.from(aggregated.diagnoses),
    treatments: Array.from(aggregated.treatments),
    investigations: Array.from(aggregated.investigations),
    hospitals: Array.from(aggregated.hospitalNames),
    doctors: Array.from(aggregated.doctorNames),
    lineItems: aggregated.lineItems,
    totalBilledAmount: aggregated.totalBilledAmount,
    confidenceScore: aggregated.lowestConfidence,
    hasExtractionErrors: aggregated.extractionErrors > 0,
    rawExtractions: rawResults // Keeping this for the Audit Trace!
  };
}
