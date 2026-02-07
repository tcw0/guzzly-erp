"use client"

import { useEffect, useState, useTransition } from "react"
import {
  runInventoryAudit,
  type AuditResult,
  type ShopifyMappingAuditRow,
  type BomAuditRow,
} from "@/server/audit"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, AlertTriangle, CheckCircle, Info } from "lucide-react"

function StatusBadge({ status }: { status: "ok" | "mismatch" | "warning" }) {
  if (status === "mismatch")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Mismatch
      </Badge>
    )
  if (status === "warning")
    return (
      <Badge variant="secondary" className="gap-1">
        <Info className="h-3 w-3" /> Warnung
      </Badge>
    )
  return (
    <Badge className="gap-1 bg-green-600 hover:bg-green-700">
      <CheckCircle className="h-3 w-3" /> OK
    </Badge>
  )
}

type FilterMode = "all" | "mismatch" | "warning" | "ok"

export default function AuditPage() {
  const [data, setData] = useState<AuditResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [shopifyFilter, setShopifyFilter] = useState<FilterMode>("all")
  const [propFilter, setPropFilter] = useState<FilterMode>("all")
  const [bomFilter, setBomFilter] = useState<FilterMode>("all")

  const load = () => {
    startTransition(async () => {
      const result = await runInventoryAudit()
      setData(result)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filterRows = <T extends { status: "ok" | "mismatch" | "warning" }>(
    rows: T[],
    mode: FilterMode
  ): T[] => {
    if (mode === "all") return rows
    return rows.filter((r) => r.status === mode)
  }

  const countByStatus = (
    rows: Array<{ status: "ok" | "mismatch" | "warning" }>
  ) => ({
    ok: rows.filter((r) => r.status === "ok").length,
    mismatch: rows.filter((r) => r.status === "mismatch").length,
    warning: rows.filter((r) => r.status === "warning").length,
    total: rows.length,
  })

  const FilterButtons = ({
    filter,
    setFilter,
    counts,
  }: {
    filter: FilterMode
    setFilter: (f: FilterMode) => void
    counts: { ok: number; mismatch: number; warning: number; total: number }
  }) => (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant={filter === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => setFilter("all")}
      >
        Alle ({counts.total})
      </Button>
      <Button
        variant={filter === "mismatch" ? "destructive" : "outline"}
        size="sm"
        onClick={() => setFilter("mismatch")}
      >
        Mismatches ({counts.mismatch})
      </Button>
      <Button
        variant={filter === "warning" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setFilter("warning")}
      >
        Warnungen ({counts.warning})
      </Button>
      <Button
        variant={filter === "ok" ? "default" : "outline"}
        size="sm"
        onClick={() => setFilter("ok")}
      >
        OK ({counts.ok})
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Audit</h1>
          <p className="text-muted-foreground">
            Prüfe Shopify-Mappings und BOM auf Farb-Mismatches und Inkonsistenzen
          </p>
        </div>
        <Button onClick={load} disabled={isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Prüfe…" : "Audit starten"}
        </Button>
      </div>

      {data && !data.success && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">{data.message}</p>
          </CardContent>
        </Card>
      )}

      {data && data.success && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Shopify Variant Mappings</CardDescription>
                <CardTitle className="text-lg">
                  {data.shopifyMappings.length} Einträge
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {countByStatus(data.shopifyMappings).mismatch} Mismatches,{" "}
                {countByStatus(data.shopifyMappings).warning} Warnungen
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Shopify Property Mappings</CardDescription>
                <CardTitle className="text-lg">
                  {data.propertyMappings.length} Einträge
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {countByStatus(data.propertyMappings).mismatch} Mismatches,{" "}
                {countByStatus(data.propertyMappings).warning} Warnungen
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>BOM-Einträge</CardDescription>
                <CardTitle className="text-lg">
                  {data.bomEntries.length} Einträge
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {countByStatus(data.bomEntries).mismatch} Mismatches,{" "}
                {countByStatus(data.bomEntries).warning} Warnungen
              </CardContent>
            </Card>
          </div>

          {/* Shopify Variant Mappings */}
          <Card>
            <CardHeader>
              <CardTitle>Shopify Variant Mappings</CardTitle>
              <CardDescription>
                Prüft ob die Farbe der Shopify-Variante zur ERP-Variante passt
              </CardDescription>
              <FilterButtons
                filter={shopifyFilter}
                setFilter={setShopifyFilter}
                counts={countByStatus(data.shopifyMappings)}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Shopify Produkt</TableHead>
                      <TableHead>Shopify Variante</TableHead>
                      <TableHead>ERP Produkt</TableHead>
                      <TableHead>ERP SKU</TableHead>
                      <TableHead>ERP Optionen</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead>Hinweis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRows(data.shopifyMappings, shopifyFilter).length ===
                      0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Keine Einträge
                        </TableCell>
                      </TableRow>
                    )}
                    {filterRows(data.shopifyMappings, shopifyFilter).map(
                      (row) => (
                        <TableRow
                          key={row.mappingId}
                          className={
                            row.status === "mismatch"
                              ? "bg-destructive/5"
                              : row.status === "warning"
                                ? "bg-yellow-50 dark:bg-yellow-950/10"
                                : ""
                          }
                        >
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.shopifyProductTitle ?? "–"}
                          </TableCell>
                          <TableCell>{row.shopifyVariantTitle ?? "–"}</TableCell>
                          <TableCell>{row.erpProductName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.erpSku}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.erpVariantSelections}
                          </TableCell>
                          <TableCell>{row.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                            {row.note}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Shopify Property Mappings */}
          <Card>
            <CardHeader>
              <CardTitle>Shopify Property Mappings</CardTitle>
              <CardDescription>
                Prüft ob die Property-Rules zur ERP-Variante passen
              </CardDescription>
              <FilterButtons
                filter={propFilter}
                setFilter={setPropFilter}
                counts={countByStatus(data.propertyMappings)}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Shopify Produkt</TableHead>
                      <TableHead>Property Rules</TableHead>
                      <TableHead>ERP Produkt</TableHead>
                      <TableHead>ERP SKU</TableHead>
                      <TableHead>ERP Optionen</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead>Hinweis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRows(data.propertyMappings, propFilter).length ===
                      0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Keine Einträge
                        </TableCell>
                      </TableRow>
                    )}
                    {filterRows(data.propertyMappings, propFilter).map(
                      (row) => (
                        <TableRow
                          key={row.mappingId}
                          className={
                            row.status === "mismatch"
                              ? "bg-destructive/5"
                              : row.status === "warning"
                                ? "bg-yellow-50 dark:bg-yellow-950/10"
                                : ""
                          }
                        >
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.shopifyProductTitle ?? "–"}
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[200px] break-all">
                            {row.shopifyVariantTitle}
                          </TableCell>
                          <TableCell>{row.erpProductName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.erpSku}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.erpVariantSelections}
                          </TableCell>
                          <TableCell>{row.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                            {row.note}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* BOM Audit */}
          <Card>
            <CardHeader>
              <CardTitle>Bill of Materials Audit</CardTitle>
              <CardDescription>
                Prüft ob Produkt- und Komponenten-Farbe in der BOM übereinstimmen
              </CardDescription>
              <FilterButtons
                filter={bomFilter}
                setFilter={setBomFilter}
                counts={countByStatus(data.bomEntries)}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Produkt SKU</TableHead>
                      <TableHead>Produkt Optionen</TableHead>
                      <TableHead>Komponente</TableHead>
                      <TableHead>Komponente SKU</TableHead>
                      <TableHead>Komponente Optionen</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead>Hinweis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRows(data.bomEntries, bomFilter).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Keine Einträge
                        </TableCell>
                      </TableRow>
                    )}
                    {filterRows(data.bomEntries, bomFilter).map((row) => (
                      <TableRow
                        key={row.bomId}
                        className={
                          row.status === "mismatch"
                            ? "bg-destructive/5"
                            : row.status === "warning"
                              ? "bg-yellow-50 dark:bg-yellow-950/10"
                              : ""
                        }
                      >
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.productName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.productSku}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.productSelections}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.componentName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.componentSku}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.componentSelections}
                        </TableCell>
                        <TableCell>{row.quantityRequired}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                          {row.note}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isPending && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Audit läuft…</span>
        </div>
      )}
    </div>
  )
}
