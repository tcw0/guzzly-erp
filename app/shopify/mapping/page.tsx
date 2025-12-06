"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  fetchShopifyProducts,
  getERPFinalProducts,
  getExistingMappings,
  createVariantMapping,
  deleteVariantMapping,
  getMappingStats,
} from "@/server/shopify-sync"
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
  Plus,
  Trash2,
  Edit,
  Package,
} from "lucide-react"

interface ShopifyVariant {
  shopifyProductId: string
  shopifyVariantId: string
  productTitle: string
  variantTitle: string
  shopifySku: string
  price: string
  inventoryQuantity: number
}

interface ERPVariant {
  productId: string
  productName: string
  variantId: string | null
  variantSku: string | null
  variantDisplay?: string
  variations?: Array<{
    variationName: string | null
    optionValue: string | null
  }>
}

interface ComponentMapping {
  id?: string
  productVariantId: string
  quantity: string
  erpProductName: string | null
  erpVariantSku: string | null
}

interface Mapping {
  shopifyProductId: string
  shopifyVariantId: string
  syncStatus: string
  lastSyncedAt: string | null
  syncErrors: string | null
  components: ComponentMapping[]
}

export default function ShopifyMappingPage() {
  const [shopifyVariants, setShopifyVariants] = useState<ShopifyVariant[]>([])
  const [erpVariants, setERPVariants] = useState<ERPVariant[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<
    "all" | "mapped" | "unmapped"
  >("all")

  // Dialog state for editing component mappings
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ShopifyVariant | null>(
    null
  )
  const [componentDraft, setComponentDraft] = useState<
    Array<{ erpVariantId: string; quantity: number }>
  >([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [shopifyResult, erpResult, mappingsResult, statsResult] =
        await Promise.all([
          fetchShopifyProducts(),
          getERPFinalProducts(),
          getExistingMappings(),
          getMappingStats(),
        ])

      if (shopifyResult.success) {
        setShopifyVariants(shopifyResult.variants)
      } else {
        toast.error(`Failed to load Shopify products: ${shopifyResult.error}`)
      }

      if (erpResult.success) {
        setERPVariants(erpResult.variants as ERPVariant[])
      } else {
        toast.error(`Failed to load ERP products: ${erpResult.error}`)
      }

      if (mappingsResult.success) {
        setMappings(mappingsResult.mappings as Mapping[])
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats)
      }
    } catch (error) {
      toast.error("Failed to load data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function openMappingDialog(shopifyVariant: ShopifyVariant) {
    setEditingVariant(shopifyVariant)
    
    // Load existing components if any
    const existing = getMappingForShopifyVariant(shopifyVariant.shopifyVariantId)
    if (existing && existing.components.length > 0) {
      setComponentDraft(
        existing.components.map((c) => ({
          erpVariantId: c.productVariantId,
          quantity: parseFloat(c.quantity),
        }))
      )
    } else {
      // Start with one empty component
      setComponentDraft([{ erpVariantId: "", quantity: 1 }])
    }
    
    setDialogOpen(true)
  }

  function addComponent() {
    setComponentDraft([...componentDraft, { erpVariantId: "", quantity: 1 }])
  }

  function removeComponent(index: number) {
    setComponentDraft(componentDraft.filter((_, i) => i !== index))
  }

  function updateComponent(
    index: number,
    field: "erpVariantId" | "quantity",
    value: string | number
  ) {
    const updated = [...componentDraft]
    updated[index] = { ...updated[index], [field]: value }
    setComponentDraft(updated)
  }

  async function handleSaveMapping() {
    if (!editingVariant) return

    // Validate: all components must have ERP variant selected
    const invalidComponents = componentDraft.filter((c) => !c.erpVariantId)
    if (invalidComponents.length > 0) {
      toast.error("Please select an ERP product for all components")
      return
    }

    // Validate: at least one component
    if (componentDraft.length === 0) {
      toast.error("Please add at least one component")
      return
    }

    setSaving(true)
    try {
      const result = await createVariantMapping({
        shopifyProductId: editingVariant.shopifyProductId,
        shopifyVariantId: editingVariant.shopifyVariantId,
        components: componentDraft,
      })

      if (result.success) {
        toast.success(result.message)
        setDialogOpen(false)
        setEditingVariant(null)
        setComponentDraft([])
        await loadData()
      } else {
        toast.error(result.error || "Failed to save mapping")
      }
    } catch (error) {
      toast.error("An error occurred while saving")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMapping(shopifyVariantId: string) {
    const mapping = getMappingForShopifyVariant(shopifyVariantId)
    if (!mapping || !mapping.components[0]?.id) return

    try {
      // Delete first component's mapping (will cascade delete all components)
      const result = await deleteVariantMapping(mapping.components[0].id)
      if (result.success) {
        toast.success("Mapping deleted")
        await loadData()
      } else {
        toast.error(result.error || "Failed to delete mapping")
      }
    } catch (error) {
      toast.error("An error occurred while deleting")
      console.error(error)
    }
  }

  const getMappingForShopifyVariant = (shopifyVariantId: string) => {
    return mappings.find((m) => m.shopifyVariantId === shopifyVariantId)
  }

  const filteredVariants = shopifyVariants.filter((variant) => {
    const matchesSearch =
      variant.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.variantTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.shopifySku.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (filterStatus === "mapped") {
      return !!getMappingForShopifyVariant(variant.shopifyVariantId)
    } else if (filterStatus === "unmapped") {
      return !getMappingForShopifyVariant(variant.shopifyVariantId)
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shopify Product Mapping</h1>
            <p className="text-muted-foreground mt-2">
              Map Shopify products to your ERP FINAL products for order
              fulfillment
            </p>
          </div>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Shopify Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalShopifyVariants}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  ERP FINAL Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalERPFinalProducts}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Mapped</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalMapped}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.mappingPercentage}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Product Mappings</CardTitle>
            <CardDescription>
              Select an ERP product for each Shopify product variant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Shopify products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select
                value={filterStatus}
                onValueChange={(value: "all" | "mapped" | "unmapped") =>
                  setFilterStatus(value)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="mapped">Mapped Only</SelectItem>
                  <SelectItem value="unmapped">Unmapped Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mapping Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Shopify Product</TableHead>
                    <TableHead>Shopify SKU</TableHead>
                    <TableHead>ERP Components</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVariants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVariants.map((shopifyVariant) => {
                      const existingMapping = getMappingForShopifyVariant(
                        shopifyVariant.shopifyVariantId
                      )
                      const isMapped = !!existingMapping

                      return (
                        <TableRow key={shopifyVariant.shopifyVariantId}>
                          <TableCell>
                            {isMapped ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Mapped
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Unmapped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {shopifyVariant.productTitle}
                              </div>
                              {shopifyVariant.variantTitle !==
                                "Default Title" && (
                                <div className="text-sm text-muted-foreground">
                                  {shopifyVariant.variantTitle}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {shopifyVariant.shopifySku || "No SKU"}
                            </code>
                          </TableCell>
                          <TableCell>
                            {isMapped && existingMapping ? (
                              <div className="space-y-1">
                                {existingMapping.components.map(
                                  (component, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <Package className="h-3 w-3 text-muted-foreground" />
                                      <span className="font-medium">
                                        {component.quantity}×
                                      </span>
                                      <span>
                                        {component.erpProductName || "Unknown"}
                                      </span>
                                      {component.erpVariantSku && (
                                        <code className="text-xs bg-muted px-1 rounded">
                                          {component.erpVariantSku}
                                        </code>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No components mapped
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant={isMapped ? "outline" : "default"}
                                onClick={() =>
                                  openMappingDialog(shopifyVariant)
                                }
                              >
                                {isMapped ? (
                                  <>
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Map
                                  </>
                                )}
                              </Button>
                              {isMapped && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleDeleteMapping(
                                      shopifyVariant.shopifyVariantId
                                    )
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Mapping Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Map ERP Components</DialogTitle>
            <DialogDescription>
              {editingVariant && (
                <>
                  Configure which ERP products and quantities are needed for{" "}
                  <strong>{editingVariant.productTitle}</strong>
                  {editingVariant.variantTitle !== "Default Title" && (
                    <> ({editingVariant.variantTitle})</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4">
              {componentDraft.map((component, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`erp-${index}`}>
                            ERP Product (FINAL)
                          </Label>
                          <Select
                            value={component.erpVariantId}
                            onValueChange={(value) =>
                              updateComponent(index, "erpVariantId", value)
                            }
                          >
                            <SelectTrigger id={`erp-${index}`}>
                              <SelectValue placeholder="Select ERP product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {erpVariants.map((erpVariant) => (
                                <SelectItem
                                  key={
                                    erpVariant.variantId || erpVariant.productId
                                  }
                                  value={
                                    erpVariant.variantId || erpVariant.productId
                                  }
                                >
                                  <div className="flex flex-col">
                                    <span>
                                      {erpVariant.variantDisplay ||
                                        erpVariant.productName}
                                    </span>
                                    {erpVariant.variantSku && (
                                      <span className="text-xs text-muted-foreground">
                                        SKU: {erpVariant.variantSku}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`qty-${index}`}>
                            Quantity per item sold
                          </Label>
                          <Input
                            id={`qty-${index}`}
                            type="number"
                            min="1"
                            step="1"
                            value={component.quantity}
                            onChange={(e) =>
                              updateComponent(
                                index,
                                "quantity",
                                parseFloat(e.target.value) || 1
                              )
                            }
                            className="w-32"
                          />
                          <p className="text-xs text-muted-foreground">
                            How many of this component per Shopify item
                          </p>
                        </div>
                      </div>

                      {componentDraft.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeComponent(index)}
                          className="mt-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addComponent}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
            </div>
          </ScrollArea>

          <Separator />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setEditingVariant(null)
                setComponentDraft([])
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save Mapping</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
