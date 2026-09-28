import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { LabReportSchema } from './schemas';
import { fallbackIntegrity } from './extractorUtils';

const LAB_REPORT_PROMPT = `You are a medical diagnostic extraction AI. Your only job is to read a lab or diagnostic report and extract structured data from it. Do NOT apply any policy rules or pre-authorization checks. You MUST also assess the physical integrity of the document. Return ONLY valid JSON. Never return null for confidence_score, illegible_fields, or document_integrity.`;

export async function extractLabReport(url: string, mimeType: string) {
  console.log(`\n[AGENT 2: EXTRACTOR] 🔬 Starting LAB/DIAGNOSTIC REPORT extraction for ${url}`);
  try {
    const { output } = await generateText({
      model: openai('gpt-4o'),
      system: LAB_REPORT_PROMPT,
      messages: [
        {
          role: 'user', content: [
            { type: 'text', text: 'Extract the structured findings and patient data from this LAB/DIAGNOSTIC REPORT.' },
            { type: 'file', data: new URL(url), mediaType: mimeType }
          ]
        }
      ],
      output: Output.object({ schema: LabReportSchema })
    });
    return output;
  } catch (err: any) {
    console.error(`Failed to extract Lab Report: ${url}`, err);
    throw new Error(`AI API Error during Lab Report extraction: ${err.message || String(err)}`);
  }
}
