"use client"

import Image from "next/image"
import { sidebarLinks } from "@/constants"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center py-4">
        <Image src="/icons/logo.svg" alt="logo" height={60} width={60} />
      </SidebarHeader>
      <SidebarContent>
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
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
