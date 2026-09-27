import { z } from 'zod';
import { VerifiedDocument, PrescriptionSchema, HospitalBillSchema, LabReportSchema } from './schemas';

export type { VerifiedDocument };

export function aggregateExtractionResults(rawResults: any[]) {
  console.log(`[AGENT 2: EXTRACTOR] ✅ Aggregating results for ${rawResults.length} documents...`);

  const aggregated = {
    patientNames: new Set<string>(),
    diagnoses: new Set<string>(),
    treatments: new Set<string>(),
    investigations: new Set<string>(),
    lineItems: [] as { description: string, amount: number }[],
    totalBilledAmount: 0,
    hospitalNames: new Set<string>(),
    doctorNames: new Set<string>(),
    lowestConfidence: 1.0,
    extractionErrors: 0,
    tamperingFlags: new Set<string>(),
    documentIntegrityIssues: false
  };

  for (const result of rawResults) {
    if (!result) continue;
    
    if (result.type === 'PRESCRIPTION') {
      const rx = result.data as z.infer<typeof PrescriptionSchema>;
      if (rx.patient_name) aggregated.patientNames.add(rx.patient_name);
      if (rx.doctor_name) aggregated.doctorNames.add(rx.doctor_name);
      rx.diagnoses.forEach(d => aggregated.diagnoses.add(d));
      rx.medicines?.forEach(m => aggregated.treatments.add(m.name));
      if (rx.treatment_type) aggregated.treatments.add(rx.treatment_type);
      rx.investigations.forEach(i => aggregated.investigations.add(i));
      
      if (rx.confidence_score < aggregated.lowestConfidence) aggregated.lowestConfidence = rx.confidence_score;
      if (rx.document_integrity.tampering_flags.length > 0) aggregated.documentIntegrityIssues = true;
      rx.document_integrity.tampering_flags.forEach(f => aggregated.tamperingFlags.add(f));
      if (rx.illegible_fields.includes("ALL")) aggregated.extractionErrors += 1;
    }

    if (result.type === 'BILL') {
      const bill = result.data as z.infer<typeof HospitalBillSchema>;
      if (bill.patient_name) aggregated.patientNames.add(bill.patient_name);
      if (bill.hospital_name) aggregated.hospitalNames.add(bill.hospital_name);
      bill.line_items.forEach(item => {
        aggregated.lineItems.push(item);
        aggregated.treatments.add(item.description);
      });
      if (bill.total_amount) {
        aggregated.totalBilledAmount += bill.total_amount;
      }
      
      if (bill.confidence_score < aggregated.lowestConfidence) aggregated.lowestConfidence = bill.confidence_score;
      if (bill.document_integrity.tampering_flags.length > 0) aggregated.documentIntegrityIssues = true;
      bill.document_integrity.tampering_flags.forEach(f => aggregated.tamperingFlags.add(f));
      if (bill.illegible_fields.includes("ALL")) aggregated.extractionErrors += 1;
    }

    if (result.type === 'REPORT') {
      const report = result.data as z.infer<typeof LabReportSchema>;
      if (report.patient_name) aggregated.patientNames.add(report.patient_name);
      if (report.test_name) aggregated.investigations.add(report.test_name);
      
      if (report.confidence_score < aggregated.lowestConfidence) aggregated.lowestConfidence = report.confidence_score;
      if (report.document_integrity.tampering_flags.length > 0) aggregated.documentIntegrityIssues = true;
      report.document_integrity.tampering_flags.forEach(f => aggregated.tamperingFlags.add(f));
      if (report.illegible_fields.includes("ALL")) aggregated.extractionErrors += 1;
    }
  }

  const finalPayload = {
    patientNamesFound: Array.from(aggregated.patientNames),
    diagnoses: Array.from(aggregated.diagnoses),
    treatments: Array.from(aggregated.treatments),
    investigations: Array.from(aggregated.investigations),
    hospitals: Array.from(aggregated.hospitalNames),
    doctors: Array.from(aggregated.doctorNames),
    lineItems: aggregated.lineItems,
    totalBilledAmount: aggregated.totalBilledAmount,
    confidenceScore: aggregated.lowestConfidence === 1.0 && rawResults.length === 0 ? 0 : aggregated.lowestConfidence,
    hasExtractionErrors: aggregated.extractionErrors > 0,
    hasTamperingFlags: aggregated.documentIntegrityIssues,
    tamperingFlags: Array.from(aggregated.tamperingFlags),
    rawExtractions: rawResults // Keeping this for the Audit Trace!
  };

  console.log(`[AGENT 2: EXTRACTOR] 🎉 Aggregation complete! Found ${finalPayload.lineItems.length} line items, total amount: ₹${finalPayload.totalBilledAmount}`);
  return finalPayload;
}
