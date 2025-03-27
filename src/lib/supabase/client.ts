import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

/**
 * Find similar documents using vector similarity search
 */
export async function findSimilarDocuments(
  embedding: number[],
  limit: number = 5
): Promise<Document[]> {
  try {
    const { data, error } = await supabaseClient.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7, // Adjust as needed
      match_count: limit
    });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error finding similar documents:', error);
    throw error;
  }
} 