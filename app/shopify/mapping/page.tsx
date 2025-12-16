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
  createPropertyMapping,
  getPropertyMappings,
  deletePropertyMapping,
} from "@/server/shopify-sync"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Settings2,
  Box,
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

interface PropertyMapping {
  id: string
  shopifyProductId: string
  shopifyVariantId: string
  propertyRules: Record<string, string>
  productVariantId: string
  quantity: string
  syncStatus: string
  createdAt: string
  erpProductName: string | null
  erpVariantSku: string | null
}

interface PropertyMappingGroup {
  shopifyVariantId: string
  propertyRules: Record<string, string>
  propertyRulesKey: string
  components: Array<{
    id: string
    productVariantId: string
    quantity: string
    erpProductName: string | null
    erpVariantSku: string | null
  }>
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

  // Property mapping state
  const [propertyMappings, setPropertyMappings] = useState<PropertyMapping[]>(
    []
  )
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false)
  const [editingPropertyVariant, setEditingPropertyVariant] =
    useState<ShopifyVariant | null>(null)
  const [propertyRulesDraft, setPropertyRulesDraft] = useState<
    Array<{ key: string; value: string }>
  >([{ key: "", value: "" }])
  const [propertyComponentsDraft, setPropertyComponentsDraft] = useState<
    Array<{ erpVariantId: string; quantity: number }>
  >([{ erpVariantId: "", quantity: 1 }])
  const [propertySearchTerm, setPropertySearchTerm] = useState("")

  useEffect(() => {
    loadData()
    loadPropertyMappings()
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
    const existing = getMappingForShopifyVariant(
      shopifyVariant.shopifyVariantId
    )
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
        toast.success(result.message)
        await loadData()
      } else {
        toast.error(result.error || "Failed to delete mapping")
      }
    } catch (error) {
      toast.error("An error occurred while deleting")
      console.error(error)
    }
  }

  // Property mapping functions
  async function loadPropertyMappings() {
    try {
      const result = await getPropertyMappings()
      if (result.success) {
        setPropertyMappings(result.mappings as PropertyMapping[])
      }
    } catch (error) {
      console.error("Failed to load property mappings:", error)
    }
  }

  function openPropertyMappingDialog(shopifyVariant: ShopifyVariant) {
    setEditingPropertyVariant(shopifyVariant)
    setPropertyRulesDraft([{ key: "", value: "" }])
    setPropertyComponentsDraft([{ erpVariantId: "", quantity: 1 }])
    setPropertyDialogOpen(true)
  }

  function addPropertyRule() {
    setPropertyRulesDraft([...propertyRulesDraft, { key: "", value: "" }])
  }

  function removePropertyRule(index: number) {
    if (propertyRulesDraft.length > 1) {
      setPropertyRulesDraft(propertyRulesDraft.filter((_, i) => i !== index))
    }
  }

  function updatePropertyRule(
    index: number,
    field: "key" | "value",
    value: string
  ) {
    const updated = [...propertyRulesDraft]
    updated[index] = { ...updated[index], [field]: value }
    setPropertyRulesDraft(updated)
  }

  function addPropertyComponent() {
    setPropertyComponentsDraft([...propertyComponentsDraft, { erpVariantId: "", quantity: 1 }])
  }

  function removePropertyComponent(index: number) {
    setPropertyComponentsDraft(propertyComponentsDraft.filter((_, i) => i !== index))
  }

  function updatePropertyComponent(
    index: number,
    field: "erpVariantId" | "quantity",
    value: string | number
  ) {
    const updated = [...propertyComponentsDraft]
    updated[index] = { ...updated[index], [field]: value }
    setPropertyComponentsDraft(updated)
  }

  async function handleSavePropertyMapping() {
    if (!editingPropertyVariant) return

    // Validate: all rules must have key and value
    const invalidRules = propertyRulesDraft.filter((r) => !r.key || !r.value)
    if (invalidRules.length > 0) {
      toast.error("Please fill in all property rules (key and value)")
      return
    }

    // Validate: all components must have ERP variant selected
    const invalidComponents = propertyComponentsDraft.filter((c) => !c.erpVariantId)
    if (invalidComponents.length > 0) {
      toast.error("Please select an ERP product for all components")
      return
    }

    // Validate: at least one component
    if (propertyComponentsDraft.length === 0) {
      toast.error("Please add at least one component")
      return
    }

    setSaving(true)
    try {
      // Convert rules array to object
      const propertyRules = propertyRulesDraft.reduce((acc, rule) => {
        acc[rule.key] = rule.value
        return acc
      }, {} as Record<string, string>)

      const result = await createPropertyMapping({
        shopifyProductId: editingPropertyVariant.shopifyProductId,
        shopifyVariantId: editingPropertyVariant.shopifyVariantId,
        propertyRules,
        components: propertyComponentsDraft.map(c => ({
          erpVariantId: c.erpVariantId,
          quantity: c.quantity,
        })),
      })

      if (result.success) {
        toast.success(result.message)
        setPropertyDialogOpen(false)
        setEditingPropertyVariant(null)
        await loadPropertyMappings()
      } else {
        toast.error(result.error || "Failed to save property mapping")
      }
    } catch (error) {
      toast.error("An error occurred while saving")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePropertyMapping(mappingId: string) {
    try {
      // Get the mapping to find its property rules
      const mapping = propertyMappings.find(m => m.id === mappingId)
      if (!mapping) return

      // Delete all mappings with the same property rules (entire group)
      const sameMappings = propertyMappings.filter(
        m => JSON.stringify(m.propertyRules) === JSON.stringify(mapping.propertyRules) &&
             m.shopifyVariantId === mapping.shopifyVariantId
      )

      // Delete all of them
      await Promise.all(
        sameMappings.map(m => deletePropertyMapping(m.id))
      )

      toast.success("Property mapping group deleted successfully")
      await loadPropertyMappings()
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

        {/* Mapping Tabs */}
        <Tabs defaultValue="variant" className="flex-1">
          <TabsList>
            <TabsTrigger value="variant">
              <Box className="h-4 w-4" />
              Variant Mappings
            </TabsTrigger>
            <TabsTrigger value="property">
              <Settings2 className="h-4 w-4" />
              Property Mappings
            </TabsTrigger>
          </TabsList>

          {/* Variant Mapping Tab */}
          <TabsContent value="variant" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Variant-Based Mappings</CardTitle>
                <CardDescription>
                  Map fixed Shopify variants to ERP component sets (for
                  preconfigured products)
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
                                            {component.erpProductName ||
                                              "Unknown"}
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
          </TabsContent>

          {/* Property Mapping Tab */}
          <TabsContent value="property" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Property-Based Mappings</CardTitle>
                <CardDescription>
                  Map line item properties to ERP components (for customizable
                  products like custom ski poles)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex gap-2">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        How Property Mapping Works
                      </p>
                      <p className="text-sm text-muted-foreground">
                        For customizable products, customers choose components
                        via properties. Map property combinations (e.g.,
                        GRIPS="TÜRKIS") to ERP variants. When an order has
                        matching properties, the system deducts the correct
                        components.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-background rounded p-2 border">
                          <strong>Simple:</strong> {"{"}"GRIPS": "TÜRKIS"{"}"} →
                          Grip (Turquoise)
                        </div>
                        <div className="bg-background rounded p-2 border">
                          <strong>Combined:</strong> {"{"}"BASKET": "POWDER",
                          "BASKETS": "TÜRKIS"{"}"} → Basket (Powder/Turquoise)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search Shopify variants..."
                      value={propertySearchTerm}
                      onChange={(e) => setPropertySearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button onClick={() => loadPropertyMappings()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {/* Shopify Variants for Property Mapping */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shopify Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Property Mappings</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : shopifyVariants.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No Shopify variants found
                          </TableCell>
                        </TableRow>
                      ) : (
                        shopifyVariants
                          .filter((v) => {
                            if (!propertySearchTerm) return true
                            const searchLower = propertySearchTerm.toLowerCase()
                            return (
                              v.productTitle
                                .toLowerCase()
                                .includes(searchLower) ||
                              v.variantTitle
                                .toLowerCase()
                                .includes(searchLower) ||
                              v.shopifySku.toLowerCase().includes(searchLower)
                            )
                          })
                          .map((variant) => {
                            const variantMappings = propertyMappings.filter(
                              (m) =>
                                m.shopifyVariantId === variant.shopifyVariantId
                            )

                            // Group mappings by property rules
                            const groupedMappings = variantMappings.reduce((acc, mapping) => {
                              const key = JSON.stringify(mapping.propertyRules)
                              if (!acc[key]) {
                                acc[key] = {
                                  propertyRules: mapping.propertyRules,
                                  components: [],
                                }
                              }
                              acc[key].components.push({
                                id: mapping.id,
                                erpProductName: mapping.erpProductName,
                                quantity: mapping.quantity,
                              })
                              return acc
                            }, {} as Record<string, any>)

                            const mappingGroups = Object.values(groupedMappings)

                            return (
                              <TableRow key={variant.shopifyVariantId}>
                                <TableCell>
                                  <div className="font-medium">
                                    {variant.productTitle}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {variant.variantTitle}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ID: {variant.shopifyVariantId}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                    {variant.shopifySku}
                                  </code>
                                </TableCell>
                                <TableCell>
                                  {mappingGroups.length === 0 ? (
                                    <Badge variant="secondary">
                                      No mappings
                                    </Badge>
                                  ) : (
                                    <div className="space-y-3">
                                      {mappingGroups.map((group: any, groupIdx: number) => (
                                        <div
                                          key={groupIdx}
                                          className="border rounded p-2 space-y-1"
                                        >
                                          <div className="flex items-center gap-2 text-xs">
                                            <Badge
                                              variant="outline"
                                              className="font-mono"
                                            >
                                              {JSON.stringify(group.propertyRules)}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                              → {group.components.length} component(s)
                                            </span>
                                          </div>
                                          <div className="ml-4 space-y-1">
                                            {group.components.map((comp: any) => (
                                              <div
                                                key={comp.id}
                                                className="flex items-center gap-2 text-xs"
                                              >
                                                <Package className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">
                                                  {comp.erpProductName}
                                                </span>

                                                <span className="text-muted-foreground">
                                                  ×{comp.quantity}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex justify-end">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() =>
                                                handleDeletePropertyMapping(group.components[0].id)
                                              }
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openPropertyMappingDialog(variant)
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Rule
                                  </Button>
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
          </TabsContent>

          {/* Property Mapping Dialog */}
          <Dialog
            open={propertyDialogOpen}
            onOpenChange={setPropertyDialogOpen}
          >
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Create Property Mapping</DialogTitle>
                <DialogDescription>
                  {editingPropertyVariant && (
                    <>
                      Define property rules for{" "}
                      <strong>{editingPropertyVariant.productTitle}</strong> -{" "}
                      {editingPropertyVariant.variantTitle}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  {/* Property Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Property Rules
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPropertyRule}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Rule
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Define which line item properties must match. All rules
                      must match for this mapping to apply.
                    </p>

                    <div className="space-y-2">
                      {propertyRulesDraft.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <Input
                                placeholder="Property key (e.g., GRIPS)"
                                value={rule.key}
                                onChange={(e) =>
                                  updatePropertyRule(
                                    index,
                                    "key",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Property value (e.g., TÜRKIS)"
                                value={rule.value}
                                onChange={(e) =>
                                  updatePropertyRule(
                                    index,
                                    "value",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePropertyRule(index)}
                            disabled={propertyRulesDraft.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Preview */}
                    {propertyRulesDraft.some((r) => r.key && r.value) && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <p className="text-xs font-medium mb-1">
                          Rule Preview (JSON):
                        </p>
                        <code className="text-xs">
                          {JSON.stringify(
                            propertyRulesDraft
                              .filter((r) => r.key && r.value)
                              .reduce((acc, r) => {
                                acc[r.key] = r.value
                                return acc
                              }, {} as Record<string, string>),
                            null,
                            2
                          )}
                        </code>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* ERP Components Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        ERP Components
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPropertyComponent}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Component
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select which ERP variants to deduct when properties match (can be multiple for sets)
                    </p>

                    <div className="space-y-3">
                      {propertyComponentsDraft.map((component, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex gap-4 items-start">
                              <div className="flex-1 space-y-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`prop-erp-${index}`}>
                                    ERP Product (FINAL)
                                  </Label>
                                  <Select
                                    value={component.erpVariantId}
                                    onValueChange={(value) =>
                                      updatePropertyComponent(index, "erpVariantId", value)
                                    }
                                  >
                                    <SelectTrigger id={`prop-erp-${index}`}>
                                      <SelectValue placeholder="Select ERP product..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <ScrollArea className="h-[200px]">
                                        {erpVariants
                                          .filter(
                                            (variant) =>
                                              variant.variantId || variant.productId
                                          )
                                          .map((variant) => (
                                            <SelectItem
                                              key={variant.variantId || variant.productId}
                                              value={variant.variantId || variant.productId}
                                            >
                                              {variant.variantDisplay && `${variant.variantDisplay}`}
                                              {variant.variantSku && (
                                                <span className="text-muted-foreground ml-2">
                                                  ({variant.variantSku})
                                                </span>
                                              )}
                                            </SelectItem>
                                          ))}
                                      </ScrollArea>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                  <div className="space-y-2">
                                    <Label htmlFor={`prop-qty-${index}`}>Quantity</Label>
                                    <Input
                                      id={`prop-qty-${index}`}
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={component.quantity}
                                      onChange={(e) =>
                                        updatePropertyComponent(
                                          index,
                                          "quantity",
                                          parseInt(e.target.value) || 1
                                        )
                                      }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Usually 1 or 2 for pairs
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {propertyComponentsDraft.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePropertyComponent(index)}
                                  className="mt-8"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPropertyDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSavePropertyMapping} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Mapping"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Tabs>
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
                              {erpVariants
                                .filter(
                                  (erpVariant) =>
                                    erpVariant.variantId || erpVariant.productId
                                )
                                .map((erpVariant) => (
                                  <SelectItem
                                    key={
                                      erpVariant.variantId ||
                                      erpVariant.productId
                                    }
                                    value={
                                      erpVariant.variantId ||
                                      erpVariant.productId
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
