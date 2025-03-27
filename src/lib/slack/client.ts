import { WebClient } from '@slack/web-api';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Initialize Slack client with build-time check
const getSlackClient = () => {
  if (isBuildTime) {
    return new WebClient('dummy-token-for-build');
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error('Missing Slack bot token');
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
    console.error('Error sending Slack notification:', error);
    throw error;
  }
}

/**
 * Send the inquiry and AI response draft to the operator channel
 */
export async function sendResponseToOperators(
  customerName: string,
  inquiry: string,
  responseDraft: string,
  chatLink?: string
): Promise<void> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would send response to operators');
    return;
  }
  
  if (!process.env.SLACK_CHANNEL_ID) {
    throw new Error('Missing Slack channel ID');
  }

  const message = `
*New Customer Inquiry from ${customerName}*
${chatLink ? `<${chatLink}|View in Channelio>` : ''}

*Inquiry:*
${inquiry}

*AI-Generated Response Draft:*
${responseDraft}

_Please review and respond to the customer through Channelio._
`;

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
    console.error('Missing error channel ID, cannot send error notification');
    return;
  }

  const message = `
*Error in Auto-Answer System*
*Location:* ${context}
*Error:* ${error.message}
*Stack:* ${error.stack ? `\`\`\`${error.stack}\`\`\`` : 'No stack trace available'}
*Timestamp:* ${new Date().toISOString()}
`;

  try {
    await sendSlackNotification(message, process.env.SLACK_ERROR_CHANNEL_ID);
  } catch (secondaryError) {
    // If we can't send the error notification, log to console as a last resort
    console.error('Failed to send error notification:', secondaryError);
    console.error('Original error:', error);
  }
} 