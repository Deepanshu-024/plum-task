'use client'

import { useState, useRef, FormEvent } from 'react'
import { Upload, Paperclip, FileText, Check, ShieldCheck, X, ArrowUpRight, Loader2 } from 'lucide-react'

export function NewClaim({ close }: { close: () => void }) { 
  const [files, setFiles] = useState<File[]>([]); 
  const [submitted, setSubmitted] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const uploadedBlobs = [];
      
      // Upload each file to Vercel Blob
      for (const file of files) {
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
        uploadedBlobs.push(newBlob);
      }
      
      console.log('Successfully uploaded blobs:', uploadedBlobs);
      
      // TODO: Create the claim in the database using the returned blob URLs
      // e.g. await fetch('/api/claims', { ... })
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error during upload:', error);
      alert('Failed to submit claim. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <div className="success-icon"><Check /></div>
            <h3>Claim submitted successfully</h3>
            <p>Your claim is now in the processing queue. We&apos;ll notify you when a decision is ready.</p>
            <button className="primary-button" onClick={close} type="button">Back to overview</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>Member ID<input required name="employeeId" placeholder="e.g. EMP001" /></label>
              <label>Policy ID<input required name="policyId" defaultValue="PLUM_GHI_2024" /></label>
              
              <label>Treatment type
                <select required name="claimCategory" defaultValue="">
                  <option value="" disabled>Select category...</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="DIAGNOSTIC">Diagnostic</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="DENTAL">Dental</option>
                  <option value="VISION">Vision</option>
                  <option value="ALTERNATIVE_MEDICINE">Alternative Medicine</option>
                </select>
              </label>
              
              <label>Treatment date<input required type="date" name="treatmentDate" /></label>
              <label>Claimed amount (₹)<input required type="number" step="0.01" name="claimedAmount" placeholder="0.00" /></label>
              <label>Hospital Name<input name="hospitalName" placeholder="Optional" /></label>
            </div>
            
            <div className="upload-box">
              <div className="upload-icon"><Upload /></div>
              <div>
                <strong>Drop medical documents here</strong>
                <p>PDF, JPG or PNG · Max 10 MB each</p>
              </div>
              <input 
                type="file" 
                multiple 
                accept="image/*,application/pdf" 
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button 
                type="button" 
                className="outline-button" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip /> Browse files
              </button>
            </div>

            <div className="file-list">
              {files.map((file, i) => (
                <div className="file-item" key={i}>
                  <FileText />
                  <span>
                    <strong>{file.name}</strong>
                    <small>{(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to verify</small>
                  </span>
                  <Check className="file-check" />
                </div>
              ))}
              {files.length === 0 && (
                <div style={{ padding: '0 9px', fontSize: '11px', color: '#888' }}>
                  No files selected yet. Please upload at least one document.
                </div>
              )}
            </div>

            <div className="verification-note">
              <ShieldCheck />
              <span><strong>Early document verification enabled</strong><small>We&apos;ll check that the required prescription or bill is present before processing.</small></span>
            </div>

            <div className="modal-footer">
              <button className="outline-button" onClick={close} type="button">Cancel</button>
              <button className="primary-button" type="submit" disabled={isSubmitting || files.length === 0}>
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
