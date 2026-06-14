-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "onboarding_configs" ADD COLUMN     "languages" TEXT NOT NULL DEFAULT 'en';
