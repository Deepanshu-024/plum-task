'use server';

import fs from 'fs';
import path from 'path';

export async function runDeterministicPolicyChecks(
  //agent2Output: any,
  employeeId: string,
  treatmentDate: string,
  claimedAmount: number,
  submissionDate: string = new Date().toISOString()
) {
  console.log(`[AGENT 3: PRE-POLICY] Running deterministic pre-policy checks...`);

  const policyPath = path.join(process.cwd(), 'policy_terms.json');
  const policyTerms = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  
  const member = policyTerms.members.find((m: any) => m.member_id === employeeId);
  if (!member) {
    throw new Error(`Member with ID ${employeeId} not found in policy terms.`);
  }
  const memberJoinDate = member.join_date;
  
  const checks = [];
  let passed = true;
  let decision = "CONTINUE";
  let reason = "All deterministic policy checks passed.";

  const tDate = new Date(treatmentDate);
  const jDate = new Date(memberJoinDate);
  const sDate = new Date(submissionDate);

  // 1. Initial Waiting Period Check (TC004)
  const activeDays = Math.floor((tDate.getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24));
  const initialWait = policyTerms.waiting_periods.initial_waiting_period_days;
  
  if (activeDays < initialWait) {
    passed = false;
    decision = "MEDICAL_REJECTED";
    reason = `Claim rejected: Member was active for ${activeDays} days, which is less than the mandatory initial waiting period of ${initialWait} days.`;
    checks.push({
      check: "Initial Waiting Period",
      passed: false,
      reason: `Member joined on ${memberJoinDate}, treated on ${treatmentDate} (${activeDays} days active).`
    });
    return { passed, decision, reason, checks, restrictedConditions: [] };
  } else {
    checks.push({
      check: "Initial Waiting Period",
      passed: true,
      reason: `Member active for ${activeDays} days (>= ${initialWait} days).`
    });
  }

  // 2. Minimum Claim Amount Check
  const minAmount = policyTerms.submission_rules.minimum_claim_amount;
  if (claimedAmount < minAmount) {
    passed = false;
    decision = "MEDICAL_REJECTED";
    reason = `Claim rejected: The user-submitted claim amount (₹${claimedAmount}) is less than the minimum required claim amount (₹${minAmount}).`;
    checks.push({
      check: "Minimum Claim Amount",
      passed: false,
      reason: `Submitted claim amount ₹${claimedAmount} < ₹${minAmount}.`
    });
    return { passed, decision, reason, checks, restrictedConditions: [] };
  } else {
    checks.push({
      check: "Minimum Claim Amount",
      passed: true,
      reason: `Submitted claim amount ₹${claimedAmount} >= ₹${minAmount}.`
    });
  }

  // 3. Submission Deadline Check
  const daysSinceTreatment = Math.floor((sDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
  const deadline = policyTerms.submission_rules.deadline_days_from_treatment;
  
  if (daysSinceTreatment > deadline) {
    passed = false;
    decision = "MEDICAL_REJECTED";
    reason = `Claim rejected: Claim submitted ${daysSinceTreatment} days after treatment. Deadline is ${deadline} days.`;
    checks.push({
      check: "Submission Deadline",
      passed: false,
      reason: `Submitted ${daysSinceTreatment} days after treatment.`
    });
    return { passed, decision, reason, checks, restrictedConditions: [] };
  } else {
    checks.push({
      check: "Submission Deadline",
      passed: true,
      reason: `Submitted within deadline (${daysSinceTreatment} days).`
    });
  }

  // 4. Pre-calculate Restricted Conditions
  const restrictedConditions: string[] = [];
  const specificWaitPeriods = policyTerms.waiting_periods.specific_conditions;
  
  for (const [condition, requiredDays] of Object.entries(specificWaitPeriods)) {
    if (activeDays < (requiredDays as number)) {
      restrictedConditions.push(condition);
    }
  }
  
  checks.push({
    check: "Restricted Conditions Calculation",
    passed: true,
    reason: restrictedConditions.length > 0 
      ? `Member is still in waiting period for: ${restrictedConditions.join(", ")}` 
      : `Member has cleared all specific waiting periods.`
  });

  console.log(`[AGENT 3: PRE-POLICY] ✅ All checks passed. Restricted conditions: ${restrictedConditions.join(", ")}`);
  
  return {
    passed,
    decision,
    reason,
    checks,
    restrictedConditions
  };
}
