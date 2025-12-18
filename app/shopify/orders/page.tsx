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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { toast } from "sonner"
import {
  fetchShopifyOrdersLive,
  upsertOrderAnnotation,
} from "@/server/shopify-orders"
import {
  Loader2,
  RefreshCw,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Edit2,
  Save,
  X,
} from "lucide-react"

interface ShopifyOrderLineItem {
  id: string
  title: string
  variantTitle: string
  quantity: number
  sku: string
  properties: Array<{ name: string; value: string }>
}

interface ShopifyOrderItem {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  totalPrice: string
  currency: string
  customerEmail: string | null
  displayCustomerName: string | null
  lineItems: ShopifyOrderLineItem[]
}

function isOpenStatus(status: string) {
  return status === "open" || status === "partial" || status === "unfulfilled"
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "fulfilled") return "default"
  if (status === "cancelled") return "destructive"
  if (status === "partial") return "secondary"
  return "outline"
}

function formatStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
]

export default function ShopifyOrdersPage() {
  const [orders, setOrders] = useState<ShopifyOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [editingCustomerName, setEditingCustomerName] = useState<
    Record<string, { value: string; saving: boolean }>
  >({})

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    try {
      const result = await fetchShopifyOrdersLive()
      if (result.success) {
        const normalizedOrders = result.orders as ShopifyOrderItem[]
        setOrders(normalizedOrders)

        const defaults = new Set<string>()
        normalizedOrders.forEach((order) => {
          if (isOpenStatus(order.status)) {
            defaults.add(order.id)
          }
        })
        setExpandedOrders(defaults)
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

  async function saveCustomerName(orderId: string) {
    const editing = editingCustomerName[orderId]
    if (!editing) return

    setEditingCustomerName((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], saving: true },
    }))

    try {
      const result = await upsertOrderAnnotation(orderId, editing.value)
      if (result.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, displayCustomerName: editing.value || null }
              : o
          )
        )
        // Clear editing state on success
        setEditingCustomerName((prev) => {
          const next = { ...prev }
          delete next[orderId]
          return next
        })
        toast.success("Customer name saved")
      } else {
        toast.error("Failed to save customer name")
        // Reset saving flag on error
        setEditingCustomerName((prev) => ({
          ...prev,
          [orderId]: { ...prev[orderId], saving: false },
        }))
      }
    } catch (error) {
      toast.error("Error saving customer name")
      console.error(error)
      // Reset saving flag on error
      setEditingCustomerName((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saving: false },
      }))
    }
  }

  function startEditingCustomerName(
    orderId: string,
    currentName: string | null
  ) {
    setEditingCustomerName((prev) => ({
      ...prev,
      [orderId]: { value: currentName || "", saving: false },
    }))
  }

  function cancelEditingCustomerName(orderId: string) {
    setEditingCustomerName((prev) => {
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }

  function setOrderExpanded(orderId: string, open: boolean) {
    const next = new Set(expandedOrders)
    if (open) {
      next.add(orderId)
    } else {
      next.delete(orderId)
    }
    setExpandedOrders(next)
  }

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        order.orderNumber.toLowerCase().includes(term) ||
        (order.customerEmail || "").toLowerCase().includes(term) ||
        order.lineItems.some((item) => {
          const matchesTitle = item.title.toLowerCase().includes(term)
          const matchesSku = item.sku.toLowerCase().includes(term)
          const matchesProperties = item.properties.some((prop) =>
            `${prop.name} ${prop.value}`.toLowerCase().includes(term)
          )
          return matchesTitle || matchesSku || matchesProperties
        })
      )
    }

    return true
  })

  const stats = {
    total: orders.length,
    open: orders.filter((o) => isOpenStatus(o.status)).length,
    fulfilled: orders.filter((o) => o.status === "fulfilled").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shopify Orders</h1>
            <p className="text-muted-foreground mt-2">
              Live orders from Shopify with picklists for open orders
            </p>
          </div>
          <Button onClick={loadOrders} variant="outline" disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

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
                Open
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.open}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fulfilled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.fulfilled}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cancelled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.cancelled}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order #, email, item, or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                  <Collapsible
                    key={order.id}
                    open={expandedOrders.has(order.id)}
                    onOpenChange={(open) => setOrderExpanded(order.id, open)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0"
                              >
                                <Package className="h-4 w-4 mr-2" />
                                Order #{order.orderNumber}
                              </Button>
                            </CollapsibleTrigger>
                            <Badge
                              variant={statusBadgeVariant(order.status)}
                              className="gap-1 shrink-0"
                            >
                              {order.status === "fulfilled" && (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {isOpenStatus(order.status) && (
                                <Clock className="h-3 w-3" />
                              )}
                              {order.status === "cancelled" && (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              {formatStatusLabel(order.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm flex-wrap justify-end">
                            {editingCustomerName[order.id] ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingCustomerName[order.id].value}
                                  onChange={(e) =>
                                    setEditingCustomerName((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        value: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Customer name"
                                  className="h-8 w-40"
                                  disabled={
                                    editingCustomerName[order.id].saving
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => saveCustomerName(order.id)}
                                  disabled={
                                    editingCustomerName[order.id].saving
                                  }
                                  className="h-8"
                                >
                                  {editingCustomerName[order.id].saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    cancelEditingCustomerName(order.id)
                                  }
                                  disabled={
                                    editingCustomerName[order.id].saving
                                  }
                                  className="h-8"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={
                                    order.displayCustomerName
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {order.displayCustomerName ||
                                    order.customerEmail ||
                                    "No name"}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    startEditingCustomerName(
                                      order.id,
                                      order.displayCustomerName
                                    )
                                  }
                                  className="h-8 px-2"
                                  title="Edit customer name"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <div className="text-muted-foreground">
                              {order.totalPrice} {order.currency}
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="p-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">
                                  Qty
                                </TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Variant</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Properties</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.lineItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-right font-medium">
                                    {item.quantity}x
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">
                                      {item.title}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.variantTitle || "-"}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {item.sku || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {item.properties.length > 0 ? (
                                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                        {item.properties.map((prop, index) => (
                                          <span
                                            key={`${item.id}-prop-${index}`}
                                          >
                                            {prop.name}: {prop.value}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
