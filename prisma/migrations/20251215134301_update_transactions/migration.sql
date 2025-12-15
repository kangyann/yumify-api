/*
  Warnings:

  - A unique constraint covering the columns `[paymentCode]` on the table `Payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productName]` on the table `Products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productQuantity` to the `ProductsTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `ProductsTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductsTransaction" ADD COLUMN     "productQuantity" INTEGER NOT NULL,
ADD COLUMN     "totalPrice" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Transactions" ADD COLUMN     "status" VARCHAR(16) NOT NULL,
ADD COLUMN     "totalPrice" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payments_paymentCode_key" ON "Payments"("paymentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Products_productName_key" ON "Products"("productName");
