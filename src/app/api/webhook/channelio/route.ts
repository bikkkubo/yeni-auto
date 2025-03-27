import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateResponseDraft } from '@/lib/openai/client';
import { findSimilarDocuments } from '@/lib/supabase/client';
import { sendResponseToOperators } from '@/lib/slack/client';
import { verifyWebhookSignature } from '@/lib/utils/errorHandler';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Error handling function without the circular dependency
async function handleApiError(error: Error | unknown, context: string) {
  console.error(`[${context}] Error:`, error);
  
  // Note: In a production app, we'd want to notify Slack here
  // but we're avoiding the circular dependency with the errorHandler
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  return new NextResponse(
    JSON.stringify({ error: 'Internal Server Error', details: errorMessage }),
    { status: 500 }
  );
}

// Function to check if all required environment variables are set
function checkRequiredEnvVars() {
  // Skip checks during build time
  if (isBuildTime) return;
  
  const requiredVars = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SLACK_BOT_TOKEN',
    'SLACK_CHANNEL_ID'
  ];
  
  const missing = requiredVars.filter(name => !process.env[name]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export async function POST(request: NextRequest) {
  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  try {
    // Check required environment variables
    checkRequiredEnvVars();
    
    // 1. Get the raw request body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    
    // 2. Verify webhook signature (if needed)
    const signature = request.headers.get('x-channelio-signature') || '';
    if (!verifyWebhookSignature(signature, rawBody)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      );
    }
    
    // 3. Extract inquiry details
    // Note: This is a simplified example. Adjust according to actual Channelio webhook format
    const { 
      customerName = 'Unknown Customer',
      inquiry = '',
      chatLink = ''
    } = body;
    
    if (!inquiry) {
      return new NextResponse(
        JSON.stringify({ error: 'No inquiry text provided' }),
        { status: 400 }
      );
    }
    
    // 4. Generate embedding for the inquiry
    const embedding = await generateEmbedding(inquiry);
    
    // 5. Find similar documents using vector search
    const similarDocuments = await findSimilarDocuments(embedding);
    
    // 6. Generate response draft using RAG
    const responseDraft = await generateResponseDraft(inquiry, similarDocuments);
    
    // 7. Send to Slack for operator review
    await sendResponseToOperators(customerName, inquiry, responseDraft, chatLink);
    
    // 8. Return success response
    return NextResponse.json({ success: true });
    
  } catch (error) {
    return handleApiError(error, 'channelio-webhook');
  }
}

// Optionally implement GET for testing the endpoint
export async function GET() {
  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  return NextResponse.json({ 
    status: 'ok',
    message: 'Channelio webhook is ready to receive inquiries'
  });
} 