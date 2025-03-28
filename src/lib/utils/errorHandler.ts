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

/**
 * Verify webhook signature function
 * This is a placeholder for future implementation
 */
export function verifyWebhookSignature(signature: string, body: string): boolean { 
  // Skip verification during build time
  if (isBuildTime) {
    return true;
  }
  
  // This is a placeholder - should be implemented with proper signature verification
  // in a production environment using HMAC or similar
  console.log(`Verifying signature: ${signature} for body length: ${body.length}`); 
  return true; 
}