CREATE TABLE uploads (
  id uuid PRIMARY KEY NOT NULL,
  source_code_ipfs_hash VARCHAR NOT NULL,
  forc_version VARCHAR NOT NULL,
  abi_ipfs_hash VARCHAR,
  bytecode_identifier VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)