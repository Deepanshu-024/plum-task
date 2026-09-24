/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clerkId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClaimCategory" AS ENUM ('CONSULTATION', 'DIAGNOSTIC', 'PHARMACY', 'DENTAL', 'VISION', 'ALTERNATIVE_MEDICINE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('QUEUED', 'VERIFYING', 'DOC_ERROR', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'PARTIAL', 'REJECTED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'HOSPITAL_BILL', 'LAB_REPORT', 'DIAGNOSTIC_REPORT', 'PHARMACY_BILL', 'DENTAL_REPORT', 'DISCHARGE_SUMMARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('DOCUMENT_VERIFIER', 'DOCUMENT_PARSER', 'POLICY_EVALUATOR', 'FINANCIAL_CALCULATOR', 'FRAUD_DETECTOR', 'DECISION_AGGREGATOR');

-- CreateEnum
CREATE TYPE "TraceStatus" AS ENUM ('RUNNING', 'PASS', 'FAIL', 'SKIPPED', 'ERROR');

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "name",
ADD COLUMN     "clerkId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "claimCategory" "ClaimCategory" NOT NULL,
    "treatmentDate" TIMESTAMP(3) NOT NULL,
    "claimedAmount" DECIMAL(10,2) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'QUEUED',
    "decision" "Decision",
    "approvedAmount" DECIMAL(10,2),
    "confidenceScore" DOUBLE PRECISION,
    "rejectionReasons" JSONB,
    "decisionSummary" TEXT,
    "financialBreakdown" JSONB,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "triggerTaskId" TEXT,
    "simulateFailure" BOOLEAN NOT NULL DEFAULT false,
    "claimsHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDocument" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "declaredType" "DocumentType" NOT NULL,
    "detectedType" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "qualityNotes" TEXT,
    "extractedData" JSONB,
    "patientNameOnDoc" TEXT,
    "extractionConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceEntry" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "agentName" "AgentName" NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "status" "TraceStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "checks" JSONB,
    "durationMs" INTEGER,
    "tokenUsage" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Claim_userId_idx" ON "Claim"("userId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_createdAt_idx" ON "Claim"("createdAt");

-- CreateIndex
CREATE INDEX "ClaimDocument_claimId_idx" ON "ClaimDocument"("claimId");

-- CreateIndex
CREATE INDEX "TraceEntry_claimId_idx" ON "TraceEntry"("claimId");

-- CreateIndex
CREATE INDEX "TraceEntry_claimId_stepOrder_idx" ON "TraceEntry"("claimId", "stepOrder");

-- CreateIndex
CREATE INDEX "TraceEntry_agentName_idx" ON "TraceEntry"("agentName");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDocument" ADD CONSTRAINT "ClaimDocument_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceEntry" ADD CONSTRAINT "TraceEntry_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
