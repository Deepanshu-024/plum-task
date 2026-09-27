import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Schema for the Medical Policy Evaluator output
const PolicyEvaluatorSchema = z.object({
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
1. Evaluate the diagnoses against the Currently Restricted waiting periods and General Exclusions.
2. For EACH billed line item, determine if it is medically necessary to treat a COVERED diagnosis.
3. If a line item is used to treat a condition that is Excluded or Restricted (e.g., Insulin for restricted Diabetes), move ONLY that specific line item to \`rejected_line_items\` with the reason. Do NOT reject the entire claim if other items are treating covered conditions.
4. Also reject any line item that is explicitly excluded itself (e.g., "Teeth Whitening", "Vitamins") or requires missing pre-auth (e.g., MRI over 10k without auth).
5. STRICT RULE: ONLY output items in \`approved_line_items\` or \`rejected_line_items\` that EXACTLY match the items in the "Billed Line Items" list. Do NOT evaluate or reject prescribed medicines or treatments if they were not explicitly billed!
6. If ALL billed line items are rejected, output \`decision: MEDICAL_REJECTED\`.
7. If SOME billed line items are approved and SOME are rejected, output \`decision: PARTIAL_APPROVAL\`.
8. If ALL billed line items are approved, output \`decision: MEDICAL_APPROVED\`.
9. In your notes, explicitly justify any rejected items or conditions.
`;

  try {
    console.log(`[AGENT 3: POLICY EVALUATOR] Billed Line Items being sent to LLM:\n`, JSON.stringify(agent2Output.lineItems, null, 2));
    const { object } = await generateObject({
      model: openai('gpt-5-mini'),
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
