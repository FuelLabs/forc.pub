import { useLocalStorage } from "usehooks-ts";

const STORAGE_GH_CODE_KEY = "gh_code";

export function useLocalSession() {
  function clear<T>(key: string, handleSave: (value: T | null) => void) {
    handleSave(null);
    localStorage.removeItem(key);
  }

  const [githubCode, saveGithubCode] = useLocalStorage<string | null>(
    STORAGE_GH_CODE_KEY,
    null,
  );
  const clearGithubCode = () => clear(STORAGE_GH_CODE_KEY, saveGithubCode);

  return { githubCode, saveGithubCode, clearGithubCode };
}
