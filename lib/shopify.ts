import crypto from "crypto"

// Shopify API configuration from environment variables
export const shopifyConfig = {
  storeUrl: process.env.SHOPIFY_STORE_URL || "",
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
  webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || "",
  apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",
}

/**
 * Verify that a webhook request came from Shopify using HMAC signature
 * @param body - Raw request body as string
 * @param hmacHeader - Value from X-Shopify-Hmac-SHA256 header
 * @returns true if signature is valid
 */
export function verifyShopifyWebhook(
  body: string,
  hmacHeader: string
): boolean {
  if (!shopifyConfig.webhookSecret) {
    console.error("SHOPIFY_WEBHOOK_SECRET not configured")
    return false
  }

  try {
    const hash = crypto
      .createHmac("sha256", shopifyConfig.webhookSecret)
      .update(body, "utf8")
      .digest("base64")

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader))
  } catch (error) {
    console.error("Webhook verification error:", error)
    return false
  }
}

/**
 * Make authenticated requests to Shopify Admin API
 * @param endpoint - API endpoint (e.g., /products.json)
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param body - Request body for POST/PUT requests
 * @returns Parsed JSON response
 */
export async function shopifyAdminAPI<T = any>(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<T> {
  if (!shopifyConfig.storeUrl || !shopifyConfig.accessToken) {
    throw new Error("Shopify API credentials not configured")
  }

  const url = `https://${shopifyConfig.storeUrl}/admin/api/${shopifyConfig.apiVersion}${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": shopifyConfig.accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Shopify API error (${response.status}): ${errorText || response.statusText}`
    )
  }

  return response.json()
}

/**
 * Validate Shopify configuration is complete
 * @returns true if all required config values are present
 */
export function isShopifyConfigured(): boolean {
  return !!(
    shopifyConfig.storeUrl &&
    shopifyConfig.accessToken &&
    shopifyConfig.webhookSecret
  )
}

/**
 * Rate limiting helper for Shopify API (2 calls per second limit)
 */
export class ShopifyRateLimiter {
  private lastCallTime = 0
  private readonly minInterval = 500 // 500ms between calls = 2 calls/second

  async wait() {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastCallTime
    const waitTime = Math.max(0, this.minInterval - timeSinceLastCall)

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastCallTime = Date.now()
  }
}

// Singleton rate limiter instance
export const shopifyRateLimiter = new ShopifyRateLimiter()
