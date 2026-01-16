"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  RefreshCw,
} from "lucide-react"
import { bulkImportFulfilledOrders } from "@/server/shopify-bulk-import"

export default function ShopifyDebugPage() {
  const [payload, setPayload] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkImportResult, setBulkImportResult] = useState<any>(null)

  const samplePayload = {
    id: 7186786681160,
    order_number: 1089,
    email: "customer@example.com",
    customer: {
      id: 7987800637768,
      email: "customer@example.com",
    },
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    total_price: "20.00",
    created_at: "2025-12-06T02:38:07+01:00",
    updated_at: "2025-12-06T02:38:43+01:00",
    line_items: [
      {
        id: 17899269849416,
        product_id: 9304134746440,
        variant_id: 49732766761288,
        sku: "GR-PK-004",
        title: "GUZZLY GRIPS - 2er Set",
        variant_title: "Pink",
        quantity: 1,
        price: "20.00",
        fulfillment_status: "fulfilled",
      },
    ],
  }

  function loadSamplePayload() {
    setPayload(JSON.stringify(samplePayload, null, 2))
    toast.success("Sample payload loaded")
  }

  async function handleProcess() {
    if (!payload.trim()) {
      toast.error("Please enter a payload")
      return
    }

    setProcessing(true)
    setResult(null)

    try {
      // Parse payload
      let parsedPayload
      try {
        parsedPayload = JSON.parse(payload)
      } catch (e) {
        throw new Error("Invalid JSON payload")
      }

      // Call the debug endpoint
      const response = await fetch("/api/shopify/debug/process-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: parsedPayload }),
      })

      const data = await response.json()

      setResult(data)

      if (data.success) {
        toast.success("Order processed successfully!")
      } else {
        toast.error(`Processing failed: ${data.error}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setResult({
        success: false,
        error: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  function copyPayload() {
    if (result?.webhookLog?.payload) {
      navigator.clipboard.writeText(
        JSON.stringify(result.webhookLog.payload, null, 2)
      )
      toast.success("Payload copied to clipboard")
    }
  }

  async function handleBulkImport() {
    if (
      !confirm(
        "This will import ALL fulfilled orders from Shopify and process them (mapping to ERP products and deducting inventory). Continue?"
      )
    ) {
      return
    }

    setBulkImporting(true)
    setBulkImportResult(null)

    try {
      const result = await bulkImportFulfilledOrders()

      setBulkImportResult(result)

      if (result.success) {
        toast.success(result.message || "Bulk import completed successfully!")
      } else {
        toast.error(result.error || "Bulk import failed")
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      setBulkImportResult({
        success: false,
        error: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setBulkImporting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shopify Order Debug</h1>
        <p className="text-muted-foreground mt-2">
          Test order processing with custom payloads and bulk import historical
          orders
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Development Only</h3>
              <p className="text-sm text-yellow-800 mt-1">
                This page is for debugging purposes only. Orders processed here
                will create real database records and update inventory. Make sure
                you're testing with appropriate data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Import Section */}
      {/* Bulk Import Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">
              Bulk Import Historical Orders
            </CardTitle>
          </div>
          <CardDescription className="text-blue-800">
            Import all fulfilled orders from Shopify to sync historical data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-blue-900">
              This operation will fetch all fulfilled orders from Shopify and
              process them as if they came through webhooks. Use this to:
            </p>
            <ul className="text-sm text-blue-800 list-disc list-inside space-y-1 ml-2">
              <li>Sync historical orders after setting up the ERP system</li>
              <li>
                Re-import all orders after fixing mappings or configuration
              </li>
              <li>
                Backfill order data after manually clearing the database
              </li>
            </ul>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Note: If you need a clean slate, manually delete data from
                these tables first:
              </p>
              <ul className="text-sm text-yellow-800 list-disc list-inside mt-2 ml-2">
                <li>shopify_order_items</li>
                <li>shopify_orders</li>
                <li>shopify_webhook_logs</li>
                <li>shopify_order_annotations (optional)</li>
                <li>inventory_movements (if recalculating from scratch)</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleBulkImport}
            disabled={bulkImporting}
            size="lg"
            className="w-full"
            variant="default"
          >
            {bulkImporting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Importing Orders...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                Import All Fulfilled Orders
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Import Results */}
      {bulkImportResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Bulk Import Results</CardTitle>
              {bulkImportResult.success ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Failed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {bulkImportResult.success ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-2xl font-bold">
                      {bulkImportResult.totalOrders}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Orders
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-md">
                    <div className="text-2xl font-bold text-green-700">
                      {bulkImportResult.processedCount}
                    </div>
                    <div className="text-sm text-green-600">Processed</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-md">
                    <div className="text-2xl font-bold text-red-700">
                      {bulkImportResult.errorCount}
                    </div>
                    <div className="text-sm text-red-600">Errors</div>
                  </div>
                </div>

                {bulkImportResult.errors &&
                  bulkImportResult.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-red-600">
                        Errors (first 10):
                      </h4>
                      <div className="space-y-2">
                        {bulkImportResult.errors.map(
                          (
                            err: { orderId: string; error: string },
                            index: number
                          ) => (
                            <div
                              key={index}
                              className="text-sm bg-red-50 p-2 rounded"
                            >
                              <span className="font-mono text-xs">
                                Order {err.orderId}:
                              </span>{" "}
                              {err.error}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-900 mb-2">Error</h4>
                <p className="text-sm text-red-800">
                  {bulkImportResult.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium mb-2">1. Set Breakpoints in IDE</h4>
              <p className="text-muted-foreground">
                Open{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  /server/shopify-orders.ts
                </code>{" "}
                in VS Code and set breakpoints in the{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  processShopifyOrder()
                </code>{" "}
                function
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Load Payload</h4>
              <p className="text-muted-foreground">
                Click "Load Sample" or paste a webhook payload from Vercel logs
                or the{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  shopify_webhook_logs
                </code>{" "}
                table
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. Start Debugging</h4>
              <p className="text-muted-foreground">
                Click "Process Order" - execution will pause at your breakpoints.
                Step through the code to inspect variables, database queries, and
                logic flow.
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">4. Review Results</h4>
              <p className="text-muted-foreground">
                Check the result output below for processing status, created
                records, and any errors encountered.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payload Input */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Order Payload (JSON)</CardTitle>
              <CardDescription>
                Shopify webhook payload to process
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadSamplePayload}>
              Load Sample
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full h-96 font-mono text-sm border rounded-md p-4 bg-muted/50"
            placeholder="Paste Shopify order payload here..."
            spellCheck={false}
          />
          <Button onClick={handleProcess} disabled={processing} size="lg">
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Process Order
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Processing Result</CardTitle>
              {result.success ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Success
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Failed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Order ID
                    </div>
                    <div className="text-lg font-mono">{result.orderId}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Webhook Log ID
                    </div>
                    <div className="text-lg font-mono">
                      {result.webhookLogId}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Processed Items
                    </div>
                    <div className="text-lg">{result.processedItems}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Unmapped Items
                    </div>
                    <div className="text-lg">{result.unmappedItems}</div>
                  </div>
                </div>

                {result.warnings && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-900">
                          Warnings
                        </div>
                        <div className="text-sm text-yellow-700 mt-1">
                          {result.unmappedItems > 0 && (
                            <div>
                              • {result.unmappedItems} items could not be mapped
                              to ERP products
                            </div>
                          )}
                          {result.insufficientStock > 0 && (
                            <div>
                              • {result.insufficientStock} items have
                              insufficient stock
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {result.order && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Order Details</h4>
                    </div>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(result.order, null, 2)}
                    </pre>
                  </div>
                )}

                {result.lineItems && result.lineItems.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Line Items</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(result.lineItems, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">Error</div>
                    <div className="text-sm text-red-700 mt-1">
                      {result.error}
                    </div>
                    {result.details && (
                      <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Raw Response */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Raw Response
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                    toast.success("Response copied to clipboard")
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Useful Database Queries</CardTitle>
          <CardDescription>Check processing results</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">
              Check Webhook Logs (Last 5)
            </h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {`SELECT 
  topic, 
  shopify_order_id, 
  status, 
  error_message,
  created_at,
  processed_at
FROM shopify_webhook_logs 
ORDER BY created_at DESC 
LIMIT 5;`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">
              Check Created Orders (Last 5)
            </h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {`SELECT 
  shopify_order_number,
  customer_email,
  status,
  total_amount,
  processed_at,
  error_message
FROM shopify_orders 
ORDER BY created_at DESC 
LIMIT 5;`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">
              Check Order Line Items
            </h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
              {`SELECT 
  soi.sku,
  soi.quantity,
  soi.mapping_status,
  pv.sku as erp_sku,
  p.name as product_name
FROM shopify_order_items soi
LEFT JOIN product_variants pv ON soi.product_variant_id = pv.id
LEFT JOIN products p ON pv.product_id = p.id
WHERE soi.order_id = 'YOUR_ORDER_ID'
ORDER BY soi.created_at;`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
