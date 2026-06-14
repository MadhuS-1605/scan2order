-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pointsAwarded" BOOLEAN NOT NULL DEFAULT false;
