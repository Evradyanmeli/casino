-- Existing users keep their balances. New credits must have an explicit source.
ALTER TABLE "User" ALTER COLUMN "balance" SET DEFAULT 0;

CREATE TABLE "FinancialOperation" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialOperation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialOperation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinancialOperation_actorId_scope_key_key" ON "FinancialOperation"("actorId", "scope", "key");
CREATE INDEX "FinancialOperation_createdAt_idx" ON "FinancialOperation"("createdAt");
