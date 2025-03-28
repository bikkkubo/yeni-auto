#!/usr/bin/env node

/**
 * テスト用のドキュメントデータをSupabaseに挿入するスクリプト
 * 実行方法: node scripts/seedDocuments.js
 * 
 * 必要な環境変数:
 * - OPENAI_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 環境変数の確認
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`エラー: 環境変数 ${varName} が設定されていません`);
    process.exit(1);
  }
}

// クライアントの初期化
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 挿入するドキュメントデータ
const documents = [
  {
    content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。お手持ちのブラのサイズを参考に、以下の一般的なサイズ表をご参照ください。',
    metadata: { source: 'product_info', category: 'sizing' }
  },
  {
    content: '一般的なノンワイヤーブラのサイズ表: A70, B70, C70, D70, A75, B75, C75, D75, A80, B80, C80, D80, A85, B85, C85, D85',
    metadata: { source: 'size_chart', category: 'sizing' }
  },
  {
    content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。お手伝いさせていただきますね。',
    metadata: { source: 'customer_service', category: 'support' }
  }
];

/**
 * テキストの埋め込みベクトルを生成する
 */
async function generateEmbedding(text) {
  try {
    console.log(`テキストの埋め込みを生成中: "${text.substring(0, 30)}..."`);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('埋め込み生成中にエラーが発生:', error.message);
    throw error;
  }
}

/**
 * ドキュメントをデータベースに挿入する
 */
async function insertDocument(content, metadata, embedding) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        content,
        metadata,
        embedding
      })
      .select();
    
    if (error) {
      throw new Error(`ドキュメント挿入エラー: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('ドキュメント挿入中にエラーが発生:', error.message);
    throw error;
  }
}

/**
 * 既存のドキュメントを削除する
 */
async function clearDocuments() {
  try {
    console.log('既存のドキュメントを削除中...');
    const { error } = await supabase
      .from('documents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除
    
    if (error) {
      throw new Error(`ドキュメント削除エラー: ${error.message}`);
    }
    
    console.log('既存のドキュメントを削除しました');
  } catch (error) {
    console.error('ドキュメント削除中にエラーが発生:', error.message);
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    // 既存のドキュメントをクリア
    await clearDocuments();
    
    console.log(`${documents.length}件のドキュメントを挿入します...`);
    
    // 各ドキュメントを処理
    for (const doc of documents) {
      // 埋め込み生成
      const embedding = await generateEmbedding(doc.content);
      console.log(`埋め込みを生成しました (${embedding.length}次元)`);
      
      // ドキュメント挿入
      const result = await insertDocument(doc.content, doc.metadata, embedding);
      console.log(`ドキュメントを挿入しました (ID: ${result[0].id})`);
    }
    
    console.log('処理が完了しました');
  } catch (error) {
    console.error('処理中にエラーが発生:', error);
    process.exit(1);
  }
}

// スクリプト実行
main(); 