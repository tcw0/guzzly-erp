# Webhook Verification Guide

## How to Check if Webhooks Were Created Successfully

### Method 1: Check in Your ERP Admin (Recommended)
1. Navigate to `/shopify/webhooks` in your ERP system
2. The page will show:
   - Connection status (green = connected, yellow = not configured)
   - List of all registered webhooks
   - Webhook details (topic, address, creation date)

### Method 2: Check in Shopify Admin UI

**For Custom Apps (Current System):**
Unfortunately, Shopify removed the webhook UI from the Custom Apps section. You cannot view or manage webhooks through the Shopify Admin UI for custom apps anymore.

**Workaround:** Use your ERP admin interface (Method 1) or the Shopify Admin API directly.

### Method 3: Use Shopify Admin API Directly

You can verify webhooks using curl or any API client:

```bash
curl -X GET \
  "https://YOUR-STORE.myshopify.com/admin/api/2024-10/webhooks.json" \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Replace:
- `YOUR-STORE` with your Shopify store URL (from SHOPIFY_STORE_URL)
- `YOUR_ACCESS_TOKEN` with your admin access token

Expected response if webhook exists:
```json
{
  "webhooks": [
    {
      "id": 1234567890,
      "address": "https://www.guzzly.de/api/shopify/webhooks/orders-fulfilled",
      "topic": "orders/fulfilled",
      "created_at": "2025-12-03T10:00:00-00:00",
      "updated_at": "2025-12-03T10:00:00-00:00",
      "format": "json",
      "fields": [],
      "metafield_namespaces": [],
      "api_version": "2024-10"
    }
  ]
}
```

Expected response if no webhooks:
```json
{
  "webhooks": []
}
```

## Troubleshooting: Why Webhooks Don't Show

### 1. Check API Credentials
Verify your `.env.local` file has all required values:
```bash
# In your project directory
cat .env.local | grep SHOPIFY
```

Required variables:
- `SHOPIFY_STORE_URL=your-store.myshopify.com` (without https://)
- `SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxx`
- `SHOPIFY_WEBHOOK_SECRET=your-webhook-secret`
- `SHOPIFY_API_VERSION=2024-10`

### 2. Check API Token Permissions
Your Shopify Admin API access token needs these scopes:
- `read_orders` - To receive order webhooks
- `write_webhooks` - To create/delete webhooks
- `read_webhooks` - To list webhooks

To verify in Shopify Admin:
1. Go to Settings > Apps and sales channels > Develop apps
2. Click on your custom app
3. Click "Configuration" tab
4. Check "Admin API access scopes"
5. Make sure the above scopes are checked
6. If you added new scopes, click "Save" and then "Install app" again

### 3. Check Browser Console for Errors
1. Open your ERP at `/shopify/webhooks`
2. Open browser DevTools (F12 or Cmd+Option+I on Mac)
3. Go to Console tab
4. Look for error messages when page loads or when clicking "Create Webhook"

Common errors:
- `Shopify API credentials not configured` → Missing .env.local variables
- `401 Unauthorized` → Invalid access token or missing permissions
- `404 Not Found` → Wrong store URL format
- `Failed to fetch` → Network/CORS issues (shouldn't happen with server actions)

### 4. Test API Connection
The webhook page now includes an automatic connection test that:
- Validates environment variables are set
- Tests API credentials by calling Shopify's `/shop.json` endpoint
- Shows green banner if connected, yellow banner if not

### 5. Check Server Logs
Look at your terminal where `pnpm dev` is running. You should see:
```
Loaded webhooks: [...]
```

If you see errors like:
```
Shopify API error (401): Unauthorized
Shopify API error (404): Not Found
```

This indicates credential or configuration issues.

## Common Issues and Solutions

### Issue: "No webhooks configured" but I just created one
**Solution:** Click the Refresh button. The webhook list loads on mount but doesn't auto-refresh.

### Issue: Yellow warning "Shopify API Not Configured"
**Solution:** 
1. Create/update `.env.local` file in your project root
2. Add all required SHOPIFY_* variables
3. Restart your dev server: Stop `pnpm dev` and run it again

### Issue: Green "Connected" but webhook creation fails
**Solution:** Check API token permissions (see section 2 above). You need `write_webhooks` scope.

### Issue: Webhook created but not receiving events
**Solution:**
1. Verify webhook is registered: Check at `/shopify/webhooks`
2. Check webhook address matches your domain: `https://www.guzzly.de/api/shopify/webhooks/orders-fulfilled`
3. Test webhook endpoint: `curl https://www.guzzly.de/api/shopify/webhooks/orders-fulfilled`
4. Create a test order in Shopify and mark it as fulfilled
5. Check `shopify_webhook_logs` table in database for incoming webhooks

### Issue: API returns "This action requires merchant approval"
**Solution:** 
1. Go to Shopify Admin > Settings > Apps and sales channels > Develop apps
2. Click your custom app
3. Look for any pending approval banners
4. Request merchant approval if needed

## Testing Your Webhook

After creating the webhook, test it:

### 1. Create Test Order in Shopify
1. Go to Shopify Admin > Orders
2. Click "Create order"
3. Add a product
4. Create order
5. Mark as "Paid"
6. Click "Fulfill items"

### 2. Check Webhook Logs
Query your database:
```sql
SELECT * FROM shopify_webhook_logs 
ORDER BY received_at DESC 
LIMIT 10;
```

You should see a new entry with:
- `topic = 'orders/fulfilled'`
- `status = 'success'` or `'error'`
- Response details in JSON

### 3. Check Orders Table
```sql
SELECT * FROM shopify_orders 
ORDER BY created_at DESC 
LIMIT 10;
```

You should see the order with:
- `shopify_order_id` matching the Shopify order
- `fulfillment_status = 'fulfilled'`
- Processed timestamp

### 4. Check Inventory
Your inventory should be decremented for the fulfilled items.

## Alternative: Manual Webhook Registration

If the UI doesn't work, register webhooks programmatically:

```typescript
// Create a one-off script: scripts/register-webhook.ts
import { createOrderFulfillmentWebhook } from "@/server/shopify-webhooks"

async function main() {
  const result = await createOrderFulfillmentWebhook(
    "https://www.guzzly.de/api/shopify/webhooks/orders-fulfilled"
  )
  console.log(result)
}

main()
```

Run with:
```bash
npx tsx scripts/register-webhook.ts
```

## Need More Help?

Check these resources:
- Shopify Webhook Documentation: https://shopify.dev/docs/apps/build/webhooks
- Shopify Admin API Reference: https://shopify.dev/docs/api/admin-rest
- Your webhook logs in database: `shopify_webhook_logs` table
