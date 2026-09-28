'use server';

import policyTerms from '../../public/policy_terms.json';

export async function calculateFinancialPayout(
  approvedLineItems: { description: string; amount: number }[],
  claimCategory: string,
  hospitalName?: string
) {
  console.log(`[AGENT 3: FINANCIAL CALCULATOR] Running Financial Adjudication...`);

  // Load policy terms
  // policyTerms loaded via import

  const globalClaimLimit = policyTerms.coverage.per_claim_limit;
  const categoryTerms = policyTerms.opd_categories[claimCategory.toLowerCase() as keyof typeof policyTerms.opd_categories];
  
  if (!categoryTerms) {
    throw new Error(`Category ${claimCategory} not found in policy terms.`);
  }

  const subLimit = categoryTerms.sub_limit || globalClaimLimit;
  const copayPercent = categoryTerms.copay_percent || 0;

  // 1. Sum up all medically approved line items
  const totalApprovedAmount = approvedLineItems.reduce((sum, item) => sum + item.amount, 0);

  // 1.5 Apply Network Discount (if applicable)
  let networkDiscountAmount = 0;
  let isNetworkHospital = false;
  const networkDiscountPercent = ('network_discount_percent' in categoryTerms ? (categoryTerms as any).network_discount_percent : 0) || 0;
  
  if (hospitalName && networkDiscountPercent > 0) {
    const networkHospitals = policyTerms.network_hospitals || [];
    isNetworkHospital = networkHospitals.some((h: string) => h.toLowerCase() === hospitalName.toLowerCase());
    
    if (isNetworkHospital) {
      networkDiscountAmount = (totalApprovedAmount * networkDiscountPercent) / 100;
    }
  }

  const discountedBaseAmount = totalApprovedAmount - networkDiscountAmount;

  // 2. Apply Co-Pay
  const copayAmount = (discountedBaseAmount * copayPercent) / 100;

  const calculatedPayable = discountedBaseAmount - copayAmount;
  let payableAmount = calculatedPayable;

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
    isNetworkHospital ? `Applied ${networkDiscountPercent}% Network Discount: -₹${networkDiscountAmount}` : null,
    copayPercent > 0 ? `Applied ${copayPercent}% Co-Pay: -₹${copayAmount}` : null,
    `Calculated Payable: ₹${calculatedPayable}`,
    calculatedPayable > subLimit ? `Capped at Category Sub-Limit: ₹${subLimit}` : null,
    calculatedPayable > globalClaimLimit && subLimit > globalClaimLimit ? `Capped at Global Claim Limit: ₹${globalClaimLimit}` : null,
    `Final Payable Amount: ₹${payableAmount}`
  ].filter(Boolean).join(' | ');

  return {
    totalApprovedAmount,
    networkDiscountAmount,
    copayAmount,
    calculatedPayable,
    payableAmount,
    breakdown,
    appliedLimits: {
      globalClaimLimit,
      subLimit,
      copayPercent,
      networkDiscountPercent: isNetworkHospital ? networkDiscountPercent : 0
    }
  };
}
