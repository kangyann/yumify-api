/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `Transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transactions" ADD COLUMN     "invoiceNumber" VARCHAR(16) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transactions_invoiceNumber_key" ON "Transactions"("invoiceNumber");
