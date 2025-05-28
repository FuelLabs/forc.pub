"use client";

import { useSafeLocalStorage } from "../hooks/useSafeLocalStorage";

const STORAGE_GH_CODE_KEY = "gh_code";

export function useLocalSession() {
  const [githubCode, saveGithubCode, clearGithubCode] = useSafeLocalStorage<
    string | null
  >(STORAGE_GH_CODE_KEY, null);

  return { githubCode, saveGithubCode, clearGithubCode };
}
