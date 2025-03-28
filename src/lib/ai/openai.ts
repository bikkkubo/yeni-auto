import OpenAI from 'openai';
import { supabaseClient, Document as SupabaseDocument } from '@/lib/supabase/client';

// Check if we are in build mode
const isBuildTime = process.env.NODE_ENV === 'production' && typeof process.env.VERCEL_URL === 'undefined';

// 最新のOpenAIモデルを指定
const EMBEDDING_MODEL = 'text-embedding-3-small';
const GENERATION_MODEL = 'gpt-4-turbo';

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
      model: EMBEDDING_MODEL,
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
  id?: string;
  content: string;
  metadata?: {
    source?: string;
    category?: string;
    [key: string]: unknown;
  };
}

// 一時的に使用するダミードキュメント
const dummyDocuments: Document[] = [
  { 
    id: '1',
    content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。お手持ちのブラのサイズを参考に、以下の一般的なサイズ表をご参照ください。',
    metadata: { source: 'product_info', category: 'sizing' }
  },
  { 
    id: '2',
    content: '一般的なノンワイヤーブラのサイズ表: A70, B70, C70, D70, A75, B75, C75, D75, A80, B80, C80, D80, A85, B85, C85, D85',
    metadata: { source: 'size_chart', category: 'sizing' }
  },
  { 
    id: '3',
    content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。お手伝いさせていただきますね。',
    metadata: { source: 'customer_service', category: 'support' }
  }
];

/**
 * Find similar documents based on keywords or vector search
 */
export async function findSimilarDocuments(embedding: number[]): Promise<Document[]> {
  // Skip during build time
  if (isBuildTime) {
    console.log('[Build] Would find similar documents without embeddings');
    return dummyDocuments;
  }

  try {
    console.log('Supabaseでドキュメント検索を実行中...');
    
    // テーブルにデータが存在するか確認
    const { count, error: countError } = await supabaseClient
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('ドキュメント数の取得に失敗:', countError);
      return dummyDocuments;
    }
    
    // テーブルが空の場合はダミーデータを返す
    if (count === 0) {
      console.log('ドキュメントテーブルが空です。ダミーデータを使用します。');
      return dummyDocuments;
    }

    // ベクトル検索を試みる
    try {
      // RPC関数を使用する場合
      /*
      const { data, error } = await supabaseClient.rpc(
        'match_documents',
        {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 5
        }
      );
      */
      
      // 直接クエリを使用する場合
      const { data, error } = await supabaseClient
        .from('documents')
        .select('id, content, metadata')
        .limit(5);
        // ベクトル検索が設定されたら以下のコメントを外す
        // .order('embedding <-> $1', { ascending: true })
        // .bind('$1', embedding);
      
      if (error) {
        console.error('ベクトル検索でエラーが発生:', error);
        return dummyDocuments;
      }

      if (!data || data.length === 0) {
        console.log('関連するドキュメントが見つかりませんでした');
        return dummyDocuments;
      }

      return data.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata
      }));
    } catch (vectorSearchError) {
      console.error('ベクトル検索に失敗:', vectorSearchError);
      
      // ベクトル検索に失敗した場合、単純なテキスト検索を試みる
      console.log('通常のドキュメント検索にフォールバック...');
      const { data, error } = await supabaseClient
        .from('documents')
        .select('id, content, metadata')
        .limit(5);
      
      if (error || !data || data.length === 0) {
        console.log('フォールバック検索も失敗。ダミーデータを使用します。');
        return dummyDocuments;
      }
      
      return data.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata
      }));
    }
  } catch (error) {
    console.error('ドキュメント検索に失敗:', error);
    return dummyDocuments;
  }
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
    // ログに詳細情報を出力
    console.log('=== RAG DEBUG INFO ===');
    console.log('問い合わせ:', inquiry);
    console.log('ドキュメント数:', documents.length);
    console.log('ドキュメントID:', documents.map(doc => doc.id).join(', '));
    
    // 使用するコンテキストを準備（ソース情報も含める）
    const context = documents.map(doc => {
      const source = doc.metadata?.source ? `[出典: ${doc.metadata.source}]` : '';
      return `${doc.content} ${source}`;
    }).join('\n\n');
    
    console.log('コンテキスト内容:', context);

    // 強化されたシステムプロンプト
    const systemPrompt = `
あなたは親切で丁寧な顧客サポートアシスタントです。

## 指示
- 以下の参考情報だけを使用して、問い合わせに対する回答を日本語で生成してください。
- 参考情報に含まれていない事実や独自の情報は絶対に追加しないでください。
- 回答は丁寧で、敬語を使い、簡潔に情報を提供してください。
- 情報がない場合は、「その情報は持ち合わせていません」と伝えてください。
- 架空の情報や独自の推測は絶対に含めないでください。

## 参考情報:
${context}

## ドキュメントID:
${documents.map(doc => doc.id).join(', ')}
`;

    console.log('システムプロンプト:', systemPrompt);

    // GPT-4 Turboを使用
    const response = await openai.chat.completions.create({
      model: GENERATION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inquiry }
      ],
      temperature: 0.3,
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