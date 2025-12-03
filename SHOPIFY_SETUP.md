# Shopify Integration Setup Guide

## Prerequisites

1. A Shopify store (can be a development store)
2. Admin access to your Shopify store

## Step 1: Create a Custom App in Shopify

1. Go to your Shopify Admin: `https://your-store.myshopify.com/admin`
2. Navigate to: **Settings** > **Apps and sales channels** > **Develop apps**
3. Click **Create an app**
4. Name it: "ERP Integration" (or similar)
5. Click **Create app**

## Step 2: Configure API Scopes

1. Click **Configure Admin API scopes**
2. Enable the following scopes:
   - `read_products` - Read product data
   - `read_product_listings` - Read product listings
   - `read_orders` - Read order data
   - `read_fulfillments` - Read fulfillment data
   - `write_inventory` - (Optional) For future inventory sync back to Shopify

3. Click **Save**

## Step 3: Install the App

1. Click the **API credentials** tab
2. Click **Install app**
3. Confirm the installation

## Step 4: Get Your Access Token

1. In the **API credentials** tab, you'll now see:
   - **Admin API access token** - Click "Reveal token once" and copy it
   - This is your `SHOPIFY_ADMIN_ACCESS_TOKEN`

2. Note your store URL (e.g., `your-store.myshopify.com`)
   - This is your `SHOPIFY_STORE_URL`

## Step 5: Create Webhook

1. Scroll down to **Webhooks** section
2. Click **Create webhook**
3. Configure:
   - **Event**: `Order fulfillment`
   - **Format**: `JSON`
   - **URL**: `https://your-erp-domain.com/api/shopify/webhooks/orders-fulfilled`
   - **API version**: `2024-10` (or latest stable)

4. After creating, note the **Webhook signing secret**
   - This is your `SHOPIFY_WEBHOOK_SECRET`

## Step 6: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your credentials in `.env.local`:
   ```bash
   SHOPIFY_STORE_URL=your-store.myshopify.com
   SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SHOPIFY_WEBHOOK_SECRET=your-webhook-secret-key
   SHOPIFY_API_VERSION=2024-10
   ```

## Step 7: Test Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/shopify` in your ERP system

3. Enter your credentials and click **Test Connection**

4. If successful, you'll see: ✅ "Connected to Shopify"

## Security Notes

- ⚠️ **Never commit `.env.local` to version control**
- ✅ `.env.local` is already in `.gitignore`
- 🔐 Webhook signatures are verified using HMAC-SHA256
- 🛡️ Use timing-safe comparison to prevent timing attacks
- 🔒 Credentials stored in environment variables (secure in production hosting)

## Testing Webhooks Locally

To test webhooks on your local machine:

1. Install ngrok:
   ```bash
   brew install ngrok
   ```

2. Start ngrok:
   ```bash
   ngrok http 3000
   ```

3. Use the ngrok URL in your Shopify webhook configuration:
   ```
   https://your-random-id.ngrok.io/api/shopify/webhooks/orders-fulfilled
   ```

4. Test by creating and fulfilling an order in Shopify

## Troubleshooting

### "Shopify API credentials not configured" error
- Check that all environment variables are set in `.env.local`
- Restart your Next.js development server after adding env vars

### Webhook verification fails
- Ensure `SHOPIFY_WEBHOOK_SECRET` matches exactly what's in Shopify
- Check that you're using the raw request body for HMAC verification

### Rate limiting errors
- Shopify allows 2 API calls per second
- The built-in rate limiter handles this automatically
- If you see 429 errors, reduce concurrent API calls

## Next Steps

After configuration:

1. ✅ Run SKU synchronization to map Shopify products to ERP variants
2. ✅ Test order fulfillment webhook with a test order
3. ✅ Monitor webhook logs in the admin dashboard
4. ✅ Review unmapped SKUs and fix any mismatches
