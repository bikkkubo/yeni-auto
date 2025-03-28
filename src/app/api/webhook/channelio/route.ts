import { NextRequest, NextResponse } from 'next/server';
import { sendResponseToOperators } from '@/lib/slack/client';
import { generateEmbedding, generateResponseDraft, findSimilarDocuments } from '@/lib/ai/openai';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Error handling function without the circular dependency
async function handleApiError(error: Error | unknown, context: string) {
  console.error(`[${context}] Error:`, error);
  
  // Note: In a production app, we'd want to notify Slack here
  // but we're avoiding the circular dependency with the errorHandler
  
  const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
  
  return new NextResponse(
    JSON.stringify({ error: '内部サーバーエラー', details: errorMessage }),
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
  console.log(`[${new Date().toISOString()}] Received POST request for: ${request.url}`);
  
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  try {
    checkRequiredEnvVars();
    
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSONの解析に失敗:', parseError);
      return new NextResponse(
        JSON.stringify({ error: '不正なJSONペイロード' }),
        { status: 400 }
      );
    }

    // Extract inquiry details from the webhook payload
    const inquiry = body.message?.text || '';
    const chatId = body.chat?.id || '';
    
    if (!inquiry) {
      return new NextResponse(
        JSON.stringify({ error: '問い合わせ内容が見つかりません' }),
        { status: 400 }
      );
    }

    // Generate embedding and find similar documents
    const embedding = await generateEmbedding(inquiry);
    const similarDocuments = await findSimilarDocuments(embedding);
    
    // Generate response draft using RAG
    const responseDraft = await generateResponseDraft(inquiry, similarDocuments);

    // Send to Slack for operator review
    await sendResponseToOperators(
      'お客様からの新規問い合わせ',
      inquiry,
      responseDraft,
      chatId
    );

    return NextResponse.json({ 
      success: true,
      message: 'Webhookの処理が完了しました',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Webhookの処理中にエラーが発生:', error);
    return handleApiError(error, 'channelio-webhook');
  }
}

// Optionally implement GET for testing the endpoint
export async function GET(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] Received GET request: ${request.url}`);
  
  // Check if this is a Channelio request with token in URL
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    console.log(`[${new Date().toISOString()}] Found token in URL: ${token}`);
  }
  
  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: 'ok', buildTime: true });
  }
  
  // Try to send a test notification to Slack
  try {
    await sendResponseToOperators(
      'GETリクエストのテスト', 
      `webhookエンドポイントにGETリクエストを受信:\n\nURL: ${request.url}\n\nトークン: ${token || 'なし'}`,
      'エンドポイントがGETリクエストで正常にアクセス可能です。',
      ''
    );
    console.log('GETリクエストのSlack通知を送信しました');
  } catch (slackError) {
    console.error('GETテストのSlack通知の送信に失敗:', slackError);
  }
  
  return NextResponse.json({ 
    status: 'ok',
    message: 'Channelioのwebhookは問い合わせを受け付ける準備ができています',
    timestamp: new Date().toISOString()
  });
} 