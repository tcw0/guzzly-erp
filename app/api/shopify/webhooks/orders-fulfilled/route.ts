import { NextRequest, NextResponse } from "next/server"
import { verifyShopifyWebhook } from "@/lib/shopify"
import { db } from "@/db/drizzle"
import { shopifyWebhookLogs } from "@/db/schema"
import { eq } from "drizzle-orm"

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

    console.log(`Received webhook: ${topic} for order ${shopifyOrderId} from ${shopDomain}`)

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
    if (!payload.id || !payload.line_items || !Array.isArray(payload.line_items)) {
      throw new Error("Invalid webhook payload structure")
    }

    // 6. Import and call order processing (async, non-blocking)
    // We respond quickly to Shopify, then process in background
    const { processShopifyOrder } = await import("@/server/shopify-orders")
    
    // Process order asynchronously (don't await)
    processShopifyOrder(payload, webhookLogId).catch((error: Error) => {
      console.error("Order processing error:", error)
      // Error handling is done within processShopifyOrder
    })

    // 7. Respond quickly to Shopify (< 5 seconds requirement)
    return NextResponse.json({
      success: true,
      message: "Webhook received and queued for processing",
      webhookLogId,
    })
  } catch (error) {
    console.error("Webhook handler error:", error)

    // Update webhook log with error
    if (webhookLogId) {
      await db
        .update(shopifyWebhookLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
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
