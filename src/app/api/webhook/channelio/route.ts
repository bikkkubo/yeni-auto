import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateResponseDraft } from '@/lib/openai/client';
import { findSimilarDocuments } from '@/lib/supabase/client';
import { sendResponseToOperators } from '@/lib/slack/client';
import { verifyWebhookSignature } from '@/lib/utils/errorHandler';

// Error handling function without the circular dependency
async function handleApiError(error: Error | unknown, context: string) {
  console.error(`[${context}] Error:`, error);
  
  // Note: In a production app, we'd want to notify Slack here
  // but we're avoiding the circular dependency with the errorHandler
  
  return new NextResponse(
    JSON.stringify({ error: 'Internal Server Error' }),
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
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
  return NextResponse.json({ 
    status: 'ok',
    message: 'Channelio webhook is ready to receive inquiries'
  });
} 