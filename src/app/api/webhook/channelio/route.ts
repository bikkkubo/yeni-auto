import { NextRequest, NextResponse } from "next/server";
import {
  sendResponseToOperators,
  sendErrorNotification,
} from "@/lib/slack/client";
import {
  generateEmbedding,
  findSimilarDocuments,
  generateChannelioResponse,
} from "@/lib/ai/openai";
import { verifyWebhookSignature } from "@/lib/utils/errorHandler";

// Check if we are in build mode
const isBuildTime =
  process.env.NODE_ENV === "production" &&
  typeof process.env.VERCEL_URL === "undefined";

// Error handling function without the circular dependency
async function handleApiError(error: Error | unknown, context: string) {
  console.error(`[${context}] Error:`, error);

  // 本番環境ではSlackにエラー通知を送信
  try {
    if (process.env.NODE_ENV === "production" && !isBuildTime) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      await sendErrorNotification(errorObj, context);
    }
  } catch (notificationError) {
    console.error("エラー通知の送信に失敗:", notificationError);
  }

  const errorMessage =
    error instanceof Error ? error.message : "不明なエラーが発生しました";

  return new NextResponse(
    JSON.stringify({ error: "内部サーバーエラー", details: errorMessage }),
    { status: 500 }
  );
}

// Function to check if all required environment variables are set
function checkRequiredEnvVars() {
  // Skip checks during build time
  if (isBuildTime) return;

  const requiredVars = [
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SLACK_BOT_TOKEN",
    "SLACK_CHANNEL_ID",
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  console.log(
    `[${new Date().toISOString()}] [${requestId}] Received POST request for: ${
      request.url
    }`
  );

  if (isBuildTime) {
    return NextResponse.json({ status: "ok", buildTime: true });
  }

  try {
    checkRequiredEnvVars();

    // Get the raw request body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature if provided
    const signature = request.headers.get("x-channelio-signature") || "";
    if (signature) {
      const isValid = verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        console.error(`[${requestId}] 不正なwebhook署名`);
        return new NextResponse(JSON.stringify({ error: "不正な署名" }), {
          status: 401,
        });
      }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(`[${requestId}] JSONの解析に失敗:`, parseError);
      return new NextResponse(
        JSON.stringify({ error: "不正なJSONペイロード" }),
        { status: 400 }
      );
    }

    // Extract inquiry details from the webhook payload
    const inquiry = body.message?.text || "";
    const userName = body.user?.name || "不明な顧客";
    const userEmail = body.user?.email || "";
    const chatId = body.chat?.id || "";
    const channelType = body.source?.type || "Channelio";

    if (!inquiry) {
      console.error(`[${requestId}] 問い合わせ内容が空です`);
      return new NextResponse(
        JSON.stringify({ error: "問い合わせ内容が見つかりません" }),
        { status: 400 }
      );
    }

    console.log(
      `[${requestId}] 問い合わせ: "${inquiry.substring(0, 100)}${
        inquiry.length > 100 ? "..." : ""
      }"`
    );
    console.log(
      `[${requestId}] ユーザー: "${userName}", チャットID: "${chatId}"`
    );

    try {
      // 埋め込みを生成
      console.log(`[${requestId}] 埋め込みベクトルを生成中...`);
      const startEmbedding = Date.now();
      const embedding = await generateEmbedding(inquiry);
      console.log(
        `[${requestId}] 埋め込みベクトル生成完了 (次元数: ${
          embedding.length
        }, 所要時間: ${Date.now() - startEmbedding}ms)`
      );

      // 類似ドキュメントを検索
      console.log(`[${requestId}] 類似ドキュメントを検索中...`);
      const startSearch = Date.now();
      const similarDocuments = await findSimilarDocuments(embedding);
      console.log(
        `[${requestId}] 類似ドキュメント検索完了 (件数: ${
          similarDocuments.length
        }, 所要時間: ${Date.now() - startSearch}ms)`
      );

      if (similarDocuments.length === 0) {
        console.warn(
          `[${requestId}] 類似ドキュメントが見つかりませんでした。ダミーデータを使用します。`
        );
      }

      // 回答案を生成
      console.log(`[${requestId}] AI回答案を生成中...`);
      const startGeneration = Date.now();

      // カスタマー情報を準備
      const customerInfo = {
        name: userName,
        email: userEmail,
        orderHistory: "", // 注文履歴がある場合はここに入れる
        channelType: channelType,
        inquiryCategory: body.inquiry_category || "一般的な問い合わせ",
      };

      // 新しい関数を使用して回答を生成
      const responseDraft = await generateChannelioResponse(
        inquiry,
        similarDocuments,
        customerInfo
      );
      console.log(
        `[${requestId}] AI回答案生成完了 (所要時間: ${
          Date.now() - startGeneration
        }ms)`
      );

      // Slackに通知
      console.log(`[${requestId}] Slackに通知送信中...`);
      const startSlack = Date.now();
      console.log("[DEBUG] Preparing to send Slack message:", responseDraft);
      try {
        await sendResponseToOperators(
          "お客様からの新規問い合わせ",
          inquiry,
          responseDraft,
          chatId
        );
        console.log("[DEBUG] Slack message sent successfully.");
      } catch (error) {
        console.error("[ERROR] Failed to send Slack message:", error);
        await sendErrorNotification(error, "Slack Notification");
      }
      console.log(
        `[${requestId}] Slack通知送信完了 (所要時間: ${
          Date.now() - startSlack
        }ms)`
      );

      // 全処理時間を記録
      const totalProcessingTime = Date.now() - startEmbedding;
      console.log(
        `[${requestId}] 全処理完了 (合計所要時間: ${totalProcessingTime}ms)`
      );

      return NextResponse.json({
        success: true,
        request_id: requestId,
        message: "Webhookの処理が完了しました",
        timestamp: new Date().toISOString(),
      });
    } catch (processingError) {
      console.error(`[${requestId}] 処理中にエラーが発生:`, processingError);

      // エラーが発生しても、できる限り回答を生成して送信するよう試みる
      try {
        console.log(`[${requestId}] フォールバック処理を実行中...`);
        const fallbackResponse =
          "申し訳ありませんが、技術的な問題により回答を生成できませんでした。スタッフが直接対応いたします。";

        console.log(
          "[DEBUG] Preparing to send Slack message:",
          fallbackResponse
        );
        try {
          await sendResponseToOperators(
            "お客様からの新規問い合わせ (エラー発生)",
            inquiry,
            fallbackResponse,
            chatId
          );
          console.log("[DEBUG] Slack message sent successfully.");
        } catch (error) {
          console.error("[ERROR] Failed to send Slack message:", error);
          await sendErrorNotification(error, "Slack Notification");
        }
        console.log(`[${requestId}] フォールバック処理完了`);

        return NextResponse.json({
          success: true,
          request_id: requestId,
          warning: true,
          message: "エラーが発生しましたが、フォールバック処理を完了しました",
          timestamp: new Date().toISOString(),
        });
      } catch (fallbackError) {
        // フォールバック処理も失敗した場合は元のエラーを返す
        console.error(
          `[${requestId}] フォールバック処理も失敗:`,
          fallbackError
        );
        return handleApiError(
          processingError,
          `channelio-webhook-processing-${requestId}`
        );
      }
    }
  } catch (error) {
    console.error(`[${requestId}] Webhookの処理中にエラーが発生:`, error);
    return handleApiError(error, `channelio-webhook-${requestId}`);
  }
}

// Optionally implement GET for testing the endpoint
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  console.log(
    `[${new Date().toISOString()}] [${requestId}] Received GET request: ${
      request.url
    }`
  );

  // Check if this is a Channelio request with token in URL
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token) {
    console.log(`[${requestId}] Found token in URL: ${token}`);
  }

  // Return dummy response during build time
  if (isBuildTime) {
    return NextResponse.json({ status: "ok", buildTime: true });
  }

  // Try to send a test notification to Slack
  try {
    const slackMessage = `webhookエンドポイントにGETリクエストを受信:\n\nURL: ${
      request.url
    }\n\nトークン: ${token || "なし"}`;
    console.log("[DEBUG] Preparing to send Slack message:", slackMessage);
    try {
      await sendResponseToOperators(
        "GETリクエストのテスト",
        slackMessage,
        "エンドポイントがGETリクエストで正常にアクセス可能です。",
        ""
      );
      console.log("[DEBUG] Slack message sent successfully.");
    } catch (error) {
      console.error("[ERROR] Failed to send Slack message:", error);
      await sendErrorNotification(error, "Slack Notification");
    }
    console.log(`[${requestId}] GETリクエストのSlack通知を送信しました`);
  } catch (slackError) {
    console.error(
      `[${requestId}] GETテストのSlack通知の送信に失敗:`,
      slackError
    );
  }

  return NextResponse.json({
    status: "ok",
    request_id: requestId,
    message: "Channelioのwebhookは問い合わせを受け付ける準備ができています",
    timestamp: new Date().toISOString(),
  });
}
