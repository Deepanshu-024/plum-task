import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;

    const traces = await prisma.traceEntry.findMany({
      where: { claimId: params.id },
      orderBy: { stepOrder: 'asc' }
    });

    return NextResponse.json(traces);
  } catch (error: any) {
    console.error("Failed to fetch traces:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
