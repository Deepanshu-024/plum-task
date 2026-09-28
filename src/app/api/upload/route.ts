import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  // Using public access so the agent/dashboard can easily download/read the files
  const blob = await put(filename, request.body, {
    access: 'public',
    addRandomSuffix: true,
  });

  return NextResponse.json(blob);
}
