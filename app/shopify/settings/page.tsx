"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { testShopifyConnection, listWebhooks } from "@/server/shopify-webhooks"
import { getWebhookLogs } from "@/server/shopify-orders"
import { fetchShopifyProducts, getMappingStats } from "@/server/shopify-sync"
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Server,
  Database,
  Webhook,
  Package,
} from "lucide-react"

export default function ShopifySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<any>(null)
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([
        loadConnection(),
        loadWebhooks(),
        loadLogs(),
        loadStats(),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadConnection() {
    try {
      const result = await testShopifyConnection()
      setConnectionStatus(result)
    } catch (error) {
      console.error("Connection test error:", error)
    }
  }

  async function loadWebhooks() {
    try {
      const result = await listWebhooks()
      if (result.success) {
        setWebhooks(result.webhooks)
      }
    } catch (error) {
      console.error("Webhooks load error:", error)
    }
  }

  async function loadLogs() {
    try {
      const result = await getWebhookLogs(20)
      if (result.success) {
        setLogs(result.logs)
      }
    } catch (error) {
      console.error("Logs load error:", error)
    }
  }

  async function loadStats() {
    try {
      const result = await getMappingStats()
      if (result.success) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error("Stats load error:", error)
    }
  }

  async function handleSyncProducts() {
    setSyncing(true)
    try {
      toast.info("Syncing products from Shopify...")
      const result = await fetchShopifyProducts()
      if (result.success) {
        toast.success(
          `Synced ${result.variants.length} product variants from Shopify`
        )
        await loadStats()
      } else {
        toast.error(`Sync failed: ${result.error}`)
      }
    } catch (error) {
      toast.error("Error syncing products")
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "success":
      case "processed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {status}
          </Badge>
        )
      case "failed":
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {status}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {status}
          </Badge>
        )
    }
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shopify Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configuration, monitoring, and manual sync triggers
            </p>
          </div>
          <Button onClick={loadAll} variant="outline" disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <CardTitle>API Connection Status</CardTitle>
            </div>
            <CardDescription>
              Shopify Admin API connection and credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : connectionStatus ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {connectionStatus.configured ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-green-900">
                          Connected to Shopify
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Store: {connectionStatus.storeUrl}
                        </div>
                        {connectionStatus.shopName && (
                          <div className="text-sm text-muted-foreground">
                            Shop Name: {connectionStatus.shopName}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-900">
                          Not Connected
                        </div>
                        <div className="text-sm text-yellow-800 mt-1">
                          {connectionStatus.error ||
                            "Please configure Shopify API credentials"}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {connectionStatus.configured && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        API Version:
                      </span>{" "}
                      <span className="font-mono">2024-10</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Webhook Endpoint:
                      </span>{" "}
                      <span className="font-mono text-xs">
                        https://guzzly-erp.vercel.app/api/shopify/webhooks/orders-fulfilled
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">Loading...</div>
            )}
          </CardContent>
        </Card>

        {/* Manual Sync Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Manual Sync</CardTitle>
            </div>
            <CardDescription>
              Manually trigger synchronization operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Sync Products from Shopify</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Fetch latest products and variants from Shopify store
                </div>
                {stats && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Current: {stats.totalShopifyVariants} Shopify variants,{" "}
                    {stats.mappedCount} mapped ({stats.completionPercentage}%)
                  </div>
                )}
              </div>
              <Button onClick={handleSyncProducts} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              <CardTitle>Active Webhooks</CardTitle>
            </div>
            <CardDescription>
              Registered webhook subscriptions in Shopify
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No webhooks registered</p>
                <p className="text-sm mt-2">
                  Go to Webhooks page to create one
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell>
                        <Badge>{webhook.topic}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {webhook.address}
                      </TableCell>
                      <TableCell>
                        {new Date(webhook.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Webhook Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Activity</CardTitle>
            <CardDescription>Last 20 webhook events received</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No webhook events received yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.topic}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.shopifyOrderId || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.processedAt
                          ? new Date(log.processedAt).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {log.errorMessage ? (
                          <span className="truncate max-w-xs block">
                            {log.errorMessage}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Environment Variables Info */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Environment variables (configured in .env.local)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SHOPIFY_STORE_URL</span>
                <span>{connectionStatus?.storeUrl || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  SHOPIFY_ADMIN_ACCESS_TOKEN
                </span>
                <span>
                  {connectionStatus?.configured ? "••••••••" : "Not set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  SHOPIFY_WEBHOOK_SECRET
                </span>
                <span>
                  {connectionStatus?.configured ? "••••••••" : "Not set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  SHOPIFY_API_VERSION
                </span>
                <span>2024-10</span>
              </div>
            </div>
            {!connectionStatus?.configured && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm text-yellow-800">
                  To configure, add these variables to your{" "}
                  <code className="font-mono bg-yellow-100 px-1 rounded">
                    .env.local
                  </code>{" "}
                  file and restart the server.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
