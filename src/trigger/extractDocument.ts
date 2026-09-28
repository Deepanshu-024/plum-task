import { task } from "@trigger.dev/sdk/v3";
import { extractPrescription } from "@/agents/prescriptionAgent";
import { extractHospitalBill } from "@/agents/hospitalBillAgent";
import { extractLabReport } from "@/agents/labReportAgent";
import { getMimeType } from "@/agents/extractorUtils";
import { VerifiedDocument } from "@/agents/schemas";

export const extractSingleDocumentTask = task({
  id: "extract-single-document",
  maxDuration: 120, // 2 mins per document
  run: async (doc: VerifiedDocument) => {
    const mimeType = getMimeType(doc.url, doc.mimeType);

    if (doc.detectedType === 'PRESCRIPTION') {
      const data = await extractPrescription(doc.url, mimeType);
      return { type: 'PRESCRIPTION', data, url: doc.url };
    }
    else if (['HOSPITAL_BILL', 'PHARMACY_BILL', 'DENTAL_REPORT'].includes(doc.detectedType)) {
      const data = await extractHospitalBill(doc.url, mimeType);
      return { type: 'BILL', data, url: doc.url };
    }
    else if (['LAB_REPORT', 'DIAGNOSTIC_REPORT', 'DISCHARGE_SUMMARY'].includes(doc.detectedType)) {
      const data = await extractLabReport(doc.url, mimeType);
      return { type: 'REPORT', data, url: doc.url };
    }

    return null;
  }
});
