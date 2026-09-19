CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentLimit" INTEGER NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "yearlyAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingPlan_slug_key" ON "PricingPlan"("slug");
CREATE INDEX "PricingPlan_active_displayOrder_idx" ON "PricingPlan"("active", "displayOrder");

INSERT INTO "PricingPlan" ("id", "slug", "name", "studentLimit", "monthlyAmount", "yearlyAmount", "currency", "active", "displayOrder", "updatedAt") VALUES
('starter-plan', 'starter', 'Starter', 100, 150, 1500, 'GHS', true, 1, CURRENT_TIMESTAMP),
('growth-plan', 'growth', 'Growth', 300, 300, 3000, 'GHS', true, 2, CURRENT_TIMESTAMP),
('pro-plan', 'pro', 'Pro', 700, 500, 5000, 'GHS', true, 3, CURRENT_TIMESTAMP);