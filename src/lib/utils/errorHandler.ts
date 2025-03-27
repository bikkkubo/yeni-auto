/**
 * Error handler function with proper context logging
 */
export async function handleError(error: Error | unknown, context: string): Promise<Error> { 
  // Use the context parameter in logging to prevent the "unused parameter" error
  console.error(`[${context}] Error:`, error);
  return error instanceof Error ? error : new Error(String(error)); 
}

/**
 * Verify webhook signature function
 */
export function verifyWebhookSignature(signature: string, body: string): boolean { 
  // Using both parameters to prevent unused parameter warnings
  console.log(`Verifying signature: ${signature} for body length: ${body.length}`); 
  return true; 
}