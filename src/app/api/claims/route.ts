import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const body = await request.json();
    const {
      claimId,
      employeeId,
      policyId,
      claimCategory,
      treatmentDate,
      claimedAmount,
      documents
    } = body;

    // Validate minimum required fields
    if (!employeeId || !policyId || !claimCategory || !treatmentDate || !claimedAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'At least one document is required' }, { status: 400 });
    }

    // --- Phase A: Create or update Claim ---
    let claim;
    if (claimId) {
      claim = await prisma.claim.update({
        where: { id: claimId },
        data: {
          employeeId,
          policyId,
          claimCategory,
          treatmentDate: new Date(treatmentDate),
          claimedAmount: parseFloat(claimedAmount),
          status: 'VERIFYING',
        }
      });
    } else {
      claim = await prisma.claim.create({
        data: {
          userId: user.id,
          employeeId,
          policyId,
          claimCategory,
          treatmentDate: new Date(treatmentDate),
          claimedAmount: parseFloat(claimedAmount),
          status: 'VERIFYING',
        },
      });
    }

    // --- Phase B: Run Agent 1 (Document Verification) ---
    const { verifyDocuments } = await import('@/agents/documentVerifier');

    let aiOutput;
    try {
      aiOutput = await verifyDocuments(documents);
    } catch (aiError) {
      console.error('Agent 1 AI Error:', aiError);
      aiOutput = {
        isAccepted: false,
        reasoning: "Failed to run AI verification on documents. They might be unsupported formats or too large.",
        documents: []
      };
    }

    const { isAccepted, reasoning, documents: analyzedDocs } = aiOutput;

    // --- Phase C: Audit Trail & Database Sync ---
    await prisma.traceEntry.create({
      data: {
        claimId: claim.id,
        agentName: 'DOCUMENT_VERIFIER',
        stepOrder: 1,
        status: isAccepted ? 'PASS' : 'FAIL',
        input: { submittedDocuments: documents },
        output: { isAccepted, reasoning, analyzedDocs },
      }
    });

    if (!isAccepted) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: { status: 'DOC_ERROR' }
      });

      // Build per-document feedback for the frontend
      const failedDocs = analyzedDocs
        .map((d: any, i: number) => ({
          url: documents[i].url,
          fileName: documents[i].fileName || `Document ${i + 1}`,
          declaredType: d.declaredType,
          detectedType: d.detectedType,
          matchesDeclaredType: d.matchesDeclaredType,
          isReadable: d.isReadable,
          reasoning: d.reasoning,
        }))
        .filter((d: any) => !d.matchesDeclaredType || !d.isReadable);

      return NextResponse.json({
        error: reasoning,
        claimId: claim.id,
        failedDocs,
      }, { status: 400 });
    }

    // All docs passed — sync to database
    await prisma.claimDocument.deleteMany({
      where: { claimId: claim.id }
    });

    await prisma.claimDocument.createMany({
      data: documents.map((doc: any, index: number) => {
        const analysis = analyzedDocs[index];
        return {
          claimId: claim.id,
          fileId: crypto.randomUUID(),
          fileName: doc.fileName || 'document.pdf',
          fileUrl: doc.url,
          mimeType: doc.mimeType || 'application/pdf',
          fileSize: doc.fileSize || 0,
          declaredType: doc.declaredType,
          detectedType: analysis?.detectedType || 'UNKNOWN',
        };
      })
    });

    await prisma.claim.update({
      where: { id: claim.id },
      data: { status: 'PROCESSING' }
    });

    // --- Phase D: Run Agent 2 (Information Extraction) ---
    // TODO (trigger.dev): In the future, the below block should be moved into a background job 
    // triggered via trigger.dev to avoid Vercel edge/lambda timeout issues, as AI extraction can be slow.
    // e.g., await trigger.sendEvent({ name: "extract.data", payload: { claimId: claim.id, documents } })
    

    // Build the array of VerifiedDocuments
    const verifiedDocuments = documents.map((doc: any, index: number) => ({
      url: doc.url,
      detectedType: analyzedDocs[index]?.detectedType || 'UNKNOWN',
      mimeType: doc.mimeType || 'application/pdf'
    }));

    try {
      // --- Phase B: Hand off to Trigger.dev Background Worker ---
      console.log(`\n[ROUTE] >> Handoff to Trigger.dev for claim ${claim.id}`);
      
      const { processClaimTask } = await import('@/trigger/processClaim');
      
      // Update claim to PROCESSING state before kicking off the background job
      await prisma.claim.update({
        where: { id: claim.id },
        data: { status: 'PROCESSING' }
      });

      // Fire and forget
      const triggerRun = await processClaimTask.trigger({
        claimId: claim.id,
        employeeId: claim.employeeId,
        treatmentDate: claim.treatmentDate.toISOString(),
        claimedAmount: Number(claim.claimedAmount),
        claimCategory: claim.claimCategory,
        verifiedDocuments
      });

      console.log(`[ROUTE] << Trigger.dev task started with run ID: ${triggerRun.id}`);
      
      // Optional: Store the trigger run ID on the claim if we want to poll/cancel it later
      await prisma.claim.update({
        where: { id: claim.id },
        data: { triggerTaskId: triggerRun.id }
      });
    } catch (extError: any) {
      console.error('Trigger Handoff Error:', extError);
      await prisma.claim.update({
        where: { id: claim.id },
        data: { status: 'FAILED', errorMessage: extError.message || "Failed to trigger background processing" }
      });
    }

    return NextResponse.json({ success: true, claimId: claim.id });
  } catch (error: any) {
    console.error('Error handling claim:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const clerkId = session?.userId;
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const claims = await prisma.claim.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json(claims);
  } catch (error: any) {
    console.error("Failed to fetch claims:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
