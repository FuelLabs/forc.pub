"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSession } from "../../../utils/localStorage";
import { useSafeCookie } from "../../../hooks/useSafeCookie";
import HTTP, { AuthenticatedUser } from "../../../utils/http";

export function useGithubAuth(): [
  AuthenticatedUser | null,
  () => Promise<void>,
] {
  const [sessionId, setSessionId] = useSafeCookie("fp_session");
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(null);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const logout = useCallback(async () => {
    await HTTP.post(`/logout`);
    setSessionId("");
    router.refresh();
    setGithubUser(null);
  }, [setGithubUser, setSessionId, router]);

  // If this was a redirect from Github, we have a code to log in with.
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !githubCode) {
      saveGithubCode(code);
      router.refresh();
      window.close();
    }
  }, [searchParams, saveGithubCode, router, githubCode]);

  useEffect(() => {
    if (!githubCode) {
      return;
    }

    HTTP.post(`/login`, { code: githubCode })
      .then(({ data }) => {
        clearGithubCode();
        if (data.user) {
          setGithubUser(data.user);
        }
        // Store the session ID in the cookie for persistence
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
      })
      .catch(() => clearGithubCode());
  }, [githubCode, setGithubUser, clearGithubCode]);

  useEffect(() => {
    // Attempt to fetch the logged in user info if the session cookie is set and the user hasn't been fetched.
    if (!!githubUser || !sessionId) {
      return;
    }

    HTTP.get(`/user`)
      .then(({ data }) => {
        setGithubUser(data.user);
      })
      .catch(() => setSessionId(""));
  }, [githubUser, setGithubUser, setSessionId, sessionId]);

  return [githubUser, logout];
}
