import { NextRequest, NextResponse } from 'next/server';
import { FullPackage } from '../../../features/detail/hooks/usePackageDetail';

// Mock package data for testing documentation links
const mockPackages: FullPackage[] = [
  {
    name: "std",
    version: "0.69.1", 
    description: "Sway standard library",
    createdAt: "2025-07-20T12:00:00Z",
    updatedAt: "2025-08-10T16:30:00Z",
    bytecodeIdentifier: null,
    forcVersion: "0.69.1",
    sourceCodeIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmStdLibrary123/std-0.69.1.tgz",
    abiIpfsUrl: null,
    docsIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmStdDocs123",
    repository: "https://github.com/FuelLabs/sway",
    documentation: "https://docs.fuel.network/docs/sway/", // HAS documentation field
    homepage: "https://github.com/FuelLabs/sway",
    urls: [],
    readme: "# Sway Standard Library\n\nThe Sway standard library provides core functionality...",
    license: "Apache-2.0",
    categories: ["core", "standard"],
    keywords: ["sway", "std", "library"]
  },
  {
    name: "src20",
    version: "0.8.1",
    description: "SRC20 token standard implementation for Sway",
    createdAt: "2025-08-09T12:00:00Z",
    updatedAt: "2025-08-09T12:00:00Z",
    bytecodeIdentifier: null,
    forcVersion: "0.69.1",
    sourceCodeIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmSrc20Library123/src20-0.8.1.tgz",
    abiIpfsUrl: null,
    docsIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmSrc20Docs123",
    repository: "https://github.com/FuelLabs/sway-standards",
    documentation: null, // NO documentation field - should generate auto-generated link
    homepage: "https://github.com/FuelLabs/sway-standards",
    urls: [],
    readme: "# SRC20 Token Standard\n\nImplementation of the SRC20 token standard...",
    license: "Apache-2.0", 
    categories: ["token", "standard"],
    keywords: ["src20", "token", "standard"]
  },
  {
    name: "merkle",
    version: "0.2.0",
    description: "Merkle tree implementation",
    createdAt: "2025-08-06T14:20:00Z",
    updatedAt: "2025-08-06T14:20:00Z",
    bytecodeIdentifier: null,
    forcVersion: "0.69.1",
    sourceCodeIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmMerkleLibrary123/merkle-0.2.0.tgz",
    abiIpfsUrl: null,
    docsIpfsUrl: "https://gateway.pinata.cloud/ipfs/QmMerkleDocs123",
    repository: "https://github.com/example/merkle",
    documentation: null, // NO documentation field - should generate auto-generated link
    homepage: null,
    urls: [],
    readme: "# Merkle Tree\n\nA Sway implementation of merkle trees...",
    license: "MIT",
    categories: ["cryptography", "data-structure"],
    keywords: ["merkle", "tree", "crypto"]
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const version = searchParams.get('version');

  if (!name) {
    return NextResponse.json({ error: 'Package name is required' }, { status: 400 });
  }

  // Find package by name (and version if specified)
  let packageData = mockPackages.find(pkg => pkg.name === name);
  
  if (!packageData) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  // If version specified, update the package version in response
  if (version) {
    packageData = { ...packageData, version };
  }

  // Add CORS headers
  const response = NextResponse.json(packageData);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}