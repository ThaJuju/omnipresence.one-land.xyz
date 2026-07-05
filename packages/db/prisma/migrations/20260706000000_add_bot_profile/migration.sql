-- CreateTable
CREATE TABLE "BotProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "description" TEXT,
    "customStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotProfile_pkey" PRIMARY KEY ("id")
);
