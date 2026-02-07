"use client"

import { useEffect, useState, useCallback } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  fetchShopifyOrdersLive,
  upsertOrderAnnotation,
} from "@/server/shopify-orders"
import {
  getManualOrders,
  setManualOrderFulfilled,
  type ManualOrderWithItems,
} from "@/server/manual-orders"
import { ManualOrderForm } from "@/components/forms/ManualOrderForm"
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
  Plus,
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

  const [manualOrders, setManualOrders] = useState<ManualOrderWithItems[]>([])
  const [manualOrderFilter, setManualOrderFilter] = useState<"open" | "fulfilled">("open")
  const [manualOrdersLoading, setManualOrdersLoading] = useState(true)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [editManualOrder, setEditManualOrder] = useState<ManualOrderWithItems | null>(null)
  const [expandedManualOrders, setExpandedManualOrders] = useState<Set<string>>(new Set())

  const loadManualOrders = useCallback(async () => {
    setManualOrdersLoading(true)
    const result = await getManualOrders(manualOrderFilter)
    if (result.success && result.data) {
      setManualOrders(result.data)
      const openIds = new Set(result.data.map((o) => o.id))
      setExpandedManualOrders(openIds)
    }
    setManualOrdersLoading(false)
  }, [manualOrderFilter])

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    loadManualOrders()
  }, [loadManualOrders])

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

  function setManualOrderExpanded(orderId: string, open: boolean) {
    setExpandedManualOrders((prev) => {
      const next = new Set(prev)
      if (open) next.add(orderId)
      else next.delete(orderId)
      return next
    })
  }

  async function handleFulfillManualOrder(orderId: string) {
    const result = await setManualOrderFulfilled(orderId)
    if (result.success) {
      toast.success("Auftrag als erfüllt markiert, Bestand wurde abgezogen.")
      loadManualOrders()
    } else {
      toast.error(result.message ?? "Fehler beim Erfüllen")
    }
  }

  function openCreateManualOrder() {
    setEditManualOrder(null)
    setManualDialogOpen(true)
  }

  function openEditManualOrder(order: ManualOrderWithItems) {
    setEditManualOrder(order)
    setManualDialogOpen(true)
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
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-4 md:p-8">
      <div className="flex h-full w-full flex-col gap-4">
        {/* Manuelle Aufträge */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Manuelle Aufträge</CardTitle>
                <CardDescription>
                  Manuell angelegte Aufträge – bei Erfüllung wird der Bestand abgezogen.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={manualOrderFilter}
                  onValueChange={(v) => setManualOrderFilter(v as "open" | "fulfilled")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={openCreateManualOrder}>
                  <Plus className="mr-2 h-4 w-4" />
                  Manueller Auftrag
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {manualOrdersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : manualOrders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Keine manuellen Aufträge ({manualOrderFilter === "open" ? "Open" : "Fulfilled"})</p>
              </div>
            ) : (
              <div className="space-y-4">
                {manualOrders.map((order) => (
                  <Collapsible
                    key={order.id}
                    open={expandedManualOrders.has(order.id)}
                    onOpenChange={(open) => setManualOrderExpanded(order.id, open)}
                  >
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted/50 p-3 md:p-4">
                        <div className="flex flex-col gap-2">
                          {/* Title + Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="shrink-0 h-auto py-1 px-2 text-left">
                                <Package className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate">{order.name} – #{order.orderNumber}</span>
                              </Button>
                            </CollapsibleTrigger>
                            <Badge
                              variant={order.status === "fulfilled" ? "default" : "outline"}
                              className="shrink-0"
                            >
                              {order.status === "fulfilled" ? (
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                              ) : (
                                <Clock className="mr-1 h-3 w-3" />
                              )}
                              {order.status === "open" ? "Open" : "Fulfilled"}
                            </Badge>
                          </div>
                          {/* Meta: reason, ersteller, datum */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground pl-1">
                            {order.reason && <span>{order.reason}</span>}
                            {order.createdBy && <span>Ersteller: {order.createdBy}</span>}
                            <span>{new Date(order.createdAt).toLocaleString("de-DE")}</span>
                          </div>
                          {/* Actions */}
                          {order.status === "open" && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditManualOrder(order)}
                              >
                                <Edit2 className="mr-1 h-3 w-3" />
                                Bearbeiten
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleFulfillManualOrder(order.id)}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Erfüllen
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="p-3 md:p-4">
                          {/* Mobile: card layout */}
                          <div className="space-y-2 md:hidden">
                            {order.lineItems.map((item) => (
                              <div key={item.id} className="flex items-start gap-3 rounded-md border p-3">
                                <span className="font-semibold shrink-0">{item.quantity}x</span>
                                <div className="min-w-0">
                                  <div className="font-medium">{item.productName}</div>
                                  {item.variantLabel && item.variantLabel !== "–" && (
                                    <div className="text-sm text-muted-foreground">{item.variantLabel}</div>
                                  )}
                                  <div className="text-xs font-mono text-muted-foreground">{item.sku}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Desktop: table layout */}
                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">Menge</TableHead>
                                  <TableHead>Produkt</TableHead>
                                  <TableHead>Variante</TableHead>
                                  <TableHead>SKU</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.lineItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="text-right font-medium">
                                      {item.quantity}x
                                    </TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {item.variantLabel || "–"}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Shopify Orders</CardTitle>
                <CardDescription>
                  Live orders from Shopify – {filteredOrders.length} order(s) found
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-3 text-sm">
                  <span className="font-medium tabular-nums">{stats.total} <span className="text-muted-foreground font-normal">Total</span></span>
                  <span className="font-medium tabular-nums text-yellow-600">{stats.open} <span className="text-muted-foreground font-normal">Open</span></span>
                  <span className="font-medium tabular-nums text-green-600">{stats.fulfilled} <span className="text-muted-foreground font-normal">Fulfilled</span></span>
                  <span className="font-medium tabular-nums text-red-600">{stats.cancelled} <span className="text-muted-foreground font-normal">Cancelled</span></span>
                </div>
                <Button onClick={loadOrders} variant="outline" size="sm" disabled={loading}>
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="flex gap-4 pt-3">
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
                      <div className="bg-muted/50 p-3 md:p-4">
                        <div className="flex flex-col gap-2">
                          {/* Title + Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-auto py-1 px-2 text-left"
                              >
                                <Package className="h-4 w-4 mr-2 shrink-0" />
                                <span className="truncate">Order #{order.orderNumber}</span>
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
                          {/* Meta: customer, price, date */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm pl-1">
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
                              <div className="flex items-center gap-1">
                                <span
                                  className={
                                    order.displayCustomerName
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {order.displayCustomerName ||
                                    order.customerEmail ||
                                    "No name"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    startEditingCustomerName(
                                      order.id,
                                      order.displayCustomerName
                                    )
                                  }
                                  className="h-6 w-6 p-0"
                                  title="Edit customer name"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <span className="text-muted-foreground">
                              {order.totalPrice} {order.currency}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="p-3 md:p-4">
                          {/* Mobile: card layout */}
                          <div className="space-y-2 md:hidden">
                            {order.lineItems.map((item) => (
                              <div key={item.id} className="flex items-start gap-3 rounded-md border p-3">
                                <span className="font-semibold shrink-0">{item.quantity}x</span>
                                <div className="min-w-0">
                                  <div className="font-medium">{item.title}</div>
                                  {item.variantTitle && (
                                    <div className="text-sm text-muted-foreground">{item.variantTitle}</div>
                                  )}
                                  {item.sku && (
                                    <div className="text-xs font-mono text-muted-foreground">{item.sku}</div>
                                  )}
                                  {item.properties.length > 0 && (
                                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                                      {item.properties.map((prop, index) => (
                                        <span key={`${item.id}-mprop-${index}`}>
                                          {prop.name}: {prop.value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Desktop: table layout */}
                          <div className="hidden md:block">
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

      <Dialog
        open={manualDialogOpen}
        onOpenChange={(open) => {
          setManualDialogOpen(open)
          if (!open) setEditManualOrder(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editManualOrder ? "Manuellen Auftrag bearbeiten" : "Manueller Auftrag"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[70vh] overflow-auto pr-4">
            <ManualOrderForm
              editOrder={editManualOrder}
              onSuccess={() => {
                setManualDialogOpen(false)
                setEditManualOrder(null)
                loadManualOrders()
              }}
              onCancel={() => {
                setManualDialogOpen(false)
                setEditManualOrder(null)
              }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  )
}
