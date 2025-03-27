const fs = require('fs');
const path = require('path');

const errorHandlerContent = `import { sendErrorNotification } from '../slack/client';

/**
 * Error handler with Slack notification
 */
export async function handleError(
  error: Error | unknown,
  context: string
): Promise<Error> {
  const errorObject = error instanceof Error ? error : new Error(String(error));
  
  console.error(\`[\${context}] Error:\`, errorObject);
  
  // Send error notification to Slack
  try {
    await sendErrorNotification(errorObject, context);
  } catch (notificationError) {
    console.error('Failed to send error notification:', notificationError);
  }
  
  return errorObject;
}

/**
 * Verify webhook signature (placeholder - implement actual verification logic)
 */
export function verifyWebhookSignature(
  signature: string,
  body: string
): boolean {
  if (!process.env.CHANNELIO_WEBHOOK_SECRET) {
    console.warn('No webhook secret configured, skipping verification');
    return true;
  }
  
  // This is a placeholder. In a real implementation, you would:
  // 1. Check timestamp to prevent replay attacks
  // 2. Create a signature using your secret and the request body
  // 3. Compare it with the provided signature using a constant-time comparison
  
  // For now, returning true to allow development
  // TODO: Implement proper signature verification
  return true;
}`;

const filePath = path.join(__dirname, 'src', 'lib', 'utils', 'errorHandler.ts');
fs.writeFileSync(filePath, errorHandlerContent);

console.log('Created error handler file at', filePath);
