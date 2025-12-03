"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  createOrderFulfillmentWebhook,
  listWebhooks,
  deleteWebhook,
  testShopifyConnection,
} from "@/server/shopify-webhooks"
import {
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

export default function ShopifyWebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{
    configured: boolean
    storeUrl?: string
    error?: string
  } | null>(null)
  const [callbackUrl, setCallbackUrl] = useState(
    "https://guzzly-erp.vercel.app/api/shopify/webhooks/orders-fulfilled"
  )

  useEffect(() => {
    testConnection()
    loadWebhooks()
  }, [])

  async function testConnection() {
    setTesting(true)
    try {
      const result = await testShopifyConnection()
      setConnectionStatus(result)
      if (!result.configured) {
        toast.error("Shopify API credentials not configured")
      }
    } catch (error) {
      console.error("Connection test error:", error)
      setConnectionStatus({
        configured: false,
        error: "Failed to test connection",
      })
    } finally {
      setTesting(false)
    }
  }

  async function loadWebhooks() {
    setLoading(true)
    try {
      const result = await listWebhooks()
      if (result.success) {
        setWebhooks(result.webhooks)
        console.log("Loaded webhooks:", result.webhooks)
      } else {
        toast.error(`Failed to load webhooks: ${result.error}`)
        console.error("List webhooks error:", result.error)
      }
    } catch (error) {
      toast.error("Error loading webhooks")
      console.error("List webhooks exception:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWebhook() {
    if (!callbackUrl) {
      toast.error("Please enter a callback URL")
      return
    }

    if (!connectionStatus?.configured) {
      toast.error(
        "Shopify API credentials not configured. Check your .env.local file."
      )
      return
    }

    setCreating(true)
    try {
      console.log("Creating webhook for:", callbackUrl)
      const result = await createOrderFulfillmentWebhook(callbackUrl)
      console.log("Create webhook result:", result)
      if (result.success) {
        toast.success("Webhook created successfully!")
        await loadWebhooks()
      } else {
        toast.error(`Failed to create webhook: ${result.error}`)
        console.error("Create webhook error:", result.error)
      }
    } catch (error) {
      toast.error("Error creating webhook")
      console.error("Create webhook exception:", error)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteWebhook(webhookId: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) {
      return
    }

    try {
      const result = await deleteWebhook(webhookId)
      if (result.success) {
        toast.success("Webhook deleted")
        await loadWebhooks()
      } else {
        toast.error(`Failed to delete webhook: ${result.error}`)
      }
    } catch (error) {
      toast.error("Error deleting webhook")
      console.error(error)
    }
  }

  const orderFulfillmentWebhook = webhooks.find(
    (w) => w.topic === "orders/fulfilled"
  )

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shopify Webhooks</h1>
            <p className="text-muted-foreground mt-2">
              Configure webhooks to receive order fulfillment notifications
            </p>
          </div>
          <Button onClick={loadWebhooks} variant="outline" disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Connection Status Alert */}
        {connectionStatus && !connectionStatus.configured && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-900">
                    Shopify API Not Configured
                  </h3>
                  <p className="text-sm text-yellow-800 mt-1">
                    {connectionStatus.error ||
                      "Please configure your Shopify API credentials in .env.local"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {connectionStatus?.configured && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">
                    Connected to Shopify
                  </h3>
                  <p className="text-sm text-green-800 mt-1">
                    Store: {connectionStatus.storeUrl}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Status</CardTitle>
            <CardDescription>
              Order fulfillment webhook configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orderFulfillmentWebhook ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-lg font-medium">Webhook Active</span>
                <Badge variant="default">orders/fulfilled</Badge>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  No order fulfillment webhook configured. Create one below.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Webhook */}
        {!orderFulfillmentWebhook && (
          <Card>
            <CardHeader>
              <CardTitle>Create Webhook</CardTitle>
              <CardDescription>
                Register your webhook endpoint with Shopify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Callback URL</label>
                <Input
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://your-domain.com/api/shopify/webhooks/orders-fulfilled"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This is the URL where Shopify will send webhook notifications
                </p>
              </div>
              <Button onClick={handleCreateWebhook} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Webhook
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Webhooks Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Webhooks</CardTitle>
            <CardDescription>
              Manage all registered webhooks for your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : webhooks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No webhooks configured
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell>
                        <Badge>{webhook.topic}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {webhook.address}
                      </TableCell>
                      <TableCell>{webhook.format}</TableCell>
                      <TableCell>
                        {new Date(webhook.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">
                1. Ensure API Credentials are Set
              </h4>
              <p className="text-muted-foreground">
                Make sure your `.env.local` file contains:
              </p>
              <pre className="bg-muted p-3 rounded mt-2 text-xs overflow-x-auto">
                {`SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=your-secret`}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Create the Webhook</h4>
              <p className="text-muted-foreground">
                Click "Create Webhook" above to register your endpoint with
                Shopify
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. Test the Integration</h4>
              <p className="text-muted-foreground">
                Create and fulfill a test order in Shopify to verify the webhook
                works
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">4. Monitor Webhook Logs</h4>
              <p className="text-muted-foreground">
                Check the `shopify_webhook_logs` table to see incoming webhooks
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
