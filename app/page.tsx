import AdjustmentForm from "@/components/forms/AdjustmentForm"
import OutputForm from "@/components/forms/OutputForm"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function Home() {
  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="grid h-full w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold bg-cyan-900 hover:bg-cyan-950">
              Add Output
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Add Output</DialogTitle>
            </DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[80vh]">
              <OutputForm />
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold bg-red-900 hover:bg-red-950">
              Make Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make Adjustment</DialogTitle>
              <AdjustmentForm />
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
