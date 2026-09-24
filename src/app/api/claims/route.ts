import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

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
      employeeId,
      policyId,
      claimCategory,
      treatmentDate,
      claimedAmount,
      hospitalName,
      documents
    } = body;

    // Validate minimum required fields
    if (!employeeId || !policyId || !claimCategory || !treatmentDate || !claimedAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'At least one document is required' }, { status: 400 });
    }

    // Create the claim in DB
    const claim = await prisma.claim.create({
      data: {
        userId: user.id,
        employeeId,
        policyId,
        claimCategory,
        treatmentDate: new Date(treatmentDate),
        claimedAmount: parseFloat(claimedAmount),
        status: 'PROCESSING', // Skipping VERIFYING since AI is deferred
        documents: {
          create: documents.map((doc: any) => ({
            fileId: crypto.randomUUID(),
            fileName: doc.fileName || 'document.pdf',
            fileUrl: doc.url,
            mimeType: doc.mimeType || 'application/pdf',
            fileSize: doc.fileSize || 0,
            declaredType: doc.declaredType,
            detectedType: 'UNKNOWN', // Agent 1 will update this later
          }))
        }
      },
    });

    return NextResponse.json({ success: true, claimId: claim.id });
  } catch (error: any) {
    console.error('Error creating claim:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
