"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/components/ui/sidebar"
import { Home, Columns3, Package, Grid3X3, Menu } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { title: "Home", url: "/", icon: Home },
  { title: "Inventory", url: "/inventory", icon: Columns3 },
  { title: "Matrix", url: "/pole-matrix", icon: Grid3X3 },
  { title: "Orders", url: "/shopify/orders", icon: Package },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate max-w-[4rem]">{item.title}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 text-xs transition-colors text-muted-foreground hover:text-foreground"
          )}
          aria-label="Weitere Menüpunkte öffnen"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="truncate max-w-[4rem]">Others</span>
        </button>
      </div>
    </nav>
  )
}
