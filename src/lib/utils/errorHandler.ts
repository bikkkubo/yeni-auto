// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === "production" && typeof process.env.VERCEL_URL === "undefined";

/**
 * Error handler function with proper context logging
 */
export async function handleError(error: Error | unknown, context: string): Promise<Error> { 
  // Skip detailed handling during build time
  if (isBuildTime) {
    console.log("[Build] Would handle error:", context);
    return error instanceof Error ? error : new Error(String(error));
  }
  
  // Use the context parameter in logging to prevent the "unused parameter" error
  console.error(`[${context}] Error:`, error);
  return error instanceof Error ? error : new Error(String(error)); 
}

import * as crypto from 'crypto';

/**
 * Verify webhook signature using HMAC
 * 
 * @param signature The signature provided in the request header
 * @param body The raw request body as a string
 * @returns boolean indicating if the signature is valid
 */
export function verifyWebhookSignature(signature: string, body: string): boolean { 
  // Skip verification during build time
  if (isBuildTime) {
    return true;
  }
  
  if (!process.env.CHANNELIO_WEBHOOK_SECRET) {
    console.warn('CHANNELIO_WEBHOOK_SECRET is not set - webhook validation is disabled');
    return true;
  }
  
  try {
    // Recreate the signature using the shared secret
    const hmac = crypto.createHmac('sha256', process.env.CHANNELIO_WEBHOOK_SECRET);
    const digest = hmac.update(body).digest('hex');
    
    // Compare the signatures using a timing-safe function to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    // Fail closed - if we can't verify the signature, reject the request
    return false;
  }
}