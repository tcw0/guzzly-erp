# Guzzly ERP – Architektur & Infrastruktur-Übersicht

Dieses Dokument fasst den Aufbau der Webapp, Datenbank, Serverlogik und Integrationen zusammen. Es dient als zentraler Einstieg, um schnell zu wissen, **wo was abliegt**.  
**Hinweis:** Wenn eine Information hier nicht steht oder nicht ausreicht, in den weiteren Projekt-Dokumenten suchen (z. B. `SHOPIFY_SETUP.md`, `SHOPIFY_DEBUG_GUIDE.md`, `WEBHOOK_VERIFICATION.md`, `README.md`).

---

## 1. Tech-Stack & Konfiguration

| Bereich | Technologie |
|--------|-------------|
| Framework | **Next.js 16** (App Router) |
| UI | React 19, Tailwind CSS 4, Radix UI (shadcn/ui), Lucide Icons |
| Datenbank | **PostgreSQL** (z. B. Neon), Zugriff über **Drizzle ORM** |
| DB-Client | `@neondatabase/serverless` (Pool), `drizzle-orm` |
| Validierung | **Zod** (Formulare & API) |
| Forms | React Hook Form, `@hookform/resolvers` |
| Package Manager | pnpm |

- **Konfiguration:** `next.config.ts`, `tsconfig.json` (Path-Alias `@/*` → Projektroot), `drizzle.config.ts` (Schema: `./db/schema.ts`, Migrations: `./migrations`).
- **Umgebung:** `DATABASE_URL` (DB), Shopify: `SHOPIFY_STORE_URL`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, optional `SHOPIFY_API_VERSION` (siehe `SHOPIFY_SETUP.md`).

---

## 2. Projektstruktur (Wo was liegt)

```
guzzly-erp/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root-Layout (Sidebar, Toaster, Fonts)
│   ├── page.tsx            # Home (Output + Adjustment Dialoge)
│   ├── globals.css
│   ├── create/             # Produkte anlegen (CreateContent + ProductForm)
│   ├── purchase/           # Einkauf erfassen
│   ├── inventory/         # Bestandsübersicht (nach RAW/INTERMEDIATE/FINAL)
│   ├── bom/                # Stücklisten-Übersicht (BOM)
│   ├── shopify/            # Shopify-UI: mapping, orders, webhooks, settings, debug
│   └── api/
│       └── shopify/        # Webhook + Debug-API (orders-fulfilled, process-order)
├── components/
│   ├── AppSidebar.tsx      # Navigation (constants: sidebarLinks, shopifySidebarLinks)
│   ├── forms/              # ProductForm, PurchaseForm, OutputForm, AdjustmentForm, MaterialForm
│   ├── HierarchicalInventoryTable.tsx, InventoryTable.tsx
│   └── ui/                 # shadcn/ui (button, card, dialog, form, table, …)
├── constants/
│   ├── index.ts            # sidebarLinks, shopifySidebarLinks (Icons + URLs)
│   ├── product-types.ts    # PRODUCT_TYPES: RAW, INTERMEDIATE, FINAL
│   ├── inventory-actions.ts # PURCHASE, OUTPUT, CONSUMPTION, ADJUSTMENT, SALE
│   └── colors.ts
├── db/
│   ├── schema.ts           # Alle Tabellen + exportierte Typen
│   └── drizzle.ts         # DB-Client (Pool + drizzle mit snake_case)
├── lib/
│   ├── config.ts           # databaseUrl aus process.env
│   ├── shopify.ts          # Shopify-Config, verifyWebhook, shopifyAdminAPI, RateLimiter
│   ├── validation.ts       # Zod-Schemas (Product, Output, Purchase, Adjustment, Shopify-Mapping)
│   └── utils.ts
├── server/                 # Server Actions & reine Server-Logik („use server“)
│   ├── product.ts          # CRUD Produkte, Varianten, BOM beim Anlegen
│   ├── inventory.ts       # getInventory (Bestand pro Variante)
│   ├── bom.ts             # getProductComponentRelations (BOM-Struktur)
│   ├── purchase.ts        # createPurchase, getPurchases
│   ├── adjustment.ts      # createAdjustment, getAdjustments
│   ├── output.ts          # createOutput (Produktion + BOM-Verbrauch)
│   ├── shopify-config.ts  # isShopifyIntegrationActive, getShopifyConfigStatus
│   ├── shopify-webhooks.ts # Webhook anlegen/löschen/listen, testShopifyConnection
│   ├── shopify-orders.ts  # processShopifyOrder, fetchShopifyOrdersLive, Annotations, …
│   ├── shopify-sync.ts    # Mapping: fetchShopifyProducts, getERPFinalProducts, create/delete Mapping, Property-Mappings, bulkCopy
│   └── shopify-bulk-import.ts # bulkImportFulfilledOrders (Debug)
├── drizzle.config.ts
├── package.json
└── (Dokumentation: README.md, SHOPIFY_SETUP.md, SHOPIFY_DEBUG_GUIDE.md, WEBHOOK_VERIFICATION.md)
```

---

## 3. Datenbank

- **Schema-Definition:** `db/schema.ts` (Drizzle, PostgreSQL).
- **Zugriff:** Ein zentraler Client in `db/drizzle.ts`: `import { db } from "@/db/drizzle"`. Verwendung in allen `server/*`-Modulen.
- **Migrations:** Drizzle Kit, Ausgabe in `./migrations` (Config in `drizzle.config.ts`). Bei fehlenden oder unklaren Migrationen in der Doku oder in `db/schema.ts` nachsehen.

### Tabellen (Kurzüberblick)

| Tabelle | Zweck |
|---------|--------|
| `products` | Produktstamm (name, type, unit). Typ: RAW \| INTERMEDIATE \| FINAL. |
| `product_variations` | Variationen pro Produkt (z. B. Farbe, Größe). |
| `product_variation_options` | Optionen pro Variation (z. B. Rot, Blau). |
| `product_variants` | Konkrete Varianten (SKU, minimum_stock_level), 1:1 mit Bestand. |
| `product_variant_selections` | Verknüpfung Variant ↔ Variation-Option (für SKU-Kombinationen). |
| `inventory` | Bestand pro Variante (variant_id, quantity_on_hand); unique auf variant_id. |
| `inventory_movements` | Bewegungen (product_id, variant_id, quantity, action, reason, created_at). |
| `variant_bill_of_materials` | Stückliste pro Variante: product_variant_id → component_variant_id + quantity_required. |
| `shopify_variant_mappings` | Shopify-Variante → ERP-Varianten + Menge (Komponenten-Mapping). |
| `shopify_property_mappings` | Property-basiertes Mapping (z. B. Line-Item-Properties → ERP-Varianten). |
| `shopify_orders` | Erfasste Shopify-Bestellungen (für Abgleich/Audit). |
| `shopify_order_items` | Positionen pro Bestellung inkl. Mapping-Status. |
| `shopify_webhook_logs` | Webhook-Audit (topic, status, payload). |
| `shopify_order_annotations` | Manuelle Anreicherung (Kundenname, Notizen). |
| `shopify_variant_history` | Varianten-ID-Wechsel (old_variant_id → new_variant_id) für historische Orders. |

Typen werden aus dem Schema exportiert (z. B. `Product`, `ProductVariant`, `ShopifyOrder`). Details und Relationen siehe `db/schema.ts`.

---

## 4. Webapp-Aufbau

- **Routing:** App Router unter `app/`. Layout mit Sidebar (`AppSidebar`) und Toaster; Seiten rendern `children`.
- **Navigation:** Links aus `constants/index.ts`: `sidebarLinks` (Home, Create, Purchase, Inventory, BOM), `shopifySidebarLinks` (SKU Mapping, Orders, Webhooks, Settings, Debug).
- **Datenfluss:**
  - **Seiten** (Server Components) laden Daten per **Server Actions** aus `server/*` (z. B. `getInventory()`, `getProducts()`, `getProductComponentRelations()`).
  - **Formulare** (Client Components unter `components/forms/`) rufen ebenfalls Server Actions auf (z. B. `createProduct`, `createPurchase`, `createOutput`, `createAdjustment`).
- **Wichtige Seiten:**
  - `app/page.tsx`: Home mit Dialogen „Add Output“ und „Make Adjustment“.
  - `app/create/page.tsx`: Lädt Produkte, rendert `CreateContent` (Produkt anlegen/bearbeiten).
  - `app/inventory/page.tsx`: Filtert Bestand nach RAW / INTERMEDIATE / FINAL, zeigt `HierarchicalInventoryTable`.
  - `app/bom/page.tsx`: BOM-Daten von `getProductComponentRelations()`.
  - `app/purchase/page.tsx`: Einkäufe (getPurchases) + PurchaseForm.
  - `app/shopify/*`: Mapping, Orders, Webhooks, Settings, Debug – nutzen jeweils passende `server/shopify-*.ts`-Funktionen.

---

## 5. API-Routen

- **POST** `/api/shopify/webhooks/orders-fulfilled`  
  - Webhook von Shopify (orders/fulfilled). HMAC-Prüfung via `lib/shopify.ts`, Log in `shopify_webhook_logs`, Verarbeitung via `processShopifyOrder` aus `server/shopify-orders.ts`.
- **GET** gleicher Pfad: Health-Check (keine Verarbeitung).
- **POST** `/api/shopify/debug/process-order`: Manuelles Auslösen der Order-Verarbeitung (Debug), nutzt ebenfalls `processShopifyOrder`.

Weitere API-Details (z. B. Webhook-Setup, Verifikation) siehe `WEBHOOK_VERIFICATION.md` und `SHOPIFY_DEBUG_GUIDE.md`.

---

## 6. Shopify-Integration

- **Config & API:** `lib/shopify.ts` (storeUrl, accessToken, webhookSecret, apiVersion), `verifyShopifyWebhook()`, `shopifyAdminAPI()`, `ShopifyRateLimiter`.
- **Server-Module:**
  - `server/shopify-config.ts`: Konfigurationsstatus.
  - `server/shopify-webhooks.ts`: Webhook erstellen/löschen/listen, Connection-Test.
  - `server/shopify-orders.ts`: Order-Verarbeitung (Fulfillment → Bestandsabzug über Mappings), Live-Orders, Annotations.
  - `server/shopify-sync.ts`: Produkte von Shopify, ERP-Final-Produkte, Variant- und Property-Mappings, Bulk-Copy.
  - `server/shopify-bulk-import.ts`: Bulk-Import erfüllter Orders (Debug).
- **Mapping:** Shopify-Varianten werden über `shopify_variant_mappings` und `shopify_property_mappings` ERP-Varianten zugeordnet; Verbrauch bei Fulfillment über `inventory_movements` und `inventory` (SALE/Verbrauch). Details zu Setup und Webhooks: `SHOPIFY_SETUP.md`, `SHOPIFY_DEBUG_GUIDE.md`.

---

## 7. Konstanten & Validierung

- **Produkttypen:** `constants/product-types.ts` – `PRODUCT_TYPES` (RAW, INTERMEDIATE, FINAL), `productTypeEnum` (Zod).
- **Lageraktionen:** `constants/inventory-actions.ts` – `INVENTORY_ACTIONS` (PURCHASE, OUTPUT, CONSUMPTION, ADJUSTMENT, SALE), `inventoryActionEnum`.
- **Navigation:** `constants/index.ts` – Sidebar-Links inkl. Icons.
- **Formulare & API:** `lib/validation.ts` – Zod-Schemas für Produkt, Output, Purchase, Adjustment, Shopify-Mapping; exportierte Typen (z. B. `ProductParams`, `OutputParams`, `PurchaseParams`, `AdjustmentParams`, `ShopifyMappingFormValues`).

---

## 8. Kurz-Referenz: Server Actions → Nutzung

| Aktion / Daten | Server-Modul | Typische Aufrufer |
|----------------|--------------|--------------------|
| Produkte lesen/anlegen/aktualisieren, Varianten, BOM | `server/product.ts` | Create-Seite, ProductForm, OutputForm, AdjustmentForm, PurchaseForm |
| Bestand abfragen | `server/inventory.ts` | `app/inventory/page.tsx` |
| BOM-Struktur | `server/bom.ts` | `app/bom/page.tsx` |
| Einkauf | `server/purchase.ts` | PurchaseForm, `app/purchase/page.tsx` |
| Produktion (Output + BOM-Verbrauch) | `server/output.ts` | OutputForm |
| Bestandsanpassung | `server/adjustment.ts` | AdjustmentForm |
| Shopify Config/Webhooks/Connection | `server/shopify-config.ts`, `server/shopify-webhooks.ts` | Shopify Settings/Webhooks-Seiten |
| Shopify Orders verarbeiten & anzeigen | `server/shopify-orders.ts` | Webhook-Route, Debug-Route, Orders-Seite |
| Shopify Mapping (Variant/Property) | `server/shopify-sync.ts` | `app/shopify/mapping/page.tsx`, ggf. Settings |
| Bulk-Import erfüllter Orders | `server/shopify-bulk-import.ts` | `app/shopify/debug/page.tsx` |

---

**Wenn Informationen hier nicht ausreichen:** In den genannten Markdown-Dateien (`SHOPIFY_SETUP.md`, `SHOPIFY_DEBUG_GUIDE.md`, `WEBHOOK_VERIFICATION.md`, `README.md`) oder direkt in den angegebenen Quelldateien (`db/schema.ts`, `lib/validation.ts`, `lib/shopify.ts`, jeweilige `server/*.ts`) nachsehen.
