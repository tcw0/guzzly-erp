"use server"

import { db } from "@/db/drizzle"
import {
  shopifyOrders,
  shopifyOrderItems,
  shopifyWebhookLogs,
  shopifyVariantMappings,
  productVariants,
  products,
  inventory,
} from "@/db/schema"
import { createOutput } from "@/server/output"
import { eq, and } from "drizzle-orm"

// Shopify order payload types
interface ShopifyLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  sku: string
  title: string
  quantity: number
  price: string
  fulfillment_status: string | null
}

interface ShopifyOrder {
  id: number
  order_number: number
  email: string
  financial_status: string
  fulfillment_status: string
  total_price: string
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
 * Process a fulfilled Shopify order
 * Maps line items to ERP variants and creates output transaction
 */
export async function processShopifyOrder(
  payload: ShopifyOrder,
  webhookLogId: string
) {
  try {
    const shopifyOrderId = String(payload.id)

    console.log(`Processing order ${shopifyOrderId}...`)

    // 1. Check if order already processed (idempotency)
    const [existingOrder] = await db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.shopifyOrderId, shopifyOrderId))
      .limit(1)

    if (existingOrder?.processedAt) {
      console.log(`Order ${shopifyOrderId} already processed, skipping`)

      // Update webhook log
      await db
        .update(shopifyWebhookLogs)
        .set({
          status: "processed",
          processedAt: new Date(),
        })
        .where(eq(shopifyWebhookLogs.id, webhookLogId))

      return { success: true, skipped: true, orderId: existingOrder.id }
    }

    // 2. Create or update order record
    const [order] = await db
      .insert(shopifyOrders)
      .values({
        shopifyOrderId,
        shopifyOrderNumber: String(payload.order_number),
        status: "fulfilled",
        fulfilledAt: new Date(),
        totalAmount: payload.total_price,
        customerEmail: payload.email,
        rawPayload: payload,
      })
      .onConflictDoUpdate({
        target: shopifyOrders.shopifyOrderId,
        set: {
          status: "fulfilled",
          fulfilledAt: new Date(),
        },
      })
      .returning()

    // 3. Map line items to ERP variants
    const mappingResults: {
      mapped: Array<{
        erpVariantId: string
        erpProductId: string
        quantity: number
        lineItem: ShopifyLineItem
      }>
      unmapped: Array<{
        lineItem: ShopifyLineItem
        reason: string
      }>
    } = {
      mapped: [],
      unmapped: [],
    }

    for (const lineItem of payload.line_items) {
      const shopifyVariantId = String(lineItem.variant_id)

      // Skip if no variant ID
      if (!lineItem.variant_id) {
        mappingResults.unmapped.push({
          lineItem,
          reason: "No variant_id in Shopify order",
        })
        continue
      }

      // Find mapping in our database
      const [mapping] = await db
        .select({
          mappingId: shopifyVariantMappings.id,
          erpVariantId: shopifyVariantMappings.productVariantId,
          erpProductId: productVariants.productId,
          erpProductName: products.name,
          erpSku: productVariants.sku,
          syncStatus: shopifyVariantMappings.syncStatus,
        })
        .from(shopifyVariantMappings)
        .leftJoin(
          productVariants,
          eq(shopifyVariantMappings.productVariantId, productVariants.id)
        )
        .leftJoin(products, eq(productVariants.productId, products.id))
        .where(eq(shopifyVariantMappings.shopifyVariantId, shopifyVariantId))
        .limit(1)

      if (!mapping || !mapping.erpVariantId || !mapping.erpProductId) {
        mappingResults.unmapped.push({
          lineItem,
          reason: `No mapping found for Shopify variant ${shopifyVariantId} (SKU: ${lineItem.sku})`,
        })

        // Store unmapped line item for review
        await db.insert(shopifyOrderItems).values({
          orderId: order.id,
          shopifyLineItemId: String(lineItem.id),
          shopifyProductId: String(lineItem.product_id || ""),
          shopifyVariantId,
          sku: lineItem.sku,
          productVariantId: null,
          quantity: String(lineItem.quantity),
          price: lineItem.price,
          mappingStatus: "unmapped",
        })

        continue
      }

      // Check if mapping is active
      if (mapping.syncStatus !== "active") {
        mappingResults.unmapped.push({
          lineItem,
          reason: `Mapping disabled for variant ${shopifyVariantId}`,
        })
        continue
      }

      // Store mapped line item
      await db.insert(shopifyOrderItems).values({
        orderId: order.id,
        shopifyLineItemId: String(lineItem.id),
        shopifyProductId: String(lineItem.product_id || ""),
        shopifyVariantId,
        sku: lineItem.sku,
        productVariantId: mapping.erpVariantId,
        quantity: String(lineItem.quantity),
        price: lineItem.price,
        mappingStatus: "mapped",
      })

      mappingResults.mapped.push({
        erpVariantId: mapping.erpVariantId,
        erpProductId: mapping.erpProductId,
        quantity: lineItem.quantity,
        lineItem,
      })
    }

    // 4. Handle unmapped items
    if (mappingResults.unmapped.length > 0) {
      const errorMessage = `Unmapped items: ${mappingResults.unmapped
        .map((u) => `${u.lineItem.title} (${u.lineItem.sku}): ${u.reason}`)
        .join("; ")}`

      await db
        .update(shopifyOrders)
        .set({ errorMessage })
        .where(eq(shopifyOrders.id, order.id))

      console.warn(`Order ${shopifyOrderId} has unmapped items:`, errorMessage)
    }

    // 5. Check inventory availability for mapped items
    const inventoryChecks = await Promise.all(
      mappingResults.mapped.map(async (item) => {
        const [inventoryRecord] = await db
          .select()
          .from(inventory)
          .where(eq(inventory.variantId, item.erpVariantId))
          .limit(1)

        const quantityOnHand = inventoryRecord
          ? Number(inventoryRecord.quantityOnHand)
          : 0

        return {
          ...item,
          quantityOnHand,
          insufficient: quantityOnHand < item.quantity,
        }
      })
    )

    const insufficientStock = inventoryChecks.filter((check) => check.insufficient)

    if (insufficientStock.length > 0) {
      const stockWarning = `Insufficient stock: ${insufficientStock
        .map(
          (item) =>
            `${item.lineItem.title} (need ${item.quantity}, have ${item.quantityOnHand})`
        )
        .join("; ")}`

      await db
        .update(shopifyOrders)
        .set({
          errorMessage: shopifyOrders.errorMessage
            ? `${shopifyOrders.errorMessage}; ${stockWarning}`
            : stockWarning,
        })
        .where(eq(shopifyOrders.id, order.id))

      console.warn(`Order ${shopifyOrderId} has insufficient stock:`, stockWarning)
    }

    // 6. Create output transaction if we have any mapped items
    if (mappingResults.mapped.length > 0) {
      const outputs = mappingResults.mapped.map((item) => ({
        productId: item.erpProductId,
        variantId: item.erpVariantId,
        quantity: item.quantity,
      }))

      // Create output transaction (will update inventory)
      const outputResult = await createOutput({ outputs })

      if (!outputResult.success) {
        throw new Error("Failed to create output transaction")
      }

      // Mark order as processed
      await db
        .update(shopifyOrders)
        .set({
          processedAt: new Date(),
        })
        .where(eq(shopifyOrders.id, order.id))

      console.log(
        `Order ${shopifyOrderId} processed successfully: ${mappingResults.mapped.length} items fulfilled`
      )
    } else {
      // No mapped items - update error message
      await db
        .update(shopifyOrders)
        .set({
          errorMessage: "No items could be mapped to ERP products",
        })
        .where(eq(shopifyOrders.id, order.id))
    }

    // 7. Update webhook log
    await db
      .update(shopifyWebhookLogs)
      .set({
        status: mappingResults.unmapped.length > 0 ? "failed" : "processed",
        errorMessage:
          mappingResults.unmapped.length > 0
            ? `Partially processed: ${mappingResults.unmapped.length} unmapped items`
            : null,
        processedAt: new Date(),
      })
      .where(eq(shopifyWebhookLogs.id, webhookLogId))

    return {
      success: true,
      orderId: order.id,
      processedItems: mappingResults.mapped.length,
      unmappedItems: mappingResults.unmapped.length,
      insufficientStock: insufficientStock.length,
      warnings:
        mappingResults.unmapped.length > 0 || insufficientStock.length > 0,
    }
  } catch (error) {
    console.error("Order processing error:", error)

    // Log error in webhook log
    await db
      .update(shopifyWebhookLogs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(shopifyWebhookLogs.id, webhookLogId))
      .catch((err) => console.error("Failed to update webhook log:", err))

    throw error
  }
}

/**
 * Get order processing status and details
 * Useful for admin dashboard
 */
export async function getOrderStatus(shopifyOrderId: string) {
  try {
    const [order] = await db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.shopifyOrderId, shopifyOrderId))
      .limit(1)

    if (!order) {
      return { success: false, error: "Order not found" }
    }

    const lineItems = await db
      .select()
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.orderId, order.id))

    return {
      success: true,
      order,
      lineItems,
      processed: !!order.processedAt,
      hasErrors: !!order.errorMessage,
    }
  } catch (error) {
    console.error("Error fetching order status:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
