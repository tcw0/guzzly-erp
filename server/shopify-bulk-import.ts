"use server"

import { db } from "@/db/drizzle"
import { shopifyWebhookLogs } from "@/db/schema"
import { shopifyAdminAPI } from "@/lib/shopify"
import { processShopifyOrder } from "./shopify-orders"

interface ShopifyLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  sku: string
  title: string
  variant_title: string
  quantity: number
  price: string
  fulfillment_status: string | null
  properties?: Array<{
    name: string
    value: string
  }>
}

interface ShopifyOrder {
  id: number
  order_number: number
  name?: string
  email?: string | null
  customer?: {
    id: number
    email?: string | null
    [key: string]: any
  }
  financial_status: string
  fulfillment_status: string
  total_price: string
  currency?: string
  cancelled_at?: string | null
  created_at: string
  updated_at: string
  line_items: ShopifyLineItem[]
  fulfillments?: Array<{
    id: number
    created_at: string
    updated_at: string
    line_items: ShopifyLineItem[]
  }>
}

/**
 * Fetch all fulfilled orders from Shopify and process them
 * This is a one-time bulk import to reconcile historical orders
 */
export async function bulkImportFulfilledOrders() {
  try {
    const allOrders: ShopifyOrder[] = []
    let hasNextPage = true
    let pageInfo: string | null = null
    let processedCount = 0
    let errorCount = 0
    const errors: Array<{ orderId: string; error: string }> = []

    console.log("[Bulk Import] Starting to fetch fulfilled orders from Shopify...")

    // Step 1: Fetch all fulfilled orders from Shopify
    while (hasNextPage) {
      const endpoint: string = pageInfo
        ? `/orders.json?status=any&fulfillment_status=fulfilled&limit=250&page_info=${pageInfo}`
        : `/orders.json?status=any&fulfillment_status=fulfilled&limit=250`

      const response = await shopifyAdminAPI<{ orders: ShopifyOrder[] }>(
        endpoint
      )

      allOrders.push(...response.orders)
      console.log(
        `[Bulk Import] Fetched ${response.orders.length} orders (total: ${allOrders.length})`
      )

      // Check for next page
      hasNextPage = response.orders.length === 250
      pageInfo = hasNextPage ? String(allOrders.length) : null

      // Add delay to respect rate limits (2 calls/second)
      if (hasNextPage) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    console.log(
      `[Bulk Import] Fetched ${allOrders.length} fulfilled orders from Shopify`
    )

    // Step 2: Process each order through the standard webhook handler
    for (let i = 0; i < allOrders.length; i++) {
      const order = allOrders[i]
      const shopifyOrderId = String(order.id)

      console.log(
        `[Bulk Import] Processing order ${i + 1}/${allOrders.length}: ${shopifyOrderId}`
      )

      try {
        // Create webhook log entry first
        const [webhookLog] = await db
          .insert(shopifyWebhookLogs)
          .values({
            topic: "orders/fulfilled",
            shopifyOrderId,
            status: "received",
            payload: order,
          })
          .returning()

        // Process the order using existing logic
        const result = await processShopifyOrder(order, webhookLog.id)

        if (result.success) {
          processedCount++
          console.log(
            `[Bulk Import] ✅ Order ${shopifyOrderId} processed successfully`
          )
        } else {
          errorCount++
          errors.push({
            orderId: shopifyOrderId,
            error: "Processing returned success=false",
          })
          console.error(
            `[Bulk Import] ❌ Order ${shopifyOrderId} failed to process`
          )
        }
      } catch (error) {
        errorCount++
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        errors.push({
          orderId: shopifyOrderId,
          error: errorMessage,
        })
        console.error(
          `[Bulk Import] ❌ Error processing order ${shopifyOrderId}:`,
          errorMessage
        )
      }

      // Add small delay between order processing to avoid overwhelming the database
      if (i < allOrders.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log(
      `[Bulk Import] Complete: ${processedCount} processed, ${errorCount} errors`
    )

    return {
      success: true,
      totalOrders: allOrders.length,
      processedCount,
      errorCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      message: `Imported ${processedCount} orders successfully. ${errorCount} orders had errors.`,
    }
  } catch (error) {
    console.error("[Bulk Import] Fatal error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      totalOrders: 0,
      processedCount: 0,
      errorCount: 0,
      errors: [],
    }
  }
}


