# Shopify Order Processing Debug Guide

## Overview

The debug page at `/shopify/debug` allows you to test order processing with custom payloads and step through the code with IDE breakpoints.

## How to Use

### 1. Start Dev Server in Debug Mode

**Stop your current dev server** (Ctrl+C in terminal), then:

**Option A: Using VS Code's Debug Panel (Recommended)**
1. Create `.vscode/launch.json` (see configuration below)
2. Go to VS Code's Run and Debug panel (⇧⌘D)
3. Select "Next.js: debug server-side" from dropdown
4. Click the green play button
5. Wait for "ready - started server on 0.0.0.0:3000" message

**Option B: Using Terminal**
```bash
NODE_OPTIONS='--inspect' pnpm dev
```
Then in VS Code:
1. Go to Run and Debug panel (⇧⌘D)
2. Click "JavaScript Debug Terminal"
3. Debugger will auto-attach

### 2. Set Breakpoints in VS Code

1. Open `/server/shopify-orders.ts`
2. Find the `processShopifyOrder()` function (line ~47)
3. Click in the gutter (left of line numbers) to set breakpoints:
   - Line ~85: Order creation
   - Line ~120: Line item mapping
   - Line ~165: Unmapped item handling
   - Line ~198: Mapped item storage
   - Line ~250: Inventory validation
   - Line ~268: Output transaction creation

### 3. Get a Payload to Test

**Option A: From Vercel Logs**
1. Go to Vercel dashboard → Functions
2. Find a recent webhook execution
3. Copy the payload from logs

**Option B: From Database**
```sql
SELECT payload 
FROM shopify_webhook_logs 
WHERE status = 'received' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Option C: Use Sample Payload**
Click "Load Sample" button on the debug page

### 3. Run Debug Session

1. Navigate to `http://localhost:3000/shopify/debug`
2. Paste your payload or load sample
3. Click "Process Order"
4. Execution will pause at your breakpoints
5. Use VS Code debugger to:
   - Inspect variables
   - Check database state
   - Step through logic
   - Watch expressions

### 4. Process Order with Breakpoints

1. Navigate to `http://localhost:3000/shopify/debug`
2. Paste your payload or load sample
3. Click "Process Order"
4. **Execution will pause at your first breakpoint** ⏸️
5. Use VS Code debugger controls:
   - Continue (F5): Resume until next breakpoint
   - Step Over (F10): Execute current line, move to next
   - Step Into (F11): Enter function calls
   - Step Out (⇧F11): Exit current function
6. Inspect variables in:
   - **Variables panel**: See all local variables
   - **Watch panel**: Add custom expressions
   - **Debug Console**: Run code in current context

### 5. Analyze Results

After execution completes, the page shows:
- ✅ Processing status (success/failed)
- 📊 Stats (processed items, unmapped items, warnings)
- 📝 Created order details
- 📋 Line items with mapping status
- 🐛 Error messages and stack traces
- 📄 Raw response data

## Debugging Common Issues

### Issue: Order not created

**Set breakpoint at line ~92** (order insert)

Check:
- `customerEmail` value (should not be null if schema requires it)
- `payload.email` or `payload.customer?.email` exists
- `shopifyOrderId` is valid string
- `totalAmount` is valid decimal string

### Issue: Line items not mapped

**Set breakpoint at line ~140** (mapping lookup)

Check:
- `shopifyVariantId` is correct
- Mapping exists in `shopify_variant_mappings` table
- `syncStatus` is 'active'
- `erpVariantId` is not null

### Issue: Inventory not deducted

**Set breakpoint at line ~268** (createOutput call)

Check:
- `mappingResults.mapped` array has items
- `erpVariantId` and `erpProductId` are valid UUIDs
- Inventory records exist for variants
- `quantityOnHand` is sufficient

### Issue: Webhook log stays "received"

**Set breakpoint at line ~290** (webhook log update)

Check:
- Code reaches this point (not crashing earlier)
- `webhookLogId` is correct UUID
- Database update succeeds

## Best Practices

### ✅ Do's
- Always test with realistic payloads from production
- Check database state before AND after processing
- Use conditional breakpoints for specific scenarios
- Clear test data between runs
- Document any bugs found with payload examples

### ❌ Don'ts
- Don't test with production data on production database
- Don't commit debug payloads with real customer data
- Don't leave debug page accessible in production
- Don't skip verification of inventory changes

## Database Cleanup

After debugging, clean up test data:

```sql
-- Delete test webhook logs
DELETE FROM shopify_webhook_logs 
WHERE shopify_order_id = 'TEST_ORDER_ID';

-- Delete test orders
DELETE FROM shopify_orders 
WHERE shopify_order_id = 'TEST_ORDER_ID';

-- Reset inventory if needed
UPDATE inventory 
SET quantity_on_hand = quantity_on_hand + X 
WHERE variant_id = 'VARIANT_ID';
```

## Troubleshooting

### Breakpoints not hitting?

1. Make sure dev server is running: `pnpm dev`
2. Check you're on `http://localhost:3000` (not Vercel)
3. Verify breakpoints are in server code (not client components)
4. Try adding a `debugger;` statement instead

### Request timing out?

The debug endpoint has no timeout, but:
1. Check for infinite loops in code
2. Verify database connections aren't hanging
3. Look for unhandled promises

### Can't see variables in debugger?

1. Use "Watch" panel to add expressions
2. Check "Call Stack" to see current context
3. Use `console.log()` as fallback
4. Inspect `this` and `arguments`

## Security Notes

⚠️ **This debug page should be disabled in production!**

Add environment check:
```typescript
if (process.env.NODE_ENV === 'production') {
  return <div>Debug page disabled in production</div>
}
```

Or use middleware to restrict access:
```typescript
// middleware.ts
if (pathname.startsWith('/shopify/debug')) {
  // Check auth or environment
}
```
