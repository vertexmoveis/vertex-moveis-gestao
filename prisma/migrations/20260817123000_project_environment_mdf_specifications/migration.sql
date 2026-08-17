ALTER TABLE "ProjectEnvironment"
ADD COLUMN "mdfSpecifications" JSONB NOT NULL DEFAULT '[]'::jsonb;
