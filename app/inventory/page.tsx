import { HierarchicalInventoryTable } from "@/components/HierarchicalInventoryTable"
import { getInventory } from "@/server/inventory"

export default async function Inventory() {
  const { data: all = [] } = await getInventory()
  const raw = all.filter((p) => p.type === "RAW")
  const intermediate = all.filter((p) => p.type === "INTERMEDIATE")
  const final = all.filter((p) => p.type === "FINAL")

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        </div>

        <HierarchicalInventoryTable title="Raw Materials" data={raw} />
        <HierarchicalInventoryTable title="Intermediate Products" data={intermediate} />
        <HierarchicalInventoryTable title="Final Products" data={final} />
      </div>
    </section>
  )
}
