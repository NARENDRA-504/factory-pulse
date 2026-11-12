-- Preserve all records and runtime privileges. Unknown inspections must stay unknown.
USE ziro_manufacturing;
ALTER TABLE machines
  MODIFY COLUMN last_inspection_date DATE NULL,
  ADD COLUMN installation_date DATE NULL,
  ADD COLUMN manufacturer VARCHAR(128) NULL;
