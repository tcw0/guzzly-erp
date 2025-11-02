"use client"

import Image from "next/image"
import { sidebarLinks } from "@/constants"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        <Image src="/icons/logo.svg" alt="logo" height={60} width={60} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {sidebarLinks.map((link) => (
            // const isSelected =
            //   (link.route !== "/admin" &&
            //     pathname.includes(link.route) &&
            //     link.route.length > 1) ||
            //   pathname === link.route

            <SidebarMenuItem key={link.title}>
              <SidebarMenuButton asChild>
                <a href={link.url}>
                  <link.icon />
                  <span>{link.title}</span>
                </a>
              </SidebarMenuButton>
              <SidebarMenuAction className="peer-data-[active=true]/menu-button:opacity-100" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
