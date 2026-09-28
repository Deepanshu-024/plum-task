import { logger, task, batch } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { aggregateExtractionResults } from "@/agents/informationExtractor";
import { extractSingleDocumentTask } from "./extractDocument";
import { preEvaluationCheck } from "@/actions/preEvaluationCheck";
import { runDeterministicPolicyChecks } from "@/actions/prePolicyChecks";
import { evaluateMedicalPolicy } from "@/actions/policyEvaluator";
import { calculateFinancialPayout } from "@/actions/financialCalculator";

type ProcessClaimPayload = {
  claimId: string;
  employeeId: string;
  treatmentDate: string;
  claimedAmount: number;
  claimCategory: any;
  verifiedDocuments: any[];
};

export const preEvaluationTask = task({
  id: "pre-evaluation-check",
  maxDuration: 120,
  run: async (payload: { rawExtractions: any }) => {
    return await preEvaluationCheck({ rawExtractions: payload.rawExtractions });
  }
});

export const deterministicPolicyChecksTask = task({
  id: "deterministic-policy-checks",
  maxDuration: 120,
  run: async (payload: { claimId: string; employeeId: string; treatmentDate: string; claimedAmount: number }) => {
    const claimsHistory = await prisma.claim.findMany({
      where: {
        employeeId: payload.employeeId,
        id: { not: payload.claimId }
      }
    });

    return await runDeterministicPolicyChecks(
      payload.employeeId,
      payload.treatmentDate,
      Number(payload.claimedAmount),
      new Date('2024-11-02').toISOString(), // Hardcoded simulation date
      claimsHistory
    );
  }
});

export const evaluateMedicalPolicyTask = task({
  id: "evaluate-medical-policy",
  maxDuration: 300,
  run: async (payload: { extractionOutput: any; claimCategory: any; restrictedConditions: string[] }) => {
    return await evaluateMedicalPolicy(
      payload.extractionOutput,
      payload.claimCategory,
      payload.restrictedConditions
    );
  }
});

export const calculateFinancialPayoutTask = task({
  id: "calculate-financial-payout",
  maxDuration: 120,
  run: async (payload: { approvedLineItems: any; claimCategory: any; hospitalName?: string }) => {
    return await calculateFinancialPayout(
      payload.approvedLineItems,
      payload.claimCategory,
      payload.hospitalName
    );
  }
});

export const processClaimTask = task({
  id: "process-claim",
  maxDuration: 900, // 15 minutes max
  run: async (payload: ProcessClaimPayload, { ctx }) => {
    const { claimId, employeeId, treatmentDate, claimedAmount, claimCategory, verifiedDocuments } = payload;

    logger.log(`Starting background processing for claim ${claimId}`, { payload });

    try {
      // --- Phase C: Agent 2 (Parallel Information Extraction) ---
      logger.log(`Triggering Agent 2 for claim ${claimId} with ${verifiedDocuments.length} docs`);

      const batchResult = await batch.triggerAndWait<typeof extractSingleDocumentTask>(
        verifiedDocuments.map(doc => ({ id: extractSingleDocumentTask.id, payload: doc }))
      );

      const rawResults = [];
      for (const run of batchResult.runs) {
        if (run.ok) {
          const docOutput = run.output;
          rawResults.push(docOutput);

          await prisma.traceEntry.create({
            data: {
              claimId,
              agentName: 'DOCUMENT_PARSER',
              stepOrder: 2,
              status: 'PASS',
              input: { triggerRunId: run.id, documentUrl: (docOutput as any)?.url },
              output: docOutput as any,
              confidenceScore: (docOutput as any)?.data?.confidence_score || (docOutput as any)?.data?.confidenceScore,
            }
          });
        } else {
          logger.error(`Document extraction failed for run ${run.id}`, { error: run.error });
          await prisma.traceEntry.create({
            data: {
              claimId,
              agentName: 'DOCUMENT_PARSER',
              stepOrder: 2,
              status: 'FAIL',
              input: { triggerRunId: run.id },
              output: { error: run.error as any },
              errorMessage: "Failed to extract document"
            }
          });

          await prisma.claim.update({
            where: { id: claimId },
            data: {
              status: 'COMPLETED',
              decision: 'MANUAL_REVIEW',
              decisionSummary: `AI failed to extract data (API Error). Sent to manual review. Error: ${JSON.stringify(run.error)}`
            }
          });

          throw new Error(`Document extraction failed due to an AI API error. Claim routed to MANUAL_REVIEW. Detailed error: ${JSON.stringify(run.error)}`);
        }
      }

      const extractionOutput = aggregateExtractionResults(rawResults.filter(Boolean));

      // --- Phase D: Agent 3 Module 1 (Pre-Evaluation Checks) ---
      logger.log(`Triggering Agent 3 (Module 1: Pre-Evaluation) for claim ${claimId}`);
      const preEvalTaskResult = await preEvaluationTask.triggerAndWait({ rawExtractions: extractionOutput.rawExtractions });

      if (!preEvalTaskResult.ok) {
        throw new Error(`Pre-Evaluation Task failed: ${preEvalTaskResult.error}`);
      }
      const preEvalResult = preEvalTaskResult.output;

      await prisma.traceEntry.create({
        data: {
          claimId,
          agentName: 'POLICY_EVALUATOR', // Using POLICY_EVALUATOR for Agent 3 logs to group them logically
          stepOrder: 3,
          status: preEvalResult.passed ? 'PASS' : 'FAIL',
          input: { agent2Output: extractionOutput },
          output: preEvalResult as any,
          checks: preEvalResult.checks
        }
      });

      if (!preEvalResult.passed) {
        logger.log(`Agent 3 Module 1 FAILED. Moving claim ${claimId} to ${preEvalResult.decision}.`);
        await prisma.claim.update({
          where: { id: claimId },
          data: {
            status: 'COMPLETED',
            decision: preEvalResult.decision as any,
            decisionSummary: preEvalResult.reason,
            rejectionReasons: ["PRE_EVALUATION_FAILED"]
          }
        });
        return { message: "Claim completely halted at Pre-Evaluation." };
      }

      // --- Phase E: Agent 3 Module 2 (Deterministic Pre-Policy Checks) ---
      logger.log(`Triggering Agent 3 (Module 2: Pre-Policy Checks) for claim ${claimId}`);
      const prePolicyTaskResult = await deterministicPolicyChecksTask.triggerAndWait({
        claimId,
        employeeId,
        treatmentDate,
        claimedAmount
      });

      if (!prePolicyTaskResult.ok) {
        throw new Error(`Pre-Policy Checks Task failed: ${prePolicyTaskResult.error}`);
      }
      const prePolicyResult = prePolicyTaskResult.output;

      await prisma.traceEntry.create({
        data: {
          claimId,
          agentName: 'POLICY_EVALUATOR',
          stepOrder: 4,
          status: prePolicyResult.passed ? 'PASS' : 'FAIL',
          input: {
            employeeId,
            treatmentDate
          },
          output: prePolicyResult as any,
          checks: prePolicyResult.checks
        }
      });

      if (!prePolicyResult.passed) {
        logger.log(`Agent 3 Module 2 FAILED. Moving claim ${claimId} to ${prePolicyResult.decision}.`);
        await prisma.claim.update({
          where: { id: claimId },
          data: {
            status: 'COMPLETED',
            decision: prePolicyResult.decision as any,
            decisionSummary: prePolicyResult.reason,
            rejectionReasons: ["PRE_POLICY_CHECKS_FAILED"]
          }
        });
        return { message: "Claim completely halted at Pre-Policy checks." };
      }

      // --- Phase F: Agent 3 Module 3 (LLM Policy Evaluator) ---
      logger.log(`Triggering Agent 3 (Module 3: LLM Policy Evaluator) for claim ${claimId}`);
      const medicalPolicyTaskResult = await evaluateMedicalPolicyTask.triggerAndWait({
        extractionOutput,
        claimCategory,
        restrictedConditions: prePolicyResult.restrictedConditions
      });

      if (!medicalPolicyTaskResult.ok) {
        throw new Error(`LLM Policy Evaluator Task failed: ${medicalPolicyTaskResult.error}`);
      }
      const policyEvalResult = medicalPolicyTaskResult.output;

      await prisma.traceEntry.create({
        data: {
          claimId,
          agentName: 'POLICY_EVALUATOR',
          stepOrder: 5,
          status: policyEvalResult.decision !== 'MEDICAL_REJECTED' ? 'PASS' : 'FAIL',
          input: {
            claimCategory,
            restrictedConditions: prePolicyResult.restrictedConditions,
            medicalData: {
              diagnoses: extractionOutput.diagnoses,
              treatments: extractionOutput.treatments,
              investigations: extractionOutput.investigations,
              lineItems: extractionOutput.lineItems
            }
          },
          output: policyEvalResult as any,
        }
      });

      if (policyEvalResult.decision === 'MEDICAL_REJECTED') {
        logger.log(`Agent 3 Module 3 REJECTED claim ${claimId}.`);
        await prisma.claim.update({
          where: { id: claimId },
          data: {
            status: 'COMPLETED',
            decision: 'REJECTED',
            decisionSummary: policyEvalResult.notes,
            rejectionReasons: policyEvalResult.rejection_reasons
          }
        });
        return { message: "Claim rejected by medical policy." };
      }

      // --- Phase G: Agent 3 Module 4 (Financial Calculator) ---
      logger.log(`Triggering Agent 3 (Module 4: Financial Calculator) for claim ${claimId}`);
      const financialTaskResult = await calculateFinancialPayoutTask.triggerAndWait({
        approvedLineItems: policyEvalResult.approved_line_items,
        claimCategory,
        hospitalName: extractionOutput.hospitals?.[0]
      });

      if (!financialTaskResult.ok) {
        throw new Error(`Financial Calculator Task failed: ${financialTaskResult.error}`);
      }
      const financialResult = financialTaskResult.output;

      await prisma.traceEntry.create({
        data: {
          claimId,
          agentName: 'FINANCIAL_CALCULATOR',
          stepOrder: 6,
          status: 'PASS',
          input: {
            approvedLineItems: policyEvalResult.approved_line_items,
            claimCategory
          },
          output: financialResult as any,
          checks: [
            { check: "Co-Pay Calculation", passed: true, reason: `Applied ${financialResult.appliedLimits.copayPercent}% copay.` },
            { check: "Sub-Limit Enforcement", passed: financialResult.totalApprovedAmount - financialResult.copayAmount <= financialResult.appliedLimits.subLimit, reason: `Sub-limit is ₹${financialResult.appliedLimits.subLimit}` },
            { check: "Global Limit Enforcement", passed: financialResult.payableAmount <= financialResult.appliedLimits.globalClaimLimit, reason: `Global limit is ₹${financialResult.appliedLimits.globalClaimLimit}` }
          ]
        }
      });

      logger.log(`Agent 3 Module 4 Completed. Final Payable: ₹${financialResult.payableAmount}`);

      const finalDecisionMap = {
        'MEDICAL_APPROVED': 'APPROVED',
        'PARTIAL_APPROVAL': 'PARTIAL',
        'MEDICAL_REJECTED': 'REJECTED'
      } as const;

      await prisma.claim.update({
        where: { id: claimId },
        data: {
          status: 'COMPLETED',
          decision: finalDecisionMap[policyEvalResult.decision as keyof typeof finalDecisionMap] as any,
          decisionSummary: `Claim Processed. ${financialResult.breakdown}. Medical notes: ${policyEvalResult.notes}`,
          rejectionReasons: policyEvalResult.rejection_reasons,
          approvedAmount: financialResult.payableAmount,
          financialBreakdown: financialResult as any
        }
      });

      return { success: true, finalDecision: policyEvalResult.decision };

    } catch (extError: any) {
      logger.error('Agent AI Error:', { error: extError });
      await prisma.traceEntry.create({
        data: {
          claimId,
          agentName: 'DOCUMENT_PARSER',
          stepOrder: 2,
          status: 'FAIL',
          input: { verifiedDocuments },
          output: { error: extError.message || "Extraction pipeline crashed" },
        }
      });
      // Optionally update claim status to FAILED so it doesn't get stuck in PROCESSING forever
      await prisma.claim.update({
        where: { id: claimId },
        data: { status: 'FAILED', errorMessage: extError.message }
      });
      throw extError;
    }
  },
});
