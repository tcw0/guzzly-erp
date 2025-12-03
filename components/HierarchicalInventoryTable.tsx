"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

type InventoryRow = {
  id: string
  productId: string
  productName: string
  unit: string
  type: "RAW" | "INTERMEDIATE" | "FINAL"
  sku: string
  quantityOnHand: string
  minimumStockLevel: string
  needsReorder: boolean
  variantSelections: Array<{
    variationName: string
    optionValue: string
  }>
}

type GroupedProduct = {
  productId: string
  productName: string
  unit: string
  variants: InventoryRow[]
  totalQuantity: number
  worstStatus: "critical" | "warning" | "good"
  variationNames: string[] // e.g., ["Color", "Size"]
}

function groupByProduct(data: InventoryRow[]): GroupedProduct[] {
  const grouped = new Map<string, GroupedProduct>()

  for (const item of data) {
    if (!grouped.has(item.productId)) {
      // Extract unique variation names from first variant
      const variationNames = Array.from(
        new Set(item.variantSelections.map((v) => v.variationName))
      )

      grouped.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        variants: [],
        totalQuantity: 0,
        worstStatus: "good",
        variationNames,
      })
    }

    const product = grouped.get(item.productId)!
    product.variants.push(item)
    product.totalQuantity += Number.parseFloat(item.quantityOnHand)

    // Determine variant status
    const quantity = Number.parseFloat(item.quantityOnHand)
    const minimum = Number.parseFloat(item.minimumStockLevel)
    let status: "critical" | "warning" | "good" = "good"

    if (quantity <= minimum) {
      status = "critical"
    } else if (quantity <= minimum * 1.1) {
      status = "warning"
    }

    // Update worst status
    if (status === "critical") {
      product.worstStatus = "critical"
    } else if (status === "warning" && product.worstStatus !== "critical") {
      product.worstStatus = "warning"
    }
  }

  return Array.from(grouped.values())
}

function getVariantStatus(
  quantityOnHand: string,
  minimumStockLevel: string
): "critical" | "warning" | "good" {
  const quantity = Number.parseFloat(quantityOnHand)
  const minimum = Number.parseFloat(minimumStockLevel)

  if (quantity <= minimum) {
    return "critical"
  } else if (quantity <= minimum * 1.5) {
    return "warning"
  }
  return "good"
}

function getStatusColor(status: "critical" | "warning" | "good"): string {
  switch (status) {
    case "critical":
      return "bg-red-100 hover:bg-red-100"
    case "warning":
      return "bg-yellow-100 hover:bg-yellow-100"
    case "good":
      return "bg-green-100 hover:bg-green-100"
  }
}

function formatVariantLabel(
  variantSelections: Array<{ variationName: string; optionValue: string }>
): string {
  if (variantSelections.length === 0) return "Default"
  return variantSelections.map((v) => v.optionValue).join(" / ")
}

export function HierarchicalInventoryTable({
  title,
  data,
}: {
  title: string
  data: InventoryRow[]
}) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  )

  const groupedData = groupByProduct(data)

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="max-h-[50vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Min. Stock</TableHead>
              <TableHead className="text-right">Quantity on Hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              groupedData.map((product) => {
                const isExpanded = expandedProducts.has(product.productId)
                const hasMultipleVariants = product.variants.length > 1

                return (
                  <>
                    {/* Product Summary Row */}
                    <TableRow
                      key={product.productId}
                      className={`cursor-pointer font-medium ${getStatusColor(
                        product.worstStatus
                      )}`}
                      onClick={() => toggleProduct(product.productId)}
                    >
                      <TableCell>
                        {hasMultipleVariants && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleProduct(product.productId)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{product.productName}</span>
                          {product.variationNames.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.variationNames.join(", ")}
                              {hasMultipleVariants && ` • ${product.variants.length} variants`}
                            </span>
                          )}
                          {product.variationNames.length === 0 && hasMultipleVariants && (
                            <span className="text-xs text-muted-foreground">
                              {product.variants.length} variants
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {hasMultipleVariants ? "Multiple" : product.variants[0]?.sku}
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">
                        {product.totalQuantity}
                      </TableCell>
                    </TableRow>

                    {/* Variant Detail Rows */}
                    {isExpanded &&
                      product.variants.map((variant) => {
                        const status = getVariantStatus(
                          variant.quantityOnHand,
                          variant.minimumStockLevel
                        )
                        return (
                          <TableRow
                            key={variant.id}
                            className={`text-sm ${getStatusColor(status)}`}
                          >
                            <TableCell></TableCell>
                            <TableCell className="pl-8">
                              {formatVariantLabel(variant.variantSelections)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {variant.sku}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {product.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number.parseInt(
                                variant.minimumStockLevel
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number.parseInt(
                                variant.quantityOnHand
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </>
                )
              })
            )}
          </TableBody>
          <TableCaption>Total: {groupedData.length} products</TableCaption>
        </Table>
      </div>
    </div>
  )
}
