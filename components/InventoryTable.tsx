import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type InventoryRow = {
  id: string
  name: string
  unit: string
  type: "RAW" | "INTERMEDIATE" | "FINAL"
  quantityOnHand: string
}

export function InventoryTable({
  title,
  data,
}: {
  title: string
  data: InventoryRow[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="max-h-[50vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Quantity on Hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {Number.parseFloat(item.quantityOnHand).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableCaption>Total: {data.length}</TableCaption>
        </Table>
      </div>
    </div>
  )
}
