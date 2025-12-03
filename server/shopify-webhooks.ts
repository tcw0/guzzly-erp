"use server"

import { shopifyAdminAPI, isShopifyConfigured, shopifyConfig } from "@/lib/shopify"

/**
 * Create order fulfillment webhook in Shopify
 * This registers your webhook endpoint with Shopify
 */
export async function createOrderFulfillmentWebhook(callbackUrl: string) {
  try {
    const response = await shopifyAdminAPI("/webhooks.json", "POST", {
      webhook: {
        topic: "orders/fulfilled",
        address: callbackUrl,
        format: "json",
      },
    })

    return {
      success: true,
      webhook: response.webhook,
      message: "Webhook created successfully",
    }
  } catch (error) {
    console.error("Error creating webhook:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * List all registered webhooks
 */
export async function listWebhooks() {
  try {
    const response = await shopifyAdminAPI<{ webhooks: any[] }>("/webhooks.json")

    return {
      success: true,
      webhooks: response.webhooks,
    }
  } catch (error) {
    console.error("Error listing webhooks:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      webhooks: [],
    }
  }
}

/**
 * Delete a webhook by ID
 */
export async function deleteWebhook(webhookId: string) {
  try {
    await shopifyAdminAPI(`/webhooks/${webhookId}.json`, "DELETE")

    return {
      success: true,
      message: "Webhook deleted successfully",
    }
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Test Shopify API connection
 */
export async function testShopifyConnection() {
  try {
    if (!isShopifyConfigured()) {
      return {
        configured: false,
        error: "Missing environment variables: SHOPIFY_STORE_URL, SHOPIFY_ADMIN_ACCESS_TOKEN, or SHOPIFY_WEBHOOK_SECRET",
      }
    }

    // Try to fetch shop info to verify credentials work
    const response = await shopifyAdminAPI<{ shop: any }>("/shop.json")

    return {
      configured: true,
      storeUrl: shopifyConfig.storeUrl,
      shopName: response.shop.name,
    }
  } catch (error) {
    console.error("Shopify connection test failed:", error)
    return {
      configured: false,
      storeUrl: shopifyConfig.storeUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
