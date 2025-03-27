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
  console.log(`[${new Date().toISOString()}] Received request for: ${request.url}`);
  
  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  try {
    // Check required environment variables
    checkRequiredEnvVars();
    
    // Log the request headers and method
    console.log(`[${new Date().toISOString()}] Request method: ${request.method}`);
    console.log(`[${new Date().toISOString()}] Request headers:`, Object.fromEntries(request.headers.entries()));
    
    // 1. Get the raw request body for signature verification
    const rawBody = await request.text();
    console.log(`[${new Date().toISOString()}] Request body:`, rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
    
    const body = JSON.parse(rawBody);
    
    // Log the entire request payload and headers for inspection
    console.log('Channelio Webhook Headers:', Object.fromEntries(request.headers.entries()));
    console.log('Channelio Webhook Payload:', JSON.stringify(body, null, 2));
    
    // Send a notification to Slack with the payload structure
    if (process.env.SLACK_ERROR_CHANNEL_ID) {
      try {
        await sendResponseToOperators(
          'Webhook Payload Inspector', 
          `Received Channelio webhook payload:\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\``,
          'This is a test message to inspect the Channelio payload structure.',
          ''
        );
      } catch (slackError) {
        console.error('Failed to send payload inspection to Slack:', slackError);
      }
    }
    
    // 2. Verify webhook signature (if needed)
    const signature = request.headers.get('x-channelio-signature') || '';
    if (!verifyWebhookSignature(signature, rawBody)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      );
    }
    
    // 3. Extract inquiry details - This is tentative, based on examining the payload
    // We'll need to update this once we've seen the actual payload structure
    const {
      data = {},
      event = '',
    } = body;
    
    // Try different possible field paths based on common webhook structures
    let customerName = 'Unknown Customer';
    let inquiry = '';
    let chatLink = '';
    
    // Check if this is a message event
    if (event === 'message.created' && data) {
      // Possible structures - these are guesses until we see the actual payload
      inquiry = data.message?.content || data.content || data.text || data.body || '';
      customerName = data.customer?.name || data.user?.name || data.sender?.name || 'Unknown Customer';
      chatLink = data.conversation?.url || data.url || data.link || '';
    }
    
    if (!inquiry) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'No inquiry text identified in payload',
          received: body
        }),
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
  console.log(`[${new Date().toISOString()}] Received GET request`);
  
  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  return NextResponse.json({ 
    status: 'ok',
    message: 'Channelio webhook is ready to receive inquiries'
  });
} 