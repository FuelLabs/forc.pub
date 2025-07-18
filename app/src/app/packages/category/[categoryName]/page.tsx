"use client";

import React from "react";
import { useParams } from "next/navigation";
import CategoryPackages from "../../../../pages/CategoryPackages";

export default function CategoryPage() {
  const params = useParams();
  const categoryName = decodeURIComponent(params.categoryName as string);

  return <CategoryPackages categoryName={categoryName} />;
}