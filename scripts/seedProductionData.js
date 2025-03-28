#!/usr/bin/env node

/**
 * 本番用のナレッジベースデータをSupabaseに挿入するスクリプト
 * 実行方法: node scripts/seedProductionData.js
 * 
 * 必要な環境変数:
 * - OPENAI_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

// 本番用ナレッジベースデータ
// 実際の過去のお問い合わせと回答データ
const productionDocuments = [
  // 製品情報
  {
    content: 'ノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズによって決まります。お手持ちのブラのサイズを参考に、以下の一般的なサイズ表をご参照ください。',
    metadata: { source: 'product_info', category: 'sizing', type: 'general' }
  },
  {
    content: '一般的なノンワイヤーブラのサイズ表: A70, B70, C70, D70, A75, B75, C75, D75, A80, B80, C80, D80, A85, B85, C85, D85',
    metadata: { source: 'size_chart', category: 'sizing', type: 'chart' }
  },
  {
    content: 'サイズ選びで迷われた場合は、お気軽にチャットサポートでご相談ください。お手伝いさせていただきますね。',
    metadata: { source: 'customer_service', category: 'support', type: 'help' }
  },
  
  // 過去のQ&A - サイズ関連
  {
    content: '【質問】普段Cカップを着用していますが、ノンワイヤーブラだとどのサイズを選べばよいですか？\n【回答】ノンワイヤーブラは通常のブラよりフィット感が異なります。普段Cカップをご使用の場合、同じカップサイズか、場合によっては1サイズ上のDカップをお試しいただくことをおすすめします。アンダーバストサイズ（数字の部分）は同じものをお選びください。',
    metadata: { source: 'past_qa', category: 'sizing', type: 'question_answer', date: '2025-02-15' }
  },
  {
    content: '【質問】大きいサイズのノンワイヤーブラはありますか？\n【回答】はい、当店では大きめサイズのノンワイヤーブラも取り揃えております。D85、E80、E85、F80までのサイズをご用意しています。大きいサイズでもしっかりとしたホールド感があり、快適にお使いいただけます。',
    metadata: { source: 'past_qa', category: 'sizing', type: 'question_answer', date: '2025-01-20' }
  },
  
  // 過去のQ&A - 素材関連
  {
    content: '【質問】ノンワイヤーブラの素材は何ですか？肌に優しいものですか？\n【回答】当店のノンワイヤーブラは主にコットン、ナイロン、ポリウレタンを使用しています。肌に優しい素材を厳選しており、敏感肌の方にも安心してお使いいただけます。特にコットン素材のものは通気性も良く、肌触りも柔らかいのでおすすめです。',
    metadata: { source: 'past_qa', category: 'material', type: 'question_answer', date: '2025-02-05' }
  },
  
  // 過去のQ&A - 洗濯方法
  {
    content: '【質問】ノンワイヤーブラの洗濯方法を教えてください。\n【回答】ノンワイヤーブラは洗濯ネットに入れて、洗濯機で弱水流または手洗いモードで洗うことをおすすめします。洗剤は中性洗剤を使用し、漂白剤は避けてください。乾燥機の使用は形が崩れる原因になるため、陰干しで自然乾燥させてください。',
    metadata: { source: 'past_qa', category: 'care', type: 'question_answer', date: '2025-03-10' }
  },
  
  // 過去のQ&A - 返品・交換
  {
    content: '【質問】サイズが合わない場合、返品や交換はできますか？\n【回答】はい、商品到着後7日以内であれば、未使用・タグ付きの状態で返品・交換が可能です。サイズ交換は送料無料で承ります。お客様都合による返品の場合は、返送料はお客様負担となりますのでご了承ください。返品・交換をご希望の場合は、お問い合わせフォームまたはお電話にてご連絡ください。',
    metadata: { source: 'past_qa', category: 'returns', type: 'question_answer', date: '2025-02-25' }
  },
  
  // 会社情報
  {
    content: '当店は2015年創業の女性下着専門店です。特にノンワイヤーブラやシームレスブラなど、快適さを重視した商品を多数取り扱っています。また、サイズ展開も豊富で、A65からF90まで幅広くご用意しております。',
    metadata: { source: 'company_info', category: 'about', type: 'general' }
  },
  
  // 特別コレクション情報
  {
    content: '2025年春の新作コレクションでは、パステルカラーのノンワイヤーブラが新登場しました。ラベンダー、ミント、ライトピンクの3色展開で、どれも春らしい爽やかな色合いです。素材には肌触りの良いコットン混紡素材を使用しています。',
    metadata: { source: 'product_info', category: 'collection', type: 'seasonal', date: '2025-03-01' }
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
 * CSVファイルからドキュメントを読み込む（オプション）
 */
function loadDocumentsFromCsv(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`CSVファイル ${filePath} が見つかりません。デフォルトのドキュメントを使用します。`);
      return null;
    }
    
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    const documents = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const document = {
        content: values[0],
        metadata: {
          source: values[1] || 'import',
          category: values[2] || 'general',
          type: values[3] || 'unknown'
        }
      };
      documents.push(document);
    }
    
    console.log(`CSVから${documents.length}件のドキュメントを読み込みました`);
    return documents;
  } catch (error) {
    console.error('CSVファイルの読み込みに失敗:', error.message);
    return null;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    // コマンドライン引数から入力ファイルを取得（オプション）
    const csvFilePath = process.argv[2];
    let documentsToInsert = productionDocuments;
    
    // CSVファイルが指定されていれば読み込む
    if (csvFilePath) {
      const csvDocuments = loadDocumentsFromCsv(csvFilePath);
      if (csvDocuments) {
        documentsToInsert = csvDocuments;
      }
    }
    
    // ユーザー確認
    console.log(`${documentsToInsert.length}件のドキュメントを挿入します。`);
    console.log('注意: 既存のドキュメントはすべて削除されます。');
    console.log('30秒以内にCtrl+Cを押すと処理を中止できます...');
    
    // 5秒おきにカウントダウン
    for (let i = 30; i > 0; i -= 5) {
      console.log(`${i}秒後に処理を開始します...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 既存のドキュメントをクリア
    await clearDocuments();
    
    console.log(`${documentsToInsert.length}件のドキュメントを挿入します...`);
    
    // 各ドキュメントを処理
    for (const doc of documentsToInsert) {
      // 埋め込み生成
      const embedding = await generateEmbedding(doc.content);
      console.log(`埋め込みを生成しました (${embedding.length}次元)`);
      
      // ドキュメント挿入
      const result = await insertDocument(doc.content, doc.metadata, embedding);
      console.log(`ドキュメントを挿入しました (ID: ${result[0].id})`);
      
      // OpenAI APIの制限を考慮して少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('処理が完了しました');
  } catch (error) {
    console.error('処理中にエラーが発生:', error);
    process.exit(1);
  }
}

// スクリプト実行
main(); 