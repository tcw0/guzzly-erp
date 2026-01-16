import {
  Brush,
  Columns3,
  Home,
  Printer,
  ShoppingBasket,
  SquarePlus,
  Store,
  LinkIcon,
  Package,
  Webhook,
  Settings,
  Bug,
  Boxes,
} from "lucide-react"

export const sidebarLinks = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Create",
    url: "/create",
    icon: SquarePlus,
  },
  {
    title: "Purchase",
    url: "/purchase",
    icon: ShoppingBasket,
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Columns3,
  },
  {
    title: "BOM Overview",
    url: "/bom",
    icon: Boxes,
  },
]

export const shopifySidebarLinks = [
  {
    title: "SKU Mapping",
    url: "/shopify/mapping",
    icon: LinkIcon,
  },
  {
    title: "Orders",
    url: "/shopify/orders",
    icon: Package,
  },
  {
    title: "Webhooks",
    url: "/shopify/webhooks",
    icon: Webhook,
  },
  {
    title: "Settings",
    url: "/shopify/settings",
    icon: Settings,
  },
  {
    title: "Debug",
    url: "/shopify/debug",
    icon: Bug,
  },
]
