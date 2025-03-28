#!/usr/bin/env node

/**
 * サイズ相談Q&AテキストファイルをCSV形式に変換するスクリプト
 * 実行方法: node scripts/convertSizeConsultingToCsv.js <入力ファイル> <出力ファイル>
 */

const fs = require('fs');
const path = require('path');

// コマンドライン引数をチェック
if (process.argv.length < 4) {
  console.error('使用方法: node scripts/convertSizeConsultingToCsv.js <入力ファイル> <出力ファイル>');
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
      let answer = match[2].trim();
      
      // 回答が質問と同じ場合は、専門的な回答を追加
      if (answer === question) {
        answer = generateSizeConsultingAnswer(question);
      }
      
      // カテゴリを設定（サイズ相談用）
      const category = 'sizing';
      
      // CSVに適した形式で内容をエスケープ
      const escapedContent = `【質問】${question}\n【回答】${answer}`.replace(/"/g, '""');
      
      // CSV行を追加
      csvContent += `"${escapedContent}","customer_qa","${category}","size_consulting"\n`;
    }
  }
  
  // サイズ相談の質問から適切な回答を生成する関数
  function generateSizeConsultingAnswer(question) {
    // 質問文を分析
    const hasSize = question.match(/([A-H])(\d{2,3})/i); // A70, B75などのサイズ表記を検出
    const hasCup = question.match(/([A-H])カップ/i); // Aカップ、Bカップなどの表記を検出
    const hasSmallLarge = question.match(/(小さ|大き|きつ|ゆる|窮屈|フィット)/); // サイズ感に関する言葉を検出
    
    // 基本的な回答テンプレート
    let answer = "お問い合わせありがとうございます。サイズ選びは大切な要素ですので、詳しくご案内いたします。";
    
    // サイズに関する記述がある場合
    if (hasSize || hasCup) {
      answer += "\n\nノンワイヤーブラのサイズは、アンダーバスト（胸の下の周囲）とカップサイズ（胸の大きさ）によって決まります。お手持ちのブラのサイズを参考に、最適なサイズをお選びいただけます。";
    }
    
    // サイズ感に関する記述がある場合
    if (hasSmallLarge) {
      answer += "\n\n締め付け感が少なくなるよう、アンダーサイズは同じままでカップサイズを1つ大きめのものをお選びいただくか、ストラップの調整で快適な着け心地に調整いただけます。";
    }
    
    // 締めの言葉
    answer += "\n\nより詳細なサイズアドバイスをご希望の場合は、トップバストとアンダーバストの実測値をお知らせいただけますと、より適したサイズをご案内できます。お気軽にご相談ください。";
    
    return answer;
  }
  
  // ファイルに書き込む
  fs.writeFileSync(outputFilePath, csvContent);
  console.log(`変換完了: ${outputFilePath} に ${pairs.length} 件のサイズ相談FAQを書き込みました`);
  
} catch (error) {
  console.error('エラーが発生しました:', error);
  process.exit(1);
} 