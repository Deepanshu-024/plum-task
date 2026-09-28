import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const claims = await prisma.claim.findMany({
      where: {
        userId: '922cb6e2-59ca-4f09-9d44-b9e6de144fa5'
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        documents: true
      }
    });
    
    return NextResponse.json(claims);
  } catch (error: any) {
    console.error('Failed to fetch evals claims:', error);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}
