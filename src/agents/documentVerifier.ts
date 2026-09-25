import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function verifyDocuments(documents: { url: string }[]) {
  const contentParts: any[] = [
    {
      type: 'text',
      text: `You are an insurance document verification AI (Agent 1).
      Look at the following uploaded documents. 
      Verify if they appear to be legitimate medical documents (like a prescription, hospital bill, lab report, etc).
      Check if they are reasonably legible and relevant to a medical claim.
      Be lenient but reject obviously completely irrelevant or blurry images.`
    }
  ];

  documents.forEach((doc) => {
    if (doc.url) {
      contentParts.push({
        type: 'image',
        image: new URL(doc.url),
      });
    }
  });

  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    messages: [
      { role: 'user', content: contentParts }
    ],
    output: Output.object({
      schema: z.object({
        isAccepted: z.boolean().describe(
          'True if the batch contains legitimate, readable medical documents. False if they are completely irrelevant (e.g., a picture of a cat), blank, or completely unreadable.'
        ),
        reasoning: z.string().describe(
          'A short sentence explaining the overall decision to the user.'
        ),
        documents: z.array(
          z.object({
            detectedType: z.enum([
              'PRESCRIPTION', 
              'HOSPITAL_BILL', 
              'LAB_REPORT', 
              'DIAGNOSTIC_REPORT', 
              'PHARMACY_BILL', 
              'DENTAL_REPORT', 
              'DISCHARGE_SUMMARY', 
              'UNKNOWN'
            ]).describe('The classified type of this specific document.'),
            
            isLegitimate: z.boolean().describe(
              'Whether this specific document appears to be a real medical document.'
            ),
            
            qualityNotes: z.string().optional().describe(
              'Notes on image quality (e.g., "blurry but readable", "corner cut off", "clear").'
            ),
          })
        ).describe('Detailed analysis for each document provided, in the exact order they were uploaded.'),
      }),
    }),
  });

  return output;
}
