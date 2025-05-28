import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface SearchResult {
  name: string;
  version: string;
  homepage: string;
  documentation: string;
  repository: string;
  updated: string;
  downloads: number;
}

const dummySearchResults: SearchResult[] = [
  // {
  //   name: 'std',
  //   version: '0.1.0',
  //   homepage: 'www.google.com',
  //   documentation: 'www.google.com',
  //   repository: 'www.google.com',
  //   updated: '2024-02-02',
  //   downloads: 100,
  // },
  // {
  //   name: 'core',
  //   version: '0.1.0',
  //   homepage: 'www.google.com',
  //   documentation: 'www.google.com',
  //   repository: 'www.google.com',
  //   updated: '2024-01-01',
  //   downloads: 200,
  // },
];

interface SearchResultsProps {
  searchParams: ReturnType<typeof useSearchParams>;
}

function SearchResults({ searchParams }: SearchResultsProps) {
  const matchingResults = dummySearchResults.filter((result) => {
    return result.name
      .toLowerCase()
      .includes(searchParams.get("q")?.toLowerCase() || "");
  });

  return (
    <div style={{ width: "100%", justifyContent: "center" }}>
      <div>
        <h1>{"Search Results"}</h1>
      </div>
      <div style={{ color: "red" }}>{"Under construction"}</div>

      {matchingResults.map((result) => (
        <div
          key={result.name}
          style={{
            margin: "25px 10% 10% 10%",
            border: "1px solid black",
            display: "flex",
            flexWrap: "wrap",
            padding: "40px",
            backgroundColor: "#fff",
            borderRadius: "4px",
            boxShadow: " 0 1px 3px hsla(51, 90%, 42%, .35)",
          }}
        >
          <div>{result.name}</div>
          <div>{result.version}</div>
          <div>{result.homepage}</div>
          <div>{result.documentation}</div>
          <div>{result.repository}</div>
          <div>{result.updated}</div>
          <div>{result.downloads}</div>
        </div>
      ))}
    </div>
  );
}

function SearchResultsWithParams() {
  const searchParams = useSearchParams();
  return <SearchResults searchParams={searchParams} />;
}

function SearchResultsWrapper() {
  return (
    <Suspense fallback={<div>Loading search results...</div>}>
      <SearchResultsWithParams />
    </Suspense>
  );
}

export default SearchResultsWrapper;
