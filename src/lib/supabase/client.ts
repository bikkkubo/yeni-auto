import { createClient } from '@supabase/supabase-js';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Initialize Supabase client with build-time check
const getSupabaseClient = () => {
  if (isBuildTime) {
    return createClient(
      'https://dummy-url-for-build.supabase.co',
      'dummy-key-for-build',
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  );
};

export const supabaseClient = getSupabaseClient();

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Find similar documents using vector similarity search
 */
export async function findSimilarDocuments(
  embedding: number[],
  limit: number = 5
): Promise<Document[]> {
  // Return dummy data during build time
  if (isBuildTime) {
    return [
      {
        id: 'dummy-id',
        content: 'Dummy content for build time',
        metadata: {},
      }
    ];
  }
  
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