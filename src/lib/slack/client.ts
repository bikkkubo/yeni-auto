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
  if (isBuildTime) {
    console.log('[Build] Would send Slack notification:', message.substring(0, 100) + '...');
    return;
  }
  
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text: message,
      unfurl_links: false,
      unfurl_media: false,
      mrkdwn: true
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

  // ユーザーからの問い合わせを見やすく整形
  const formattedInquiry = inquiry.trim();
  
  // AIの回答を見やすく整形
  const formattedResponse = responseDraft.trim();
  
  // メタデータ部分
  const metadata = `お客様ID: test-customer-123 | 会話ID: ${chatId || 'なし'} | 送信元: web`;

  // 最終的なメッセージを構築
  const message = `*${title}*

*問い合わせ内容:*
\`\`\`
${formattedInquiry}
\`\`\`

*AI生成の回答案:*
\`\`\`
${formattedResponse}
\`\`\`

${metadata}

_この回答はAIによって自動生成されました。適切な修正を加えてからお客様へ返信してください。_`;

  await sendSlackNotification(message, process.env.SLACK_CHANNEL_ID);
}

/**
 * Send an error notification to the error channel
 */
export async function sendErrorNotification(
  error: Error,
  context: string
): Promise<void> {
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