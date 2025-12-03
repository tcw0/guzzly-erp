"use server"

import { isShopifyConfigured, shopifyConfig } from "@/lib/shopify"

/**
 * Check if Shopify integration is configured
 * Simply validates environment variables are present
 */
export async function isShopifyIntegrationActive() {
  if (!isShopifyConfigured()) {
    return { 
      active: false, 
      reason: "Environment variables not configured. Check .env.local" 
    }
  }

  return { 
    active: true,
    storeUrl: shopifyConfig.storeUrl,
  }
}

/**
 * Get Shopify configuration status (without exposing credentials)
 */
export async function getShopifyConfigStatus() {
  return {
    configured: isShopifyConfigured(),
    storeUrl: shopifyConfig.storeUrl || null,
    apiVersion: shopifyConfig.apiVersion,
  }
}
