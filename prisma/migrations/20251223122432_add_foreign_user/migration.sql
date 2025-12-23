/*
  Warnings:

  - Added the required column `usersId` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductsTransaction" ADD COLUMN     "transactionStatus" VARCHAR(16) DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Transactions" ADD COLUMN     "usersId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
