'use server';

import fs from 'fs';
import path from 'path';

export async function calculateFinancialPayout(
  approvedLineItems: { description: string; amount: number }[],
  claimCategory: string
) {
  console.log(`[AGENT 3: FINANCIAL CALCULATOR] Running Financial Adjudication...`);

  // Load policy terms
  const policyPath = path.join(process.cwd(), 'policy_terms.json');
  const policyTerms = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

  const globalClaimLimit = policyTerms.coverage.per_claim_limit;
  const categoryTerms = policyTerms.opd_categories[claimCategory.toLowerCase()];
  
  if (!categoryTerms) {
    throw new Error(`Category ${claimCategory} not found in policy terms.`);
  }

  const subLimit = categoryTerms.sub_limit || globalClaimLimit;
  const copayPercent = categoryTerms.copay_percent || 0;

  // 1. Sum up all medically approved line items
  const totalApprovedAmount = approvedLineItems.reduce((sum, item) => sum + item.amount, 0);

  // 2. Apply Co-Pay
  const copayAmount = (totalApprovedAmount * copayPercent) / 100;
  let payableAmount = totalApprovedAmount - copayAmount;

  // 3. Apply Category Sub-Limit
  if (payableAmount > subLimit) {
    payableAmount = subLimit;
  }

  // 4. Apply Global Per-Claim Limit (Takes Precedence)
  if (payableAmount > globalClaimLimit) {
    payableAmount = globalClaimLimit;
  }

  // Build a nice breakdown for the trace/user
  const breakdown = [
    `Total Approved Medical Amount: ₹${totalApprovedAmount}`,
    copayPercent > 0 ? `Applied ${copayPercent}% Co-Pay: -₹${copayAmount}` : null,
    totalApprovedAmount - copayAmount > subLimit ? `Capped at Category Sub-Limit: ₹${subLimit}` : null,
    totalApprovedAmount - copayAmount > globalClaimLimit && subLimit > globalClaimLimit ? `Capped at Global Claim Limit: ₹${globalClaimLimit}` : null,
    `Final Payable Amount: ₹${payableAmount}`
  ].filter(Boolean).join(' | ');

  return {
    totalApprovedAmount,
    copayAmount,
    payableAmount,
    breakdown,
    appliedLimits: {
      globalClaimLimit,
      subLimit,
      copayPercent
    }
  };
}
