import { NextRequest, NextResponse } from 'next/server';
import { sendResponseToOperators } from '@/lib/slack/client';
import { generateEmbedding, generateResponseDraft, findSimilarDocuments } from '@/lib/ai/openai';
import { verifyWebhookSignature } from '@/lib/utils/errorHandler';

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
    
    // Get the raw request body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature if provided
    const signature = request.headers.get('x-channelio-signature') || '';
    if (signature) {
      const isValid = verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        console.error('不正なwebhook署名');
        return new NextResponse(
          JSON.stringify({ error: '不正な署名' }),
          { status: 401 }
        );
      }
    }
    
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
    const userName = body.user?.name || '不明な顧客';
    const chatId = body.chat?.id || '';
    
    if (!inquiry) {
      return new NextResponse(
        JSON.stringify({ error: '問い合わせ内容が見つかりません' }),
        { status: 400 }
      );
    }

    console.log(`[Webhook] 問い合わせ: "${inquiry.substring(0, 100)}${inquiry.length > 100 ? '...' : ''}"`);
    console.log(`[Webhook] ユーザー: "${userName}", チャットID: "${chatId}"`);

    try {
      // 埋め込みを生成
      console.log('[Webhook] 埋め込みベクトルを生成中...');
      const embedding = await generateEmbedding(inquiry);
      console.log('[Webhook] 埋め込みベクトル生成完了 (次元数:', embedding.length, ')');
      
      // 類似ドキュメントを検索
      console.log('[Webhook] 類似ドキュメントを検索中...');
      const similarDocuments = await findSimilarDocuments(embedding);
      console.log('[Webhook] 類似ドキュメント検索完了 (件数:', similarDocuments.length, ')');
      
      // 回答案を生成
      console.log('[Webhook] AI回答案を生成中...');
      const responseDraft = await generateResponseDraft(inquiry, similarDocuments);
      console.log('[Webhook] AI回答案生成完了');
      
      // Slackに通知
      console.log('[Webhook] Slackに通知送信中...');
      await sendResponseToOperators(
        'お客様からの新規問い合わせ',
        inquiry,
        responseDraft,
        chatId
      );
      console.log('[Webhook] Slack通知送信完了');
  
      return NextResponse.json({ 
        success: true,
        message: 'Webhookの処理が完了しました',
        timestamp: new Date().toISOString()
      });
    } catch (processingError) {
      console.error('[Webhook] 処理中にエラーが発生:', processingError);
      
      // エラーが発生しても、できる限り回答を生成して送信するよう試みる
      try {
        const fallbackResponse = '申し訳ありませんが、技術的な問題により回答を生成できませんでした。スタッフが直接対応いたします。';
        
        await sendResponseToOperators(
          'お客様からの新規問い合わせ (エラー発生)',
          inquiry,
          fallbackResponse,
          chatId
        );
        
        return NextResponse.json({ 
          success: true,
          message: 'エラーが発生しましたが、フォールバック処理を完了しました',
          timestamp: new Date().toISOString()
        });
      } catch (fallbackError) {
        // フォールバック処理も失敗した場合は元のエラーを返す
        return handleApiError(processingError, 'channelio-webhook-processing');
      }
    }
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