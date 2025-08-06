-- Remove docs_ipfs_hash column from uploads table
ALTER TABLE uploads DROP COLUMN IF EXISTS docs_ipfs_hash;