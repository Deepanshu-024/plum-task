'use client'

import { useState, useRef, FormEvent } from 'react'
import { Upload, Paperclip, FileText, Check, ShieldCheck, X, ArrowUpRight, Loader2 } from 'lucide-react'
import policy from '../../policy_terms.json'

export function NewClaim({ close }: { close: () => void }) {
  const [category, setCategory] = useState<string>('CONSULTATION');
  const [files, setFiles] = useState<Record<string, File>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [failedDocs, setFailedDocs] = useState<any[]>([]);

  // Create a ref map for each slot
  const fileInputRefs = useRef<Record<string, HTMLInputElement>>({});

  const handleFileChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles((prev) => ({ ...prev, [docType]: e.target.files![0] }));
      setAiError(null); // Clear error when user changes a file
      setFailedDocs((prev) => prev.filter(d => d.declaredType !== docType));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Capture form data synchronously before any async operations
    const formData = new FormData(e.currentTarget);
    const payloadFields = {
      employeeId: formData.get('employeeId'),
      policyId: formData.get('policyId'),
      claimCategory: formData.get('claimCategory'),
      treatmentDate: formData.get('treatmentDate'),
      claimedAmount: formData.get('claimedAmount'),
    };

    setIsSubmitting(true);
    setAiError(null);
    setFailedDocs([]);

    try {
      const uploadedBlobs = [];

      // Upload each mapped file to Vercel Blob
      for (const [docType, file] of Object.entries(files)) {
        const response = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}`,
          {
            method: 'POST',
            body: file,
          }
        );

        if (!response.ok) {
          throw new Error('Failed to upload ' + file.name);
        }

        const newBlob = await response.json();
        uploadedBlobs.push({
          url: newBlob.url,
          declaredType: docType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type
        });
      }

      console.log('Successfully uploaded blobs with types:', uploadedBlobs);

      const payload = {
        claimId,
        ...payloadFields,
        documents: uploadedBlobs,
      };

      const claimRes = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!claimRes.ok) {
        const err = await claimRes.json();
        if (err.claimId) setClaimId(err.claimId);
        if (err.failedDocs) setFailedDocs(err.failedDocs);
        setAiError(err.error || 'Failed to submit claim');
        throw new Error(err.error || 'Failed to create claim');
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error during submit:', error);
      // alert('Failed to submit claim. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentReqs = category
    ? (policy.document_requirements as any)[category]
    : { required: [], optional: [] };

  return (
    <div className="modal-backdrop">
      <div className="claim-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW SUBMISSION</p>
            <h2>Submit a claim</h2>
            <p>Upload documents and details to start automated review.</p>
          </div>
          <button className="icon-button" onClick={close} type="button"><X /></button>
        </div>
        {submitted ? (
          <div className="success-state">
            <div className="success-icon"><ShieldCheck size={28} /></div>
            <h3>Documents Accepted</h3>
            <p>Your documents passed initial AI verification. The claim is now processing.</p>
            <button className="primary-button" onClick={close} type="button">Back to overview</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {aiError && (
              <div style={{ margin: '20px 28px 0', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                <strong>Verification Failed:</strong> {aiError}
                {failedDocs.length > 0 && <div style={{marginTop: '4px', opacity: 0.8}}>Please review the specific document feedback below and re-upload.</div>}
              </div>
            )}
            <div className="form-grid">
              <label>Member ID<input required name="employeeId" defaultValue="EMP001" placeholder="e.g. EMP001" /></label>
              <label>Policy ID<input required name="policyId" defaultValue="PLUM_GHI_2024" /></label>

              <label>Treatment type
                <select required name="claimCategory" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="" disabled>Select category...</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="DIAGNOSTIC">Diagnostic</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="DENTAL">Dental</option>
                  <option value="VISION">Vision</option>
                  <option value="ALTERNATIVE_MEDICINE">Alternative Medicine</option>
                </select>
              </label>

              <label>Treatment date<input required type="date" name="treatmentDate" defaultValue="2024-11-01" /></label>
              <label>Claimed amount (₹)<input required type="number" step="0.01" name="claimedAmount" defaultValue="1500" placeholder="0.00" /></label>
              {/* <label>Hospital Name<input name="hospitalName" placeholder="Optional" /></label> */}
            </div>

            {category && (
              <div className="document-slots" style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#667688', margin: '0 28px 8px', fontWeight: 700 }}>Required Documents</h4>
                <div className="file-list" style={{ paddingBottom: '0' }}>
                  {currentReqs.required.map((docType: string) => {
                    const feedback = failedDocs.find(d => d.declaredType === docType);
                    return (
                    <div key={docType} className="file-item" style={{ marginBottom: '8px', border: feedback ? '1px solid #fecaca' : undefined, background: feedback ? '#fff5f5' : undefined }}>
                      <FileText style={{ color: files[docType] && !feedback ? '#1f917b' : undefined }} />
                      <span style={{flex: 1}}>
                        <strong>{docType.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}</strong>
                        {files[docType] ? (
                          <small style={{ color: feedback ? '#991b1b' : '#1f917b', display: 'block' }}>{files[docType].name} ({(files[docType].size / (1024 * 1024)).toFixed(2)} MB)</small>
                        ) : (
                          <small style={{ color: '#c55c5c', display: 'block' }}>Missing required file</small>
                        )}
                        {feedback && (
                          <div style={{ marginTop: '4px', fontSize: '12px', color: '#991b1b' }}>
                            ⚠ {feedback.reasoning}
                          </div>
                        )}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        ref={el => { if (el) fileInputRefs.current[docType] = el }}
                        onChange={(e) => handleFileChange(docType, e)}
                      />
                      <button type="button" className="outline-button" style={{ padding: '6px 12px' }} onClick={() => fileInputRefs.current[docType]?.click()}>
                        {files[docType] ? 'Change' : 'Upload'}
                      </button>
                    </div>
                  )})}
                </div>

                {currentReqs.optional.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#667688', margin: '12px 28px 8px', fontWeight: 700 }}>Optional Documents</h4>
                    <div className="file-list" style={{ paddingTop: '0' }}>
                      {currentReqs.optional.map((docType: string) => {
                        const feedback = failedDocs.find(d => d.declaredType === docType);
                        return (
                        <div key={docType} className="file-item" style={{ marginBottom: '8px', border: feedback ? '1px solid #fecaca' : undefined, background: feedback ? '#fff5f5' : undefined }}>
                          <FileText style={{ color: files[docType] && !feedback ? '#1f917b' : undefined }} />
                          <span style={{flex: 1}}>
                            <strong>{docType.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}</strong>
                            {files[docType] ? (
                              <small style={{ color: feedback ? '#991b1b' : '#1f917b', display: 'block' }}>{files[docType].name} ({(files[docType].size / (1024 * 1024)).toFixed(2)} MB)</small>
                            ) : (
                              <small style={{ display: 'block' }}>Optional attachment</small>
                            )}
                            {feedback && (
                              <div style={{ marginTop: '4px', fontSize: '12px', color: '#991b1b' }}>
                                ⚠ {feedback.reasoning}
                              </div>
                            )}
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            style={{ display: 'none' }}
                            ref={el => { if (el) fileInputRefs.current[docType] = el }}
                            onChange={(e) => handleFileChange(docType, e)}
                          />
                          <button type="button" className="outline-button" style={{ padding: '6px 12px' }} onClick={() => fileInputRefs.current[docType]?.click()}>
                            {files[docType] ? 'Change' : 'Upload'}
                          </button>
                        </div>
                      )})}
                    </div>
                  </>
                )}
              </div>
            )}

            {!category && (
              <div className="upload-box" style={{ marginTop: '20px', opacity: 0.5 }}>
                <p>Please select a Treatment Type first to see required documents.</p>
              </div>
            )}

            <div className="verification-note" style={{ marginTop: '20px' }}>
              <ShieldCheck />
              <span><strong>Early document verification enabled</strong><small>We&apos;ll check that the required prescription or bill is present before processing.</small></span>
            </div>

            <div className="modal-footer">
              <button className="outline-button" onClick={close} type="button">Cancel</button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  isSubmitting ||
                  !category ||
                  currentReqs.required.some((req: string) => !files[req])
                }
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Submit claim'}
                {!isSubmitting && <ArrowUpRight />}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
