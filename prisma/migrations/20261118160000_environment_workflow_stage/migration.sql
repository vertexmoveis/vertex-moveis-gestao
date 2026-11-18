-- Optional per-environment tracking; preserve existing progress and project stages.
ALTER TABLE "ProjectEnvironment" ADD COLUMN "workflowStage" TEXT;
