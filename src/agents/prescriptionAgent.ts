import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PrescriptionSchema } from './schemas';
import { fallbackIntegrity } from './extractorUtils';

const PRESCRIPTION_PROMPT = `You are a medical document extraction AI. Your only job is to read a prescription and extract structured data from it. Do NOT make any judgment about whether something is covered or not. Do NOT apply any policy rules. You MUST also assess the physical integrity of the document and report any signs of tampering or manipulation. Return ONLY valid JSON. Never return null for confidence_score, illegible_fields, or document_integrity.`;

export async function extractPrescription(url: string, mimeType: string) {
  console.log(`\n[AGENT 2: EXTRACTOR] 📄 Starting PRESCRIPTION extraction for ${url}`);
  try {
    const { output } = await generateText({
      model: openai('gpt-4o'),
      system: PRESCRIPTION_PROMPT,
      messages: [
        { role: 'user', content: [
            { type: 'text', text: 'Extract the structured data from this PRESCRIPTION.' },
            { type: 'file', data: new URL(url), mediaType: mimeType }
        ]}
      ],
      output: Output.object({ schema: PrescriptionSchema })
    });
    return output;
  } catch (err) {
    console.error(`Failed to extract Prescription: ${url}`, err);
    return {
      document_type: "PRESCRIPTION" as const,
      confidence_score: 0.0,
      illegible_fields: ["ALL"],
      document_integrity: fallbackIntegrity,
      patient_name: null,
      patient_age_or_dob: null,
      doctor_name: null,
      doctor_registration: null,
      clinic_or_hospital_name: null,
      prescription_date: null,
      diagnoses: [],
      investigations: [],
      medicines: [],
      treatment_type: null
    };
  }
}
