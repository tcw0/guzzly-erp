import { NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { shopifyWebhookLogs, shopifyOrders, shopifyOrderItems } from "@/db/schema"
import { processShopifyOrder } from "@/server/shopify-orders"
import { eq } from "drizzle-orm"

/**
 * Debug endpoint for testing order processing with custom payloads
 * This allows setting breakpoints in the IDE and stepping through the code
 * 
 * POST /api/shopify/debug/process-order
 * Body: { payload: ShopifyOrderPayload }
 */
export async function POST(request: Request) {
  try {
    const { payload } = await request.json()

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Missing payload" },
        { status: 400 }
      )
    }

    console.log("🔍 [DEBUG] Starting debug order processing", {
      orderId: payload.id,
      orderNumber: payload.order_number,
    })

    // Create a webhook log entry for tracking
    const [webhookLog] = await db
      .insert(shopifyWebhookLogs)
      .values({
        topic: "orders/fulfilled",
        shopifyOrderId: String(payload.id),
        status: "received",
        payload,
      })
      .returning()

    console.log("🔍 [DEBUG] Webhook log created:", webhookLog.id)

    // Process the order - THIS IS WHERE YOU SET BREAKPOINTS
    // Open /server/shopify-orders.ts and set breakpoints in processShopifyOrder()
    const result = await processShopifyOrder(payload, webhookLog.id)

    console.log("🔍 [DEBUG] Processing complete:", result)

    // Fetch the created order and line items for detailed response
    let order = null
    let lineItems = []

    if (result.orderId) {
      const [orderRecord] = await db
        .select()
        .from(shopifyOrders)
        .where(eq(shopifyOrders.id, result.orderId))
        .limit(1)

      order = orderRecord

      lineItems = await db
        .select()
        .from(shopifyOrderItems)
        .where(eq(shopifyOrderItems.orderId, result.orderId))
    }

    // Fetch updated webhook log
    const [updatedWebhookLog] = await db
      .select()
      .from(shopifyWebhookLogs)
      .where(eq(shopifyWebhookLogs.id, webhookLog.id))
      .limit(1)

    return NextResponse.json({
      success: result.success,
      orderId: result.orderId,
      processedItems: result.processedItems,
      unmappedItems: result.unmappedItems,
      insufficientStock: result.insufficientStock,
      warnings: result.warnings,
      skipped: result.skipped,
      webhookLogId: webhookLog.id,
      webhookLog: updatedWebhookLog,
      order,
      lineItems,
    })
  } catch (error) {
    console.error("🔍 [DEBUG] Error processing order:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Debug endpoint ready. Use POST with payload to test order processing.",
    usage: {
      method: "POST",
      body: {
        payload: "Shopify order webhook payload object",
      },
    },
  })
}
