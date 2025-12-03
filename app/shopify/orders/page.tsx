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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { getShopifyOrders } from "@/server/shopify-orders"
import {
  Loader2,
  RefreshCw,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Printer,
} from "lucide-react"

interface LineItem {
  id: string
  shopifyLineItemId: string
  shopifyProductId: string
  shopifyVariantId: string
  shopifySku: string
  quantity: number
  price: string
  mappedToVariantId: string | null
  mappingStatus: string
  erpProductName: string | null
  erpSku: string | null
}

interface Order {
  id: string
  shopifyOrderId: string
  shopifyOrderNumber: string
  status: string
  customerEmail: string
  totalAmount: string
  fulfilledAt: Date | null
  processedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  lineItems: LineItem[]
}

export default function ShopifyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    try {
      const result = await getShopifyOrders()
      if (result.success) {
        setOrders(result.orders as Order[])
      } else {
        toast.error(`Failed to load orders: ${result.error}`)
      }
    } catch (error) {
      toast.error("Error loading orders")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function toggleOrder(orderId: string) {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  function printPackingList(order: Order) {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Packing List - Order #${order.shopifyOrderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Packing List - Order #${order.shopifyOrderNumber}</h1>
          <div class="info">
            <p><strong>Customer:</strong> ${order.customerEmail}</p>
            <p><strong>Order Date:</strong> ${new Date(
              order.fulfilledAt || order.createdAt
            ).toLocaleDateString()}</p>
            <p><strong>Total:</strong> €${order.totalAmount}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>ERP SKU</th>
                <th>Quantity</th>
                <th>Packed ☐</th>
              </tr>
            </thead>
            <tbody>
              ${order.lineItems
                .map(
                  (item) => `
                <tr>
                  <td>
                    <strong>${item.erpProductName || "Product"}</strong>
                  </td>
                  <td>${item.erpSku || item.shopifySku || "N/A"}</td>
                  <td><strong>${item.quantity}x</strong></td>
                  <td style="width: 80px;"></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Printed: ${new Date().toLocaleString()}</p>
            <p>Shopify Order ID: ${order.shopifyOrderId}</p>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (statusFilter === "processed" && !order.processedAt) return false
    if (statusFilter === "pending" && order.processedAt) return false
    if (statusFilter === "errors" && !order.errorMessage) return false

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        order.shopifyOrderNumber.toLowerCase().includes(term) ||
        order.customerEmail.toLowerCase().includes(term) ||
        order.lineItems.some(
          (item) =>
            item.erpProductName?.toLowerCase().includes(term) ||
            item.shopifySku.toLowerCase().includes(term) ||
            item.erpSku?.toLowerCase().includes(term)
        )
      )
    }

    return true
  })

  const stats = {
    total: orders.length,
    processed: orders.filter((o) => o.processedAt).length,
    pending: orders.filter((o) => !o.processedAt).length,
    errors: orders.filter((o) => o.errorMessage).length,
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shopify Orders</h1>
            <p className="text-muted-foreground mt-2">
              Production and packing dashboard
            </p>
          </div>
          <Button onClick={loadOrders} variant="outline" disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Processed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.processed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.errors}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order #, email, product, or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="errors">Errors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              {filteredOrders.length} order(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Order Header */}
                    <div className="bg-muted/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleOrder(order.id)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Order #{order.shopifyOrderNumber}
                          </Button>
                          {order.processedAt ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Processed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                          {order.errorMessage && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {order.customerEmail}
                          </div>
                          <div className="text-sm font-medium">
                            €{order.totalAmount}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(
                              order.fulfilledAt || order.createdAt
                            ).toLocaleDateString()}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printPackingList(order)}
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Line Items (Expanded) */}
                    {expandedOrders.has(order.id) && (
                      <div className="p-4">
                        {order.errorMessage && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                              <div>
                                <div className="font-medium text-red-900">
                                  Processing Error
                                </div>
                                <div className="text-sm text-red-700">
                                  {order.errorMessage}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Shopify Product</TableHead>
                              <TableHead>Shopify SKU</TableHead>
                              <TableHead>ERP Product</TableHead>
                              <TableHead>ERP SKU</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">
                                Price
                              </TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.lineItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="text-sm text-muted-foreground">
                                    Shopify Product #{item.shopifyProductId}
                                    <br />
                                    Variant #{item.shopifyVariantId}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {item.shopifySku || "-"}
                                </TableCell>
                                <TableCell>
                                  {item.erpProductName ? (
                                    <div className="font-medium">
                                      {item.erpProductName}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Not mapped
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {item.erpSku || "-"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {item.quantity}x
                                </TableCell>
                                <TableCell className="text-right">
                                  €{item.price}
                                </TableCell>
                                <TableCell>
                                  {item.mappedToVariantId ? (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Mapped
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="gap-1"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      Unmapped
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {order.processedAt && (
                          <div className="mt-4 text-sm text-muted-foreground">
                            Processed at:{" "}
                            {new Date(order.processedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
