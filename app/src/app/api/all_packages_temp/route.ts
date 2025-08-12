import { NextRequest, NextResponse } from 'next/server';

// Complete registry data - all 34 packages from the registry
// Note: In production, only packages with docs_ipfs_hash should be included
// For now, only std has full documentation available
const allPackagesFromRegistry = [
  { name: "admin", version: "0.1.0", description: "Admin functionality for Sway contracts", createdAt: "2025-07-15T10:00:00Z", updatedAt: "2025-07-15T10:00:00Z" },
  { name: "asset", version: "0.2.0", description: "Asset management utilities", createdAt: "2025-07-20T11:00:00Z", updatedAt: "2025-08-01T11:00:00Z" },
  { name: "base64", version: "0.1.0", description: "Base64 encoding library", createdAt: "2025-07-24T17:26:52Z", updatedAt: "2025-07-24T17:26:52Z" },
  { name: "big_int", version: "0.2.0", description: "Big integer arithmetic", createdAt: "2025-07-30T12:00:00Z", updatedAt: "2025-08-06T15:30:00Z" },
  { name: "bytecode", version: "0.2.0", description: "Bytecode manipulation utilities", createdAt: "2025-07-25T13:00:00Z", updatedAt: "2025-08-02T13:00:00Z" },
  { name: "deci-mate", version: "0.1.1", description: "No description available.", createdAt: "2025-07-22T18:02:18Z", updatedAt: "2025-07-22T18:12:16Z" },
  { name: "forc-publish-demo", version: "0.2.0", description: "Demo package for forc publish", createdAt: "2025-07-30T15:00:00Z", updatedAt: "2025-08-04T15:00:00Z" },
  { name: "forc-publish-demo-2", version: "0.1.0", description: "Second demo package for forc publish", createdAt: "2025-08-01T16:00:00Z", updatedAt: "2025-08-01T16:00:00Z" },
  { name: "hello_world", version: "0.1.2", description: "Hello World example package", createdAt: "2025-07-25T16:00:00Z", updatedAt: "2025-08-07T10:45:00Z" },
  { name: "merkle", version: "0.2.0", description: "Merkle tree implementation", createdAt: "2025-08-06T14:20:00Z", updatedAt: "2025-08-06T14:20:00Z" },
  { name: "nazeeh_first_lib", version: "0.1.3", description: "First library by Nazeeh", createdAt: "2025-08-01T10:00:00Z", updatedAt: "2025-08-09T11:15:00Z" },
  { name: "ownership", version: "0.2.0", description: "Ownership management utilities", createdAt: "2025-07-18T17:00:00Z", updatedAt: "2025-08-05T17:00:00Z" },
  { name: "pausable", version: "0.1.1", description: "Pausable contract functionality", createdAt: "2025-08-05T09:45:00Z", updatedAt: "2025-08-05T09:45:00Z" },
  { name: "pub-test-delegation", version: "1.0.0", description: "No description available.", createdAt: "2025-08-05T05:30:17Z", updatedAt: "2025-08-05T05:30:17Z" },
  { name: "queue", version: "0.2.0", description: "Queue data structure for Sway", createdAt: "2025-08-07T10:15:00Z", updatedAt: "2025-08-07T10:15:00Z" },
  { name: "reentrancy", version: "0.2.0", description: "Reentrancy protection utilities", createdAt: "2025-07-20T19:00:00Z", updatedAt: "2025-08-06T19:00:00Z" },
  { name: "signed_int", version: "0.2.0", description: "Signed integer operations", createdAt: "2025-07-22T20:00:00Z", updatedAt: "2025-08-07T20:00:00Z" },
  { name: "src10", version: "0.2.0", description: "SRC10 token standard implementation", createdAt: "2025-07-25T21:00:00Z", updatedAt: "2025-08-08T21:00:00Z" },
  { name: "src11", version: "0.2.0", description: "SRC11 token standard implementation", createdAt: "2025-07-26T22:00:00Z", updatedAt: "2025-08-09T22:00:00Z" },
  { name: "src12", version: "0.2.0", description: "SRC12 token standard implementation", createdAt: "2025-07-27T23:00:00Z", updatedAt: "2025-08-10T23:00:00Z" },
  { name: "src14", version: "0.2.0", description: "SRC14 token standard implementation", createdAt: "2025-07-28T08:00:00Z", updatedAt: "2025-08-11T08:00:00Z" },
  { name: "src15", version: "0.2.0", description: "SRC15 token standard implementation", createdAt: "2025-07-29T09:00:00Z", updatedAt: "2025-08-12T09:00:00Z" },
  { name: "src16", version: "0.2.0", description: "SRC16 token standard implementation", createdAt: "2025-07-30T10:00:00Z", updatedAt: "2025-08-01T10:00:00Z" },
  { name: "src17", version: "0.1.0", description: "SRC17 token standard implementation", createdAt: "2025-08-01T11:00:00Z", updatedAt: "2025-08-01T11:00:00Z" },
  { name: "src20", version: "0.8.1", description: "SRC20 token standard implementation for Sway", createdAt: "2025-08-09T12:00:00Z", updatedAt: "2025-08-09T12:00:00Z" },
  { name: "src3", version: "0.2.0", description: "SRC3 token standard implementation", createdAt: "2025-07-16T12:00:00Z", updatedAt: "2025-08-02T12:00:00Z" },
  { name: "src5", version: "0.2.0", description: "SRC5 token standard implementation", createdAt: "2025-07-17T13:00:00Z", updatedAt: "2025-08-03T13:00:00Z" },
  { name: "src6", version: "0.2.0", description: "SRC6 token standard implementation", createdAt: "2025-07-18T14:00:00Z", updatedAt: "2025-08-04T14:00:00Z" },
  { name: "src7", version: "0.2.0", description: "SRC7 token standard implementation", createdAt: "2025-07-19T15:00:00Z", updatedAt: "2025-08-05T15:00:00Z" },
  { name: "std", version: "0.69.1", description: "Sway standard library", createdAt: "2025-07-20T12:00:00Z", updatedAt: "2025-08-10T16:30:00Z" },
  { name: "stork_sway_sdk", version: "0.0.4", description: "A Sway SDK for Stork Oracle", createdAt: "2025-08-05T05:58:27Z", updatedAt: "2025-08-12T06:37:14Z" },
  { name: "sway-hashmap", version: "0.1.0", description: "HashMap implementation for Sway", createdAt: "2025-08-03T16:00:00Z", updatedAt: "2025-08-03T16:00:00Z" },
  { name: "upgradability", version: "0.2.0", description: "Contract upgradability utilities", createdAt: "2025-07-21T17:00:00Z", updatedAt: "2025-08-06T17:00:00Z" },
  { name: "vrf", version: "0.1.2", description: "A simple VRF library for Sway", createdAt: "2025-08-11T08:59:21Z", updatedAt: "2025-08-11T09:24:55Z" }
];

// In production, only packages with docs_ipfs_hash have documentation
// For demo purposes, let's simulate this by only including std package which has working docs
const packagesWithDocs = allPackagesFromRegistry.filter(pkg => 
  pkg.name === 'std' // Only std has full documentation available currently
);

export async function GET(request: NextRequest) {
  // Add CORS headers
  const response = NextResponse.json({ packages: packagesWithDocs });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}