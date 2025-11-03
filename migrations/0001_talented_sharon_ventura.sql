ALTER TABLE "bill_of_materials" DROP CONSTRAINT "bill_of_materials_id_unique";--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_id_unique";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_id_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_id_unique";