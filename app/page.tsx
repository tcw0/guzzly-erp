import AdjustmentForm from "@/components/forms/AdjustmentForm"
import OutputForm from "@/components/forms/OutputForm"
import { HistoryTable } from "@/components/HistoryTable"
import { getOutputAndAdjustmentHistory } from "@/server/history"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default async function Home() {
  const { data: historyEntries = [] } = await getOutputAndAdjustmentHistory()

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="grid h-full w-full grid-cols-2 gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-[50vh] w-full text-xl font-bold bg-cyan-900 hover:bg-cyan-950">
              Add Output
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 shrink-0">
              <DialogTitle>Add Output</DialogTitle>
            </DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[75vh] overflow-auto">
              <OutputForm />
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-[50vh] w-full text-xl font-bold bg-red-900 hover:bg-red-950">
              Make Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 shrink-0">
              <DialogTitle>Make Adjustment</DialogTitle>
            </DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[75vh] overflow-auto">
              <AdjustmentForm />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">History</h2>
        <HistoryTable entries={historyEntries} />
      </div>
    </section>
  )
}
