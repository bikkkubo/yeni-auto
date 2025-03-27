import OpenAI from 'openai';
import { Document } from '../supabase/client';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Initialize the OpenAI client - moved initialization to a function to avoid build-time errors
const getOpenAIClient = () => {
  // Don't check API key during build time
  if (isBuildTime) {
    return new OpenAI({
      apiKey: 'dummy-key-for-build',
    });
  }
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OpenAI API key');
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const COMPLETION_MODEL = 'gpt-3.5-turbo';

/**
 * Generate embedding for a text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Return dummy embedding during build time
  if (isBuildTime) {
    return Array(1536).fill(0);
  }
  
  try {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.replace(/\n/g, ' '),
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate a response draft using RAG approach
 */
export async function generateResponseDraft(
  inquiry: string,
  documents: Document[]
): Promise<string> {
  // Return dummy response during build time
  if (isBuildTime) {
    return "This is a dummy response for build time";
  }
  
  try {
    const openai = getOpenAIClient();
    // Construct a prompt with the inquiry and relevant documents
    const documentContext = documents
      .map((doc) => `---\n${doc.content}\n---`)
      .join('\n\n');
    
    const systemPrompt = `You are a helpful customer support assistant. 
Use the following retrieved documents to answer the customer's inquiry. 
If the documents don't contain relevant information to answer the question, 
say that you don't have enough information and suggest what might help.`;

    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here are some relevant documents that might help with the inquiry:
${documentContext}

Customer inquiry: ${inquiry}

Please provide a helpful, professional, and accurate response based on the information from these documents.` },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || 'Sorry, I was unable to generate a response.';
  } catch (error) {
    console.error('Error generating response draft:', error);
    throw error;
  }
} 