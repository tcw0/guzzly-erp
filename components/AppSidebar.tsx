"use client"

import Image from "next/image"
import { sidebarLinks, shopifySidebarLinks } from "@/constants"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Store } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="flex w-full items-center justify-center py-4 px-2">
        {/* Logo: public/icons/logo.svg – skaliert auf Sidebar-Breite minus 8px links/rechts, Seitenverhältnis bleibt erhalten */}
        <Image
          src="/icons/logo.svg"
          alt="logo"
          width={322}
          height={208}
          className="w-full h-auto max-w-full"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarLinks.map((link) => {
                const isActive = pathname === link.url
                return (
                  <SidebarMenuItem key={link.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="min-h-12"
                    >
                      <Link
                        href={link.url}
                        className="flex items-center gap-6 flex-1 h-full  ps-4"
                      >
                        <link.icon className="scale-150" />
                        <span className="text-lg font-medium">{link.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-sm font-semibold px-4 py-2">
            <Store className="h-4 w-4" />
            Shopify
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shopifySidebarLinks.map((link) => {
                const isActive = pathname === link.url
                return (
                  <SidebarMenuItem key={link.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="min-h-10"
                    >
                      <Link
                        href={link.url}
                        className="flex items-center gap-4 flex-1 h-full ps-4"
                      >
                        <link.icon className="h-4 w-4" />
                        <span className="text-base">{link.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
