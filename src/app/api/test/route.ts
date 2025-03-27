import { NextRequest, NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function GET(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] Test GET received: ${request.url}`);
  
  return NextResponse.json({
    status: 'ok',
    message: 'Test GET endpoint works',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] Test POST received: ${request.url}`);
  
  let body;
  try {
    const rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch {
    // Empty catch block without variable
    body = { error: 'Failed to parse body' };
  }
  
  return NextResponse.json({
    status: 'ok',
    message: 'Test POST endpoint works',
    receivedBody: body,
    timestamp: new Date().toISOString()
  });
} 