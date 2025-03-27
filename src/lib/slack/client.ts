import { WebClient } from '@slack/web-api';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Initialize Slack client with build-time check
const getSlackClient = () => {
  if (isBuildTime) {
    return new WebClient('dummy-token-for-build');
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error('Slackボットトークンが設定されていません');
  }

  return new WebClient(process.env.SLACK_BOT_TOKEN);
};

const slack = getSlackClient();

/**
 * Send a notification to a specific Slack channel
 */
export async function sendSlackNotification(
  message: string,
  channelId: string
): Promise<void> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would send Slack notification:', message);
    return;
  }
  
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text: message,
      unfurl_links: false,
      unfurl_media: false,
    });
  } catch (error) {
    console.error('Slack通知の送信に失敗:', error);
    throw error;
  }
}

/**
 * Send the inquiry and AI response draft to the operator channel
 */
export async function sendResponseToOperators(
  title: string,
  inquiry: string,
  responseDraft: string,
  chatId: string
): Promise<void> {
  if (isBuildTime) {
    console.log('[Build] Would send response to operators');
    return;
  }
  
  if (!process.env.SLACK_CHANNEL_ID) {
    throw new Error('Slackチャンネルが設定されていません');
  }

  // Format the webhook payload as plain text
  const webhookData = `受信内容:
メッセージ: ${inquiry}
ユーザー名: ${chatId ? 'テストユーザー' : '不明'}
チャットID: ${chatId || 'なし'}`;

  const message = `*${title}*

問い合わせ内容:
${webhookData}

AI生成の回答案:
${responseDraft}

お客様ID: test-customer-123 | 会話ID: ${chatId} | 送信元: web`;

  await sendSlackNotification(message, process.env.SLACK_CHANNEL_ID);
}

/**
 * Send an error notification to the error channel
 */
export async function sendErrorNotification(
  error: Error,
  context: string
): Promise<void> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would send error notification:', error.message);
    return;
  }
  
  if (!process.env.SLACK_ERROR_CHANNEL_ID) {
    console.error('エラーチャンネルIDが設定されていません。エラー通知を送信できません');
    return;
  }

  const message = `
*自動応答システムでエラーが発生*
*場所:* ${context}
*エラー:* ${error.message}
*スタックトレース:* ${error.stack ? `\`\`\`${error.stack}\`\`\`` : 'スタックトレースなし'}
*タイムスタンプ:* ${new Date().toISOString()}
`;

  try {
    await sendSlackNotification(message, process.env.SLACK_ERROR_CHANNEL_ID);
  } catch (secondaryError) {
    // If we can't send the error notification, log to console as a last resort
    console.error('エラー通知の送信に失敗:', secondaryError);
    console.error('元のエラー:', error);
  }
} 