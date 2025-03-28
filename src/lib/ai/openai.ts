import OpenAI from 'openai';
import { supabaseClient, Document as SupabaseDocument } from '@/lib/supabase/client';

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
      model: 'text-embedding-ada-002', // 古い汎用モデルを使用
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('埋め込みベクトルの生成に失敗:', error);
    throw error;
  }
}

/**
 * Document type for our application
 */
export interface Document {
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Find similar documents based on keywords instead of vector search
 * This is a workaround for embedding model access issues
 */
export async function findSimilarDocuments(_embedding: number[]): Promise<Document[]> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would find similar documents without embeddings');
    return dummyDocuments;
  }

  try {
    console.log('エンベディングなしで類似ドキュメントを検索します...');
    
    // 本来はSupabaseのベクター検索を使用しますが、
    // 一時的に固定のドキュメントを返す実装にしています
    return dummyDocuments;
  } catch (error) {
    console.error('類似ドキュメントの検索に失敗:', error);
    // エラーが発生した場合でも、システムが完全に停止しないようにするため、空の配列を返す
    return [];
  }
}

// 一時的に使用するダミードキュメント
const dummyDocuments: Document[] = [
  { 
    content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。お手持ちのブラのサイズを参考に、以下の一般的なサイズ表をご参照ください。'
  },
  { 
    content: '一般的なノンワイヤーブラのサイズ表:\nA70, B70, C70, D70\nA75, B75, C75, D75\nA80, B80, C80, D80\nA85, B85, C85, D85'
  },
  { 
    content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。お手伝いさせていただきますね。'
  }
];

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

    console.log('=== RAG DEBUG INFO ===');
    console.log('問い合わせ:', inquiry);
    console.log('ドキュメント数:', documents.length);
    console.log('コンテキスト内容:', context);

    const systemPrompt = `
あなたは親切で丁寧な顧客サポートアシスタントです。
以下の参考情報だけを使用して、問い合わせに対する回答を日本語で生成してください。
参考情報に含まれていない事実や独自の情報は絶対に追加しないでください。
回答は丁寧で、敬語を使い、簡潔に情報を提供してください。
情報がない場合は、正直に「その情報は持ち合わせていません」と伝えてください。
架空の情報や独自の推測は絶対に含めないでください。

参考情報:
${context}
`;

    console.log('システムプロンプト:', systemPrompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inquiry }
      ],
      temperature: 0.3, // より確実な応答のために温度を下げる
      max_tokens: 500
    });

    const responseContent = response.choices[0].message.content || '申し訳ありませんが、回答を生成できませんでした。';
    console.log('AIの回答:', responseContent);
    console.log('=== RAG DEBUG INFO END ===');

    return responseContent;
  } catch (error) {
    console.error('回答の生成に失敗:', error);
    return '申し訳ありませんが、技術的な問題により回答を生成できませんでした。スタッフが直接対応いたします。';
  }
} 