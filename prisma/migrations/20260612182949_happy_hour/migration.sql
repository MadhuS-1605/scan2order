-- AlterTable
ALTER TABLE "onboarding_configs" ADD COLUMN     "happyHourEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "happyHourFrom" TEXT,
ADD COLUMN     "happyHourPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "happyHourTo" TEXT;
