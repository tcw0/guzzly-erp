import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  timestamp,
  unique,
  text,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core"
import { PRODUCT_TYPES } from "@/constants/product-types"
import { INVENTORY_ACTIONS } from "@/constants/inventory-actions"

export const products = pgTable("products", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  type: text("type").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Variations for products (e.g., Color, Size)
export const productVariations = pgTable("product_variations", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Options under a variation (e.g., for Color: White, Black)
export const productVariationOptions = pgTable("product_variation_options", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  variationId: uuid("variation_id")
    .references(() => productVariations.id, { onDelete: "cascade" })
    .notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Product variants represent unique combinations of variation options (SKUs)
export const productVariants = pgTable("product_variants", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  sku: varchar("sku", { length: 255 }).notNull(), // Required unique SKU code
  minimumStockLevel: numeric("minimum_stock_level", { precision: 18, scale: 2 })
    .notNull()
    .default("0"), // Minimum quantity before alert is needed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  skuUnique: unique("product_variants_sku_unique").on(table.sku),
}))

// Junction table linking variants to specific variation option values
export const productVariantSelections = pgTable(
  "product_variant_selections",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, { onDelete: "cascade" })
      .notNull(),
    variationId: uuid("variation_id")
      .references(() => productVariations.id, { onDelete: "cascade" })
      .notNull(),
    optionId: uuid("option_id")
      .references(() => productVariationOptions.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    variantVariationUnique: unique("variant_variation_unique").on(
      table.variantId,
      table.variationId
    ),
  })
)

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, {
      onDelete: "set null",
    }),
  variantId: uuid("variant_id")
    .references(() => productVariants.id, {
      onDelete: "set null",
    }),
  quantity: numeric("quantity", { precision: 18, scale: 2 }).notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
      })
      .notNull(),
    quantityOnHand: numeric("quantity_on_hand", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
  },
  (table) => ({
    inventoryVariantIdUnique: unique("inventory_variant_id_unique").on(
      table.variantId
    ),
  })
)

// Variant-aware Bill of Materials - links product variants to component variants
export const variantBillOfMaterials = pgTable("variant_bill_of_materials", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  componentVariantId: uuid("component_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  quantityRequired: numeric("quantity_required", {
    precision: 18,
    scale: 3,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// export const manufacturingSteps = pgTable("manufacturing_steps", {
//   id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
//   productId: uuid("product_id")
//     .references(() => products.id, { onDelete: "cascade" })
//     .notNull(),
//   stepNumber: numeric("step_number", { precision: 2, scale: 0 }).notNull(),
//   description: varchar("description", { length: 500 }).notNull(),
//   estimatedDuration: numeric("estimated_duration_minutes", {
//     precision: 6,
//     scale: 2,
//   }),
//   createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
// })

// Shopify Integration Tables
// Mapping table: Links Shopify variants to ERP product variants with quantities
// Each row represents one component mapping
// For simple products (grips): one row - Shopify variant → 1× Grip
// For sets/bundles (ski poles): multiple rows - Shopify variant → 2× Grip, 2× Stick, 2× Basket, 2× Sling
export const shopifyVariantMappings = pgTable("shopify_variant_mappings", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  // Shopify side
  shopifyProductId: text("shopify_product_id").notNull(),
  shopifyVariantId: text("shopify_variant_id").notNull(),
  shopifyProductTitle: text("shopify_product_title"), // For display purposes
  shopifyVariantTitle: text("shopify_variant_title"), // For display purposes
  // ERP side (only FINAL products)
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  // Quantity of this component required per Shopify item sold
  // Example: Selling 1 ski pole set requires 2 grips, 2 sticks, etc.
  quantity: numeric("quantity", { precision: 18, scale: 2 }).notNull().default("1"),
  // Sync metadata
  syncStatus: text("sync_status").notNull().default("active"), // active, disabled, error
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncErrors: text("sync_errors"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Prevent duplicate components for same Shopify variant
  shopifyVariantComponentUnique: unique("shopify_variant_component_unique").on(
    table.shopifyVariantId,
    table.productVariantId
  ),
}))

// Property-based mapping for customizable products
// Maps Shopify line item properties to ERP variants
// Example: GRIPS="TÜRKIS" → Grip Variant UUID, BASKET="POWDER BASKETS" + BASKETS="TÜRKIS" → Basket Variant UUID
export const shopifyPropertyMappings = pgTable("shopify_property_mappings", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  // Shopify product/variant this mapping applies to
  shopifyProductId: text("shopify_product_id").notNull(),
  shopifyVariantId: text("shopify_variant_id").notNull(),
  shopifyProductTitle: text("shopify_product_title"), // For display purposes
  shopifyVariantTitle: text("shopify_variant_title"), // For display purposes
  // Property matching rules (JSON for flexibility)
  // Example: {"GRIPS": "TÜRKIS"} or {"BASKET": "POWDER BASKETS", "BASKETS": "TÜRKIS"}
  propertyRules: jsonb("property_rules").notNull(),
  // ERP variant to deduct
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  // Quantity per match (usually 1 or 2 for pairs)
  quantity: numeric("quantity", { precision: 18, scale: 2 }).notNull().default("1"),
  syncStatus: text("sync_status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Prevent duplicate component mappings for same property rules
  shopifyVariantRulesComponentUnique: unique("shopify_variant_rules_component_unique").on(
    table.shopifyVariantId,
    table.propertyRules,
    table.productVariantId
  ),
}))

// Track Shopify orders for reconciliation and audit
export const shopifyOrders = pgTable("shopify_orders", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  shopifyOrderNumber: text("shopify_order_number").notNull(),
  status: text("status").notNull(), // fulfilled, cancelled, refunded
  orderCreatedAt: timestamp("order_created_at", { withTimezone: true }),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }),
  customerEmail: text("customer_email"),
  // Link to our inventory movement when processed
  inventoryMovementId: uuid("inventory_movement_id").references(
    () => inventoryMovements.id,
    { onDelete: "set null" }
  ),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  rawPayload: jsonb("raw_payload"), // Store full webhook data for debugging
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Order line items with SKU mapping details
export const shopifyOrderItems = pgTable("shopify_order_items", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .references(() => shopifyOrders.id, { onDelete: "cascade" })
    .notNull(),
  shopifyLineItemId: text("shopify_line_item_id").notNull(),
  shopifyProductId: text("shopify_product_id").notNull(),
  shopifyVariantId: text("shopify_variant_id").notNull(),
  sku: text("sku").notNull(),
  // Mapped ERP variant (NULL if mapping failed)
  productVariantId: uuid("product_variant_id").references(
    () => productVariants.id,
    { onDelete: "set null" }
  ),
  quantity: numeric("quantity", { precision: 18, scale: 2 }).notNull(),
  price: numeric("price", { precision: 18, scale: 2 }),
  mappingStatus: text("mapping_status").notNull(), // mapped, unmapped, error
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Webhook audit log for compliance and debugging
export const shopifyWebhookLogs = pgTable("shopify_webhook_logs", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  topic: text("topic").notNull(), // orders/fulfilled, orders/cancelled, etc.
  shopifyOrderId: text("shopify_order_id"),
  status: text("status").notNull(), // received, processed, failed
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Manual annotations for Shopify orders (customer name, notes, etc.)
// Stored separately to avoid duplicating Shopify order data
export const shopifyOrderAnnotations = pgTable(
  "shopify_order_annotations",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    shopifyOrderId: text("shopify_order_id").notNull().unique(),
    customerName: text("customer_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
)

// Track Shopify variant ID changes to handle historical orders
// Maintains immutable chain: variant_id_123 → variant_id_456 → variant_id_789
// This allows orders with old variant IDs to still find their mappings
export const shopifyVariantHistory = pgTable(
  "shopify_variant_history",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    shopifyProductId: text("shopify_product_id").notNull(),
    oldVariantId: text("old_variant_id").notNull(),
    newVariantId: text("new_variant_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Unique constraint: One mapping per old variant per product
    uniqueOldVariantPerProduct: unique("variant_history_product_old_unique").on(
      table.shopifyProductId,
      table.oldVariantId
    ),
    // Index for resolving chains
    productIdIdx: index("variant_history_product_id_idx").on(
      table.shopifyProductId
    ),
  })
)

export type Product = typeof products.$inferSelect
export type VariantBillOfMaterials = typeof variantBillOfMaterials.$inferSelect
export type ProductVariation = typeof productVariations.$inferSelect
export type ProductVariationOption = typeof productVariationOptions.$inferSelect
export type ProductVariant = typeof productVariants.$inferSelect
export type ProductVariantSelection = typeof productVariantSelections.$inferSelect
export type ShopifyVariantMapping = typeof shopifyVariantMappings.$inferSelect
export type ShopifyPropertyMapping = typeof shopifyPropertyMappings.$inferSelect
export type ShopifyOrder = typeof shopifyOrders.$inferSelect
export type ShopifyOrderItem = typeof shopifyOrderItems.$inferSelect
export type ShopifyVariantHistory = typeof shopifyVariantHistory.$inferSelect
export type ShopifyWebhookLog = typeof shopifyWebhookLogs.$inferSelect
export type ShopifyOrderAnnotation = typeof shopifyOrderAnnotations.$inferSelect
// export type ManufacturingStep = typeof manufacturingSteps.$inferSelect
