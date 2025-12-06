import { NextRequest, NextResponse } from "next/server"
import { verifyShopifyWebhook } from "@/lib/shopify"
import { db } from "@/db/drizzle"
import { shopifyWebhookLogs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { processShopifyOrder } from "@/server/shopify-orders"

/**
 * Webhook endpoint for Shopify orders/fulfilled
 * Called by Shopify when an order is marked as fulfilled
 *
 * IMPORTANT: Must respond within 5 seconds or Shopify will retry
 */
export async function POST(request: NextRequest) {
  let webhookLogId: string | null = null

  try {
    // 1. Get raw body for HMAC verification (must be done before parsing)
    const body = await request.text()
    const hmac = request.headers.get("x-shopify-hmac-sha256")
    const topic = request.headers.get("x-shopify-topic")
    const shopDomain = request.headers.get("x-shopify-shop-domain")

    // 2. Verify webhook authenticity
    if (!hmac) {
      console.error("Missing HMAC header")
      return NextResponse.json(
        { error: "Missing HMAC signature" },
        { status: 401 }
      )
    }

    if (!verifyShopifyWebhook(body, hmac)) {
      console.error("Invalid HMAC signature")
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    // 3. Parse payload after verification
    const payload = JSON.parse(body)
    const shopifyOrderId = payload.id?.toString()

    console.log(
      `Received webhook: ${topic} for order ${shopifyOrderId} from ${shopDomain}`
    )

    // 4. Log webhook receipt immediately
    const [webhookLog] = await db
      .insert(shopifyWebhookLogs)
      .values({
        topic: topic || "orders/fulfilled",
        shopifyOrderId,
        status: "received",
        payload,
      })
      .returning()

    webhookLogId = webhookLog.id

    // 5. Validate payload structure
    if (
      !payload.id ||
      !payload.line_items ||
      !Array.isArray(payload.line_items)
    ) {
      throw new Error("Invalid webhook payload structure")
    }

    // 6. Process order synchronously (must await in serverless environment)
    // Vercel terminates functions after response, so we can't fire-and-forget
    try {
      await processShopifyOrder(payload, webhookLogId)
      
      // 7. Respond to Shopify after successful processing
      return NextResponse.json({
        success: true,
        message: "Webhook processed successfully",
        webhookLogId,
      })
    } catch (processingError) {
      // Processing failed but webhook was received
      console.error("[Webhook] Order processing failed:", {
        orderId: payload.id,
        webhookLogId,
        error: processingError instanceof Error ? processingError.message : "Unknown error",
        stack: processingError instanceof Error ? processingError.stack : undefined,
      })
      
      // Still return success to Shopify (we received the webhook)
      // The error is logged to database in processShopifyOrder
      return NextResponse.json({
        success: true,
        message: "Webhook received but processing failed",
        webhookLogId,
        error: processingError instanceof Error ? processingError.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Webhook handler error:", error)

    // Update webhook log with error
    if (webhookLogId) {
      await db
        .update(shopifyWebhookLogs)
        .set({
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          processedAt: new Date(),
        })
        .where(eq(shopifyWebhookLogs.id, webhookLogId))
        .catch((err) => console.error("Failed to update webhook log:", err))
    }

    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 * Allows testing webhook configuration without processing orders
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/shopify/webhooks/orders-fulfilled",
    message: "Webhook endpoint is ready to receive POST requests",
  })
}
