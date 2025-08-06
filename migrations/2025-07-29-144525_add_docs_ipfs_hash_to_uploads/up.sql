-- Add docs_ipfs_hash column to uploads table
ALTER TABLE uploads ADD COLUMN docs_ipfs_hash VARCHAR(100) DEFAULT NULL;