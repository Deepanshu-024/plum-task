export const fallbackIntegrity = {
  is_original: null,
  tampering_flags: [],
  scan_quality: "UNREADABLE" as const,
  physical_condition_flags: [],
  consistency_checks: {
    ink_consistency: "CANNOT_DETERMINE" as const,
    paper_background_consistency: "CANNOT_DETERMINE" as const,
    date_plausibility: "CANNOT_DETERMINE" as const,
    amount_plausibility: "CANNOT_DETERMINE" as const
  },
  integrity_confidence: 0.0
};

export function getMimeType(url: string, providedMimeType?: string) {
  if (providedMimeType) return providedMimeType;
  if (url.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}
