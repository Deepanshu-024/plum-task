'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Schema for the Medical Policy Evaluator output
export const PolicyEvaluatorSchema = z.object({
  decision: z.enum(["MEDICAL_APPROVED", "MEDICAL_REJECTED", "PARTIAL_APPROVAL"]),
  approved_line_items: z.array(z.object({
    description: z.string(),
    amount: z.number()
  })),
  rejected_line_items: z.array(z.object({
    description: z.string(),
    amount: z.number(),
    reason: z.string()
  })),
  rejection_reasons: z.array(z.enum([
    "EXCLUDED_CONDITION", 
    "WAITING_PERIOD", 
    "PRE_AUTH_MISSING", 
    "NON_MEDICAL_ITEM"
  ])),
  notes: z.string()
});

export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluatorSchema>;

export async function evaluateMedicalPolicy(
  agent2Output: any, 
  claimCategory: string, 
  restrictedConditions: string[]
): Promise<PolicyEvaluationResult> {
  console.log(`[AGENT 3: POLICY EVALUATOR] Running LLM Policy Evaluation...`);

  // Load policy terms
  const policyPath = path.join(process.cwd(), 'policy_terms.json');
  const policyTerms = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

  const exclusions = policyTerms.exclusions;
  const preAuth = policyTerms.pre_authorization;
  const categoryTerms = policyTerms.opd_categories[claimCategory.toLowerCase()] || {};

  const prompt = `You are a strict Medical Policy Evaluator for an insurance company.
Your job is to read the extracted medical data from a claim and determine if any of the diagnoses, treatments, or billed line items violate the policy terms.

### 1. Waiting Periods (Currently Restricted)
The member is currently in a waiting period and is STRICTLY RESTRICTED from claiming for the following conditions:
${JSON.stringify(restrictedConditions)}

### 2. General Exclusions
The following conditions and procedures are STRICTLY EXCLUDED and will not be paid for. This includes line items related to them (e.g. bariatric surgery, cosmetic procedures, health supplements):
${JSON.stringify(exclusions, null, 2)}

### 3. Pre-Authorization Rules
The following procedures require pre-authorization. If the patient had this procedure but there is no indication of pre-authorization, reject it:
${JSON.stringify(preAuth, null, 2)}

### 4. Category Rules (${claimCategory})
${JSON.stringify(categoryTerms, null, 2)}

### THE CLAIM DATA (Extracted from Documents):
- Diagnoses: ${JSON.stringify(agent2Output.diagnoses)}
- Treatments/Medicines: ${JSON.stringify(agent2Output.treatments)}
- Investigations: ${JSON.stringify(agent2Output.investigations)}
- Billed Line Items:
${JSON.stringify(agent2Output.lineItems, null, 2)}

### INSTRUCTIONS:
1. Evaluate the diagnoses against the Currently Restricted waiting periods and General Exclusions. If the primary diagnosis matches or is related to a restricted/excluded condition, the ENTIRE claim must be rejected (decision: MEDICAL_REJECTED). Move all line items to rejected_line_items.
2. If the main diagnosis is covered, evaluate each individual billed line item. Reject items that are explicitly excluded (e.g., "Teeth Whitening", "Vitamins") or require missing pre-auth (e.g., MRI over 10k without auth).
3. If some line items are covered and some are rejected, output PARTIAL_APPROVAL.
4. If everything is covered, output MEDICAL_APPROVED.
5. In your notes, explicitly justify any rejected items or conditions.
`;

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: PolicyEvaluatorSchema,
      prompt: prompt,
    });
    
    console.log(`[AGENT 3: POLICY EVALUATOR] Decision: ${object.decision}. Approved Items: ${object.approved_line_items.length}`);
    return object;
  } catch (error) {
    console.error("[AGENT 3: POLICY EVALUATOR] Failed:", error);
    throw error;
  }
}
