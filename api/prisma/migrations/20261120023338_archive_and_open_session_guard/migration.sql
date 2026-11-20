-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Portion" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- At most one non-closed session per table (guards concurrent first orders).
CREATE UNIQUE INDEX "TableSession_one_active_per_table" ON "TableSession"("tableId") WHERE "status" <> 'CLOSED';
