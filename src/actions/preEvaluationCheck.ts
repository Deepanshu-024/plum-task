'use server';

export async function preEvaluationCheck(agent2Output: {
  rawExtractions: any[];
}) {
  console.log(`[AGENT 3: VALIDATOR] Running Pre-Evaluation Checks...`);

  const raw = agent2Output.rawExtractions;
  const checks = [];
  let passed = true;
  let decision = "CONTINUE";
  let reason = "All pre-evaluation checks passed. Safe to proceed to Policy Evaluation.";
  
  // 0. API Error / Extraction Failure Check
  const failedDocs = [];
  for (const doc of raw) {
    if (doc?.data?.confidence_score === 0.0 && doc?.data?.illegible_fields?.includes("ALL")) {
      failedDocs.push(`${doc.type} (${doc.url})`);
    }
  }

  if (failedDocs.length > 0) {
    passed = false;
    decision = "MANUAL_REVIEW";
    checks.push({
      check: "AI Extraction Failure Check",
      passed: false,
      reason: `AI failed to extract data (API Error or strict refusal) for: ${failedDocs.join(" | ")}`
    });
  } else {
    checks.push({
      check: "AI Extraction Failure Check",
      passed: true,
      reason: "All documents successfully processed by extraction agents."
    });
  }

  // 1. Patient Mismatch (TC003)
  const nameToDocs: Record<string, string[]> = {};
  for (const doc of raw) {
    if (!doc || !doc.data) continue;
    const name = doc.data.patient_name;
    if (name) {
      const normalizedName = name.trim().toLowerCase();
      if (!nameToDocs[normalizedName]) {
        nameToDocs[normalizedName] = [];
      }
      nameToDocs[normalizedName].push(`${doc.type} (${doc.url})`);
    }
  }

  const uniqueNames = Object.keys(nameToDocs);
  if (uniqueNames.length > 1) {
    passed = false;
    decision = "MANUAL_REVIEW";
    const breakdown = uniqueNames.map(name => {
      const docs = nameToDocs[name].join(" and ");
      const displayName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return `name '${displayName}' is found on ${docs}`;
    }).join("; ");
    checks.push({
      check: "Patient Mismatch Check",
      passed: false,
      reason: `Found multiple patient names: ${breakdown}`
    });
  } else if (uniqueNames.length === 1) {
    const displayName = uniqueNames[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    checks.push({
      check: "Patient Mismatch Check",
      passed: true,
      reason: `Patient name '${displayName}' consistently found across all documents.`
    });
  } else {
    checks.push({
      check: "Patient Mismatch Check",
      passed: true,
      reason: `No patient names extracted to verify.`
    });
  }

  // 2. Document Integrity / Tampering
  const tamperedDocs = [];
  for (const doc of raw) {
    if (doc?.data?.document_integrity?.tampering_flags?.length > 0) {
      tamperedDocs.push(`${doc.type} (${doc.url}) flagged for: ${doc.data.document_integrity.tampering_flags.join(", ")}`);
    }
  }
  
  if (tamperedDocs.length > 0) {
    passed = false;
    decision = "MANUAL_REVIEW";
    checks.push({
      check: "Document Tampering Check",
      passed: false,
      reason: `Potential tampering detected: ${tamperedDocs.join(" | ")}`
    });
  } else {
    checks.push({
      check: "Document Tampering Check",
      passed: true,
      reason: "No tampering flags detected across documents."
    });
  }

  // 3. Data Completeness / Illegible Fields
  const unreadableDocs = [];
  for (const doc of raw) {
    if (doc?.data?.illegible_fields?.length > 0) {
      unreadableDocs.push(`${doc.type} (${doc.url}) had illegible fields: ${doc.data.illegible_fields.join(", ")}`);
    }
  }

  if (unreadableDocs.length > 0) {
    passed = false;
    decision = "MANUAL_REVIEW";
    checks.push({
      check: "Data Completeness Check",
      passed: false,
      reason: `Unreadable or incomplete data detected: ${unreadableDocs.join(" | ")}`
    });
  } else {
    checks.push({
      check: "Data Completeness Check",
      passed: true,
      reason: "All key fields were readable."
    });
  }

  // 4. Low AI Confidence Check
  const lowConfidenceDocs = [];
  for (const doc of raw) {
    if (doc?.data?.confidence_score !== undefined && doc.data.confidence_score < 0.85) {
      lowConfidenceDocs.push(`${doc.type} (${doc.url}) scored ${doc.data.confidence_score}`);
    }
  }

  if (lowConfidenceDocs.length > 0) {
    passed = false;
    decision = "MANUAL_REVIEW";
    checks.push({
      check: "AI Confidence Check",
      passed: false,
      reason: `Low confidence in document extraction: ${lowConfidenceDocs.join(" | ")}`
    });
  } else {
    checks.push({
      check: "AI Confidence Check",
      passed: true,
      reason: "All extractions met the >= 0.85 confidence threshold."
    });
  }

  if (!passed) {
    console.warn(`[AGENT 3: VALIDATOR] 🚨 FAILED: One or more pre-evaluation checks failed.`);
    reason = "One or more pre-evaluation checks failed. Moving to MANUAL_REVIEW.";
  } else {
    console.log(`[AGENT 3: VALIDATOR] ✅ All Pre-Evaluation Checks Passed!`);
  }

  return {
    passed,
    decision,
    reason,
    checks
  };
}
