#!/usr/bin/env node

/**
 * FAQテキストファイルをCSV形式に変換するスクリプト
 * 実行方法: node scripts/convertFaqToCsv.js <入力ファイル> <出力ファイル>
 */

const fs = require('fs');
const path = require('path');

// コマンドライン引数をチェック
if (process.argv.length < 4) {
  console.error('使用方法: node scripts/convertFaqToCsv.js <入力ファイル> <出力ファイル>');
  process.exit(1);
}

const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];

// 入力ファイルが存在するか確認
if (!fs.existsSync(inputFilePath)) {
  console.error(`エラー: 入力ファイル "${inputFilePath}" が見つかりません`);
  process.exit(1);
}

try {
  // ファイルを読み込む
  const content = fs.readFileSync(inputFilePath, 'utf8');
  
  // Q&Aペアを抽出
  const pairs = content.split(/\nQ: /).filter(Boolean);
  
  // CSVヘッダー
  const csvHeader = 'content,source,category,type\n';
  let csvContent = csvHeader;
  
  // 最初のペアの処理（Q:が削除されている可能性があるため特別扱い）
  if (pairs.length > 0) {
    const firstPair = pairs[0];
    const firstPairContent = firstPair.startsWith('Q: ') ? firstPair : `Q: ${firstPair}`;
    processPair(firstPairContent);
  }
  
  // 残りのペアを処理
  for (let i = 1; i < pairs.length; i++) {
    processPair(`Q: ${pairs[i]}`);
  }
  
  // ペアを処理してCSV行に変換する関数
  function processPair(text) {
    // Q: と A: を分離
    const match = text.match(/Q: (.*?)\nA: ([\s\S]*?)(?=\n\nQ: |$)/);
    
    if (match) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      // カテゴリを推定（質問文からキーワードを抽出）
      let category = 'general';
      if (question.includes('サイズ')) {
        category = 'sizing';
      } else if (question.includes('返品') || question.includes('交換')) {
        category = 'returns';
      } else if (question.includes('支払い') || question.includes('クレジット') || question.includes('決済')) {
        category = 'payment';
      } else if (question.includes('配送') || question.includes('届き')) {
        category = 'shipping';
      } else if (question.includes('注文')) {
        category = 'orders';
      }
      
      // CSVに適した形式で内容をエスケープ
      const escapedContent = `【質問】${question}\n【回答】${answer}`.replace(/"/g, '""');
      
      // CSV行を追加
      csvContent += `"${escapedContent}","faq","${category}","question_answer"\n`;
    }
  }
  
  // ファイルに書き込む
  fs.writeFileSync(outputFilePath, csvContent);
  console.log(`変換完了: ${outputFilePath} に ${pairs.length} 件のFAQを書き込みました`);
  
} catch (error) {
  console.error('エラーが発生しました:', error);
  process.exit(1);
} 