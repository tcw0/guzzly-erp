"use server"

import { db } from "@/db/drizzle"
import {
  shopifyOrders,
  shopifyOrderItems,
  shopifyWebhookLogs,
  shopifyVariantMappings,
  shopifyPropertyMappings,
  productVariants,
  products,
  inventory,
  inventoryMovements,
} from "@/db/schema"
import { inventoryActionEnum } from "@/constants/inventory-actions"
import { shopifyAdminAPI } from "@/lib/shopify"
import { eq, and, sql } from "drizzle-orm"

// Shopify order payload types
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

interface ShopifyOrderListItem {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  totalPrice: string
  currency: string
  customerEmail: string | null
  lineItems: Array<{
    id: string
    title: string
    variantTitle: string
    quantity: number
    sku: string
    properties: Array<{ name: string; value: string }>
  }>
}

/**
 * Fetch latest orders directly from Shopify
 * Used by the admin UI to display current Shopify order status and picklists
 */
export async function fetchShopifyOrdersLive(limit: number = 50) {
  try {
    const response = await shopifyAdminAPI<{ orders: ShopifyOrder[] }>(
      `/orders.json?status=any&limit=${limit}&order=created_at%20desc`
    )

    console.log(response.orders[0])

    const orders: ShopifyOrderListItem[] = response.orders.map((order) => {
      const status = order.cancelled_at
        ? "cancelled"
        : order.fulfillment_status || "open"

      return {
        id: String(order.id),
        orderNumber: String(order.order_number ?? order.name ?? order.id),
        status,
        createdAt: order.created_at,
        totalPrice: order.total_price,
        currency: order.currency || "USD",
        customerEmail: order.email || order.customer?.email || null,
        lineItems: order.line_items.map((item) => ({
          id: String(item.id),
          title: item.title,
          variantTitle: item.variant_title || "",
          quantity: item.quantity,
          sku: item.sku || "",
          properties: (item.properties || []).filter(
            (prop): prop is { name: string; value: string } =>
              Boolean(prop?.name) && Boolean(prop?.value)
          ),
        })),
      }
    })

    return { success: true, orders }
  } catch (error) {
    console.error("Error fetching Shopify orders live:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      orders: [] as ShopifyOrderListItem[],
    }
  }
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

    console.log(`[Order ${shopifyOrderId}] Starting processing...`, {
      lineItems: payload.line_items.length,
      webhookLogId,
    })

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
    const customerEmail = payload.email || payload.customer?.email || null

    console.log(`[Order ${shopifyOrderId}] Creating order record...`, {
      orderNumber: payload.order_number,
      customerEmail,
      totalAmount: payload.total_price,
    })

    let order
    try {
      const [insertedOrder] = await db
        .insert(shopifyOrders)
        .values({
          shopifyOrderId,
          shopifyOrderNumber: String(payload.order_number),
          status: "fulfilled",
          fulfilledAt: new Date(),
          totalAmount: payload.total_price,
          customerEmail,
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
      order = insertedOrder
    } catch (dbError) {
      console.error(
        `[Order ${shopifyOrderId}] ❌ Database error creating order:`,
        {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
          payload: {
            shopifyOrderId,
            orderNumber: payload.order_number,
            customerEmail,
            totalAmount: payload.total_price,
          },
        }
      )
      throw new Error(
        `Failed to create order in database: ${
          dbError instanceof Error ? dbError.message : String(dbError)
        }`
      )
    }

    console.log(`[Order ${shopifyOrderId}] ✅ Order record created:`, {
      orderId: order.id,
      shopifyOrderNumber: order.shopifyOrderNumber,
    })

    // 3. Map line items to ERP components
    // Each Shopify variant can map to MULTIPLE ERP components with quantities
    // Example: 1x Ski Pole Set → 2x Grips, 2x Sticks, 2x Baskets, 2x Slings
    const mappingResults: {
      mapped: Array<{
        erpVariantId: string
        erpProductId: string
        quantity: number
        componentQuantity: number // Quantity per Shopify item
        totalQuantity: number // componentQuantity * lineItem.quantity
        lineItem: ShopifyLineItem
        erpSku: string
        erpProductName: string
      }>
      unmapped: Array<{
        lineItem: ShopifyLineItem
        reason: string
      }>
    } = {
      mapped: [],
      unmapped: [],
    }

    console.log(
      `[Order ${shopifyOrderId}] Processing ${payload.line_items.length} line items...`
    )

    for (const lineItem of payload.line_items) {
      const shopifyVariantId = String(lineItem.variant_id)

      console.log(`[Order ${shopifyOrderId}] Line item:`, {
        id: lineItem.id,
        sku: lineItem.sku,
        variantId: shopifyVariantId,
        title: lineItem.title,
        quantity: lineItem.quantity,
      })

      // Skip if no variant ID
      if (!lineItem.variant_id) {
        console.warn(
          `[Order ${shopifyOrderId}] Skipping line item - no variant_id`
        )
        mappingResults.unmapped.push({
          lineItem,
          reason: "No variant_id in Shopify order",
        })
        continue
      }

      // Strategy 1: Try variant-based mappings (fixed component sets)
      let componentMappings = await db
        .select({
          mappingId: shopifyVariantMappings.id,
          erpVariantId: shopifyVariantMappings.productVariantId,
          componentQuantity: shopifyVariantMappings.quantity,
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
        .where(
          and(
            eq(shopifyVariantMappings.shopifyVariantId, shopifyVariantId),
            eq(shopifyVariantMappings.syncStatus, "active")
          )
        )

      // Strategy 2: If no variant mappings, try property-based mappings (customizable products)
      if (
        componentMappings.length === 0 &&
        lineItem.properties &&
        lineItem.properties.length > 0
      ) {
        console.log(
          `[Order ${shopifyOrderId}] No variant mappings, checking property-based mappings...`
        )

        // Get all property mappings for this variant
        const propertyMappings = await db
          .select({
            mappingId: shopifyPropertyMappings.id,
            propertyRules: shopifyPropertyMappings.propertyRules,
            erpVariantId: shopifyPropertyMappings.productVariantId,
            componentQuantity: shopifyPropertyMappings.quantity,
            erpProductId: productVariants.productId,
            erpProductName: products.name,
            erpSku: productVariants.sku,
          })
          .from(shopifyPropertyMappings)
          .leftJoin(
            productVariants,
            eq(shopifyPropertyMappings.productVariantId, productVariants.id)
          )
          .leftJoin(products, eq(productVariants.productId, products.id))
          .where(
            and(
              eq(shopifyPropertyMappings.shopifyVariantId, shopifyVariantId),
              eq(shopifyPropertyMappings.syncStatus, "active")
            )
          )

        // Match properties to rules
        for (const mapping of propertyMappings) {
          const rules = mapping.propertyRules as Record<string, string>
          const matchesAll = Object.entries(rules).every(
            ([propName, propValue]) => {
              const lineItemProp = lineItem.properties!.find(
                (p) => p.name.toUpperCase() === propName.toUpperCase()
              )
              return (
                lineItemProp &&
                lineItemProp.value.toUpperCase() === propValue.toUpperCase()
              )
            }
          )

          if (matchesAll && mapping.erpVariantId && mapping.erpProductId) {
            console.log(`[Order ${shopifyOrderId}] Matched property rule:`, {
              rules,
              erpVariantId: mapping.erpVariantId,
            })
            componentMappings.push({
              mappingId: mapping.mappingId,
              erpVariantId: mapping.erpVariantId,
              componentQuantity: mapping.componentQuantity,
              erpProductId: mapping.erpProductId,
              erpProductName: mapping.erpProductName,
              erpSku: mapping.erpSku,
              syncStatus: "active",
            })
          }
        }
      }

      if (componentMappings.length === 0) {
        mappingResults.unmapped.push({
          lineItem,
          reason: `No active mappings found for Shopify variant ${shopifyVariantId} (SKU: ${lineItem.sku})`,
        })

        // Store unmapped line item for review
        await db.insert(shopifyOrderItems).values({
          orderId: order.id,
          shopifyLineItemId: String(lineItem.id),
          shopifyProductId: String(lineItem.product_id || ""),
          shopifyVariantId,
          sku: lineItem.sku || `variant-${shopifyVariantId}`,
          productVariantId: null,
          quantity: String(lineItem.quantity),
          price: lineItem.price,
          mappingStatus: "unmapped",
        })

        continue
      }

      console.log(
        `[Order ${shopifyOrderId}] Found ${componentMappings.length} component(s) for variant ${shopifyVariantId}`
      )

      // Process each component mapping
      for (const mapping of componentMappings) {
        if (!mapping.erpVariantId || !mapping.erpProductId) {
          console.warn(
            `[Order ${shopifyOrderId}] Skipping invalid mapping ${mapping.mappingId}`
          )
          continue
        }

        const componentQty = Number(mapping.componentQuantity)
        const totalQty = componentQty * lineItem.quantity

        console.log(
          `[Order ${shopifyOrderId}] Component: ${mapping.erpProductName} (${mapping.erpSku})`,
          {
            componentQty,
            lineItemQty: lineItem.quantity,
            totalQty,
          }
        )

        // Store mapped line item (one record per component)
        await db.insert(shopifyOrderItems).values({
          orderId: order.id,
          shopifyLineItemId: String(lineItem.id),
          shopifyProductId: String(lineItem.product_id || ""),
          shopifyVariantId,
          sku: lineItem.sku || `variant-${shopifyVariantId}`,
          productVariantId: mapping.erpVariantId,
          quantity: String(totalQty), // Total quantity to deduct
          price: lineItem.price,
          mappingStatus: "mapped",
        })

        mappingResults.mapped.push({
          erpVariantId: mapping.erpVariantId,
          erpProductId: mapping.erpProductId,
          quantity: lineItem.quantity,
          componentQuantity: componentQty,
          totalQuantity: totalQty,
          lineItem,
          erpSku: mapping.erpSku || "",
          erpProductName: mapping.erpProductName || "",
        })
      }
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

    // 5. Check inventory availability for all components
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
          insufficient: quantityOnHand < item.totalQuantity,
        }
      })
    )

    const insufficientStock = inventoryChecks.filter(
      (check) => check.insufficient
    )

    if (insufficientStock.length > 0) {
      const stockWarning = `Insufficient stock: ${insufficientStock
        .map(
          (item) =>
            `${item.erpProductName} (${item.erpSku}) - need ${item.totalQuantity}, have ${item.quantityOnHand}`
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

      console.warn(
        `Order ${shopifyOrderId} has insufficient stock:`,
        stockWarning
      )
    }

    // 6. Deduct inventory for all component mappings (sales fulfillment)
    if (mappingResults.mapped.length > 0) {
      console.log(
        `[Order ${shopifyOrderId}] Deducting inventory for ${mappingResults.mapped.length} component(s)`
      )

      // Deduct inventory for each component
      // Aggregate components to avoid multiple updates to same variant
      const componentAggregation = new Map<
        string,
        { productId: string; totalQty: number; name: string; sku: string }
      >()

      for (const item of mappingResults.mapped) {
        const existing = componentAggregation.get(item.erpVariantId)
        if (existing) {
          existing.totalQty += item.totalQuantity
        } else {
          componentAggregation.set(item.erpVariantId, {
            productId: item.erpProductId,
            totalQty: item.totalQuantity,
            name: item.erpProductName,
            sku: item.erpSku,
          })
        }
      }

      console.log(
        `[Order ${shopifyOrderId}] Aggregated into ${componentAggregation.size} unique component(s)`
      )

      // Deduct inventory for each unique component
      for (const [variantId, component] of componentAggregation.entries()) {
        // Create inventory movement record (negative quantity for sale)
        await db.insert(inventoryMovements).values({
          productId: component.productId,
          variantId: variantId,
          quantity: (-component.totalQty).toString(),
          action: inventoryActionEnum.enum.ADJUSTMENT, // Using ADJUSTMENT for sales
        })

        // Update inventory quantity
        const [updatedInventory] = await db
          .update(inventory)
          .set({
            quantityOnHand: sql`${inventory.quantityOnHand} - ${component.totalQty}`,
          })
          .where(eq(inventory.variantId, variantId))
          .returning({ newQuantity: inventory.quantityOnHand })

        console.log(
          `[Order ${shopifyOrderId}] Deducted ${component.totalQty}x ${component.name} (${component.sku}): ${updatedInventory.newQuantity} remaining`
        )

        // Check if inventory went negative (shouldn't happen due to earlier check)
        if (parseFloat(updatedInventory.newQuantity.toString()) < 0) {
          console.warn(
            `[Order ${shopifyOrderId}] ⚠️  Negative inventory for ${component.name} (${component.sku}): ${updatedInventory.newQuantity}`
          )
        }
      }

      // Mark order as processed
      await db
        .update(shopifyOrders)
        .set({
          processedAt: new Date(),
        })
        .where(eq(shopifyOrders.id, order.id))

      console.log(`[Order ${shopifyOrderId}] ✅ Processed successfully`, {
        mappedItems: mappingResults.mapped.length,
        unmappedItems: mappingResults.unmapped.length,
        orderId: order.id,
      })
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
    console.error(`[Order Processing] ❌ Fatal error:`, {
      webhookLogId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

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

/**
 * Get all Shopify orders with their line items
 * Optimized for production/packing dashboard
 */
export async function getShopifyOrders() {
  try {
    const orders = await db
      .select({
        id: shopifyOrders.id,
        shopifyOrderId: shopifyOrders.shopifyOrderId,
        shopifyOrderNumber: shopifyOrders.shopifyOrderNumber,
        status: shopifyOrders.status,
        customerEmail: shopifyOrders.customerEmail,
        totalAmount: shopifyOrders.totalAmount,
        fulfilledAt: shopifyOrders.fulfilledAt,
        processedAt: shopifyOrders.processedAt,
        errorMessage: shopifyOrders.errorMessage,
        createdAt: shopifyOrders.createdAt,
      })
      .from(shopifyOrders)
      .orderBy(shopifyOrders.createdAt)

    // Get line items for all orders
    const orderIds = orders.map((o) => o.id)
    const allLineItems =
      orderIds.length > 0
        ? await db
            .select({
              orderId: shopifyOrderItems.orderId,
              id: shopifyOrderItems.id,
              shopifyLineItemId: shopifyOrderItems.shopifyLineItemId,
              shopifyProductId: shopifyOrderItems.shopifyProductId,
              shopifyVariantId: shopifyOrderItems.shopifyVariantId,
              shopifySku: shopifyOrderItems.sku,
              quantity: shopifyOrderItems.quantity,
              price: shopifyOrderItems.price,
              mappedToVariantId: shopifyOrderItems.productVariantId,
              mappingStatus: shopifyOrderItems.mappingStatus,
              // Get ERP product info
              erpProductName: products.name,
              erpSku: productVariants.sku,
            })
            .from(shopifyOrderItems)
            .leftJoin(
              productVariants,
              eq(shopifyOrderItems.productVariantId, productVariants.id)
            )
            .leftJoin(products, eq(productVariants.productId, products.id))
            .where(
              eq(
                shopifyOrderItems.orderId,
                orderIds.length === 1 ? orderIds[0] : shopifyOrderItems.orderId
              )
            )
        : []

    // Group line items by order
    const ordersWithItems = orders.map((order) => ({
      ...order,
      lineItems: allLineItems.filter((item) => item.orderId === order.id),
    }))

    return {
      success: true,
      orders: ordersWithItems,
    }
  } catch (error) {
    console.error("Error fetching orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      orders: [],
    }
  }
}

/**
 * Get recent webhook logs for monitoring
 */
export async function getWebhookLogs(limit: number = 50) {
  try {
    const logs = await db
      .select()
      .from(shopifyWebhookLogs)
      .orderBy(shopifyWebhookLogs.createdAt)
      .limit(limit)

    return {
      success: true,
      logs,
    }
  } catch (error) {
    console.error("Error fetching webhook logs:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      logs: [],
    }
  }
}
