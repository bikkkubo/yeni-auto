import OpenAI from 'openai';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// Initialize OpenAI client
const getOpenAIClient = () => {
  if (isBuildTime) {
    return new OpenAI({ apiKey: 'dummy-api-key-for-build' });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAIのAPIキーが設定されていません');
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const openai = getOpenAIClient();

/**
 * Generate embedding for a text using OpenAI's embedding API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would generate embedding for:', text.substring(0, 50));
    return Array(1536).fill(0); // Return dummy embedding
  }

  try {
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('埋め込みベクトルの生成に失敗:', error);
    throw error;
  }
}

/**
 * Type for document with content and metadata
 */
export interface Document {
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Find similar documents based on embedding vector
 * In a real implementation, this would search a vector database
 */
export async function findSimilarDocuments(embedding: number[]): Promise<Document[]> {
  // Skip during build time or if no Supabase connection
  if (isBuildTime) {
    console.log('[Build] Would find similar documents for embedding');
    // Return dummy documents for testing
    return [
      { content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。' },
      { content: '一般的なサイズ表: A70, B70, C70, D70, A75, B75, C75, D75, A80, B80, C80, D80, A85, B85, C85, D85' },
      { content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。' }
    ];
  }

  // In a production app, this would use Supabase with pgvector to perform a similarity search
  console.log('類似ドキュメントを検索中...');
  
  // Dummy implementation for now
  return [
    { content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。' },
    { content: '一般的なサイズ表: A70, B70, C70, D70, A75, B75, C75, D75, A80, B80, C80, D80, A85, B85, C85, D85' },
    { content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。' }
  ];
}

/**
 * Generate response draft using RAG with OpenAI
 */
export async function generateResponseDraft(inquiry: string, documents: Document[]): Promise<string> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would generate response for:', inquiry.substring(0, 50));
    return 'これはビルド時の仮の回答です。実際のデプロイ時には、OpenAI APIを使って生成された回答が表示されます。';
  }

  try {
    // Combine the documents content
    const context = documents.map(doc => doc.content).join('\n\n');

    const systemPrompt = `
あなたは親切で丁寧な顧客サポートアシスタントです。
以下の参考情報を使用して、問い合わせに対する回答を日本語で生成してください。
回答は丁寧で、敬語を使い、簡潔に情報を提供してください。
情報がない場合は、正直に「その情報は持ち合わせていません」と伝えてください。

参考情報:
${context}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inquiry }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || '申し訳ありませんが、回答を生成できませんでした。';
  } catch (error) {
    console.error('回答の生成に失敗:', error);
    return '申し訳ありませんが、技術的な問題により回答を生成できませんでした。スタッフが直接対応いたします。';
  }
} 