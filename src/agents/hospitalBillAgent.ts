import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { HospitalBillSchema } from './schemas';
import { fallbackIntegrity } from './extractorUtils';

const BILL_PROMPT = `You are a financial document extraction AI. Your only job is to read a hospital or pharmacy bill and extract structured data from it. Do NOT decide what is covered or excluded. Do NOT apply discounts or co-pay calculations. You MUST also assess the physical integrity of the document and report any signs of tampering or manipulation — especially in amount fields and dates, which are common targets. Return ONLY valid JSON. Never return null for confidence_score, illegible_fields, or document_integrity.`;

export async function extractHospitalBill(url: string, mimeType: string) {
  console.log(`\n[AGENT 2: EXTRACTOR] 🏥 Starting HOSPITAL/PHARMACY BILL extraction for ${url}`);
  try {
    const { output } = await generateText({
      model: openai('gpt-4o'),
      system: BILL_PROMPT,
      messages: [
        {
          role: 'user', content: [
            { type: 'text', text: 'Extract the structured financial and patient data from this HOSPITAL/PHARMACY BILL.' },
            { type: 'file', data: new URL(url), mediaType: mimeType }
          ]
        }
      ],
      output: Output.object({ schema: HospitalBillSchema })
    });
    return output;
  } catch (err: any) {
    console.error(`Failed to extract Hospital Bill: ${url}`, err);
    throw new Error(`AI API Error during Hospital Bill extraction: ${err.message || String(err)}`);
  }
}
