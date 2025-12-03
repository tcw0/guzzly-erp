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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  fetchShopifyProducts,
  getERPFinalProducts,
  getExistingMappings,
  createVariantMapping,
  deleteVariantMapping,
  getMappingStats,
} from "@/server/shopify-sync"
import { Loader2, RefreshCw, CheckCircle, XCircle, Search } from "lucide-react"

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

interface Mapping {
  id: string
  shopifyVariantId: string
  productVariantId: string
  erpProductName: string | null
  erpVariantSku: string | null
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

  // Track temporary selections (before saving)
  const [selections, setSelections] = useState<Record<string, string>>({})

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
        // Initialize selections with existing mappings
        const initialSelections: Record<string, string> = {}
        mappingsResult.mappings.forEach((m: Mapping) => {
          initialSelections[m.shopifyVariantId] = m.productVariantId
        })
        setSelections(initialSelections)
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

  async function handleSaveMapping(shopifyVariant: ShopifyVariant) {
    const erpVariantId = selections[shopifyVariant.shopifyVariantId]
    if (!erpVariantId) {
      toast.error("Please select an ERP product first")
      return
    }

    try {
      const result = await createVariantMapping({
        shopifyProductId: shopifyVariant.shopifyProductId,
        shopifyVariantId: shopifyVariant.shopifyVariantId,
        erpVariantId,
      })

      if (result.success) {
        toast.success(result.message)
        await loadData() // Reload to update stats
      } else {
        toast.error(result.error || "Failed to save mapping")
      }
    } catch (error) {
      toast.error("An error occurred while saving")
      console.error(error)
    }
  }

  async function handleDeleteMapping(
    mappingId: string,
    shopifyVariantId: string
  ) {
    try {
      const result = await deleteVariantMapping(mappingId)
      if (result.success) {
        toast.success("Mapping deleted")
        // Remove from local state
        setSelections((prev) => {
          const updated = { ...prev }
          delete updated[shopifyVariantId]
          return updated
        })
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
                    <TableHead>ERP Product (FINAL)</TableHead>
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
                      const hasUnsavedChanges =
                        selections[shopifyVariant.shopifyVariantId] !==
                        existingMapping?.productVariantId

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
                            <Select
                              value={
                                selections[shopifyVariant.shopifyVariantId] ||
                                ""
                              }
                              onValueChange={(value) => {
                                setSelections((prev) => ({
                                  ...prev,
                                  [shopifyVariant.shopifyVariantId]: value,
                                }))
                              }}
                            >
                              <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Select ERP product..." />
                              </SelectTrigger>
                              <SelectContent>
                                {erpVariants.map((erpVariant) => (
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
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!isMapped || hasUnsavedChanges ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleSaveMapping(shopifyVariant)
                                  }
                                  disabled={
                                    !selections[shopifyVariant.shopifyVariantId]
                                  }
                                >
                                  Save
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleDeleteMapping(
                                      existingMapping.id,
                                      shopifyVariant.shopifyVariantId
                                    )
                                  }
                                >
                                  Remove
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
    </section>
  )
}
