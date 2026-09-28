import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Schema for a single document verification result
const singleDocResultSchema = z.object({
  detectedType: z.enum([
    'PRESCRIPTION',
    'HOSPITAL_BILL',
    'LAB_REPORT',
    'DIAGNOSTIC_REPORT',
    'PHARMACY_BILL',
    'DENTAL_REPORT',
    'DISCHARGE_SUMMARY',
    'UNKNOWN'
  ]).describe('What this document actually appears to be.'),

  matchesDeclaredType: z.boolean().describe(
    'True if the document matches the expected declared type.'
  ),

  isReadable: z.boolean().describe(
    'True if the document is readable enough to extract key information like patient name, amounts, dates, etc.'
  ),

  reasoning: z.string().describe(
    'A user-friendly message for this document. If rejected, explain why (e.g., "This appears to be a prescription, not a hospital bill." or "This document is too blurry to read any details from. Please re-upload a clearer photo.").'
  ),
});

export type DocVerificationResult = z.infer<typeof singleDocResultSchema> & {
  declaredType: string;
  url: string;
};

/**
 * Verifies a single document against its declared type.
 * Checks both type match and readability.
 */
async function verifySingleDocument(doc: { url: string; declaredType: string }): Promise<DocVerificationResult> {
  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an insurance document verification AI.
            The user uploaded this document and declared it to be: "${doc.declaredType}".

            Check two things:
            1. TYPE MATCH — Is this document actually a ${doc.declaredType}?
            2. READABILITY — Can you read the key details (patient name, amounts, dates, etc.) from it?

            Rules:
            - CORE PURPOSE RULE: The declared type acts as a generic bucket for a specific purpose. You must accept reasonable variants AS LONG AS they fulfill that core purpose. However, if a document completely fails the core purpose, it must be strictly REJECTED.
              * If requested type is a BILL (e.g. HOSPITAL_BILL, PHARMACY_BILL), accept any invoice/receipt from any medical facility (clinic, dental, hospital, pharmacy). BUT it MUST contain financial charges. A clinical note/prescription is NOT a bill.
              * If requested type is a PRESCRIPTION, it must contain medical advice/medicines. A bill or a lab report is NOT a prescription.
              * If requested type is a REPORT (e.g. LAB_REPORT, DIAGNOSTIC_REPORT), it must contain test results. A bill or a prescription is NOT a report.
            - If the document is completely irrelevant (e.g., a photo of food, a selfie), reject it immediately.
            - If it matches the core purpose but is so blurry/dark/cut-off that key details cannot be read, reject it.
            - If it matches the core purpose and is readable enough to extract info from (even if image quality is poor), ACCEPT it.`
          },
          {
            type: 'file',
            data: new URL(doc.url),
            mediaType: 'image/jpeg',
          }
        ]
      }
    ],
    output: Output.object({
      schema: singleDocResultSchema,
    }),
  });

  return {
    ...output,
    declaredType: doc.declaredType,
    url: doc.url,
  };
}

/**
 * Agent 1 — Document Verifier
 * Verifies each document individually in parallel.
 * Returns per-document results so the caller can accept passing docs
 * and only ask re-upload for failed ones.
 */
export async function verifyDocuments(documents: { url: string; declaredType: string }[]) {
  // Run all verifications in parallel
  const results = await Promise.all(
    documents.map((doc) => verifySingleDocument(doc))
  );

  const allPassed = results.every((r) => r.matchesDeclaredType && r.isReadable);

  // Build a combined reasoning for failed docs only
  const failedDocs = results.filter((r) => !r.matchesDeclaredType || !r.isReadable);
  const combinedReasoning = allPassed
    ? 'All documents verified successfully.'
    : failedDocs.map((r) => `${r.declaredType}: ${r.reasoning}`).join(' | ');

  return {
    isAccepted: allPassed,
    reasoning: combinedReasoning,
    documents: results,
  };
}
