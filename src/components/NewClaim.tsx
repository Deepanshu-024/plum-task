'use client'

import { useState } from 'react'
import { Upload, Paperclip, FileText, Check, ShieldCheck, X, ArrowUpRight } from 'lucide-react'

export function NewClaim({ close }: { close: () => void }) { 
  const [files, setFiles] = useState<string[]>(['hospital_bill_raj.pdf']); 
  const [submitted, setSubmitted] = useState(false); 
  
  return (
    <div className="modal-backdrop">
      <div className="claim-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW SUBMISSION</p>
            <h2>Submit a claim</h2>
            <p>Upload documents and details to start automated review.</p>
          </div>
          <button className="icon-button" onClick={close}><X /></button>
        </div>
        {submitted ? (
          <div className="success-state">
            <div className="success-icon"><Check /></div>
            <h3>Claim submitted successfully</h3>
            <p>CLM-24092 is now in the processing queue. We&apos;ll notify you when a decision is ready.</p>
            <button className="primary-button" onClick={close}>Back to overview</button>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <label>Member ID<input defaultValue="EMP001" /></label>
              <label>Treatment type
                <select defaultValue="consultation">
                  <option value="consultation">Consultation</option>
                  <option>Diagnostic</option>
                  <option>Pharmacy</option>
                  <option>Dental</option>
                  <option>Vision</option>
                </select>
              </label>
              <label>Claimed amount<input defaultValue="1800" /></label>
              <label>Treatment date<input type="date" defaultValue="2024-06-18" /></label>
            </div>
            <div className="upload-box">
              <div className="upload-icon"><Upload /></div>
              <div>
                <strong>Drop medical documents here</strong>
                <p>PDF, JPG or PNG · Max 10 MB each</p>
              </div>
              <button className="outline-button"><Paperclip /> Browse files</button>
            </div>
            <div className="file-list">
              {files.map(file => (
                <div className="file-item" key={file}>
                  <FileText />
                  <span><strong>{file}</strong><small>1.2 MB · Ready to verify</small></span>
                  <Check className="file-check" />
                </div>
              ))}
            </div>
            <div className="verification-note">
              <ShieldCheck />
              <span><strong>Early document verification enabled</strong><small>We&apos;ll check that the required prescription or bill is present before processing.</small></span>
            </div>
            <div className="modal-footer">
              <button className="outline-button" onClick={close}>Cancel</button>
              <button className="primary-button" onClick={() => setSubmitted(true)}>Submit claim <ArrowUpRight /></button>
            </div>
          </>
        )}
      </div>
    </div>
  ) 
}
