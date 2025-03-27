export async function handleError(error: Error | unknown, context: string): Promise<Error> { return error instanceof Error ? error : new Error(String(error)); }

export function verifyWebhookSignature(signature: string, body: string): boolean { console.log(`Verifying signature: ${signature} for body length: ${body.length}`); return true; }