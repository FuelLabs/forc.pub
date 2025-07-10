"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasAttemptedUserFetch = useRef(false);

  const logout = useCallback(async () => {
    await HTTP.post(`/logout`);
    setSessionId("");
    router.refresh();
    setGithubUser(null);
    hasAttemptedUserFetch.current = false;
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

  // Handle login with GitHub code
  useEffect(() => {
    if (!githubCode || isLoading) {
      return;
    }

    setIsLoading(true);
    HTTP.post(`/login`, { code: githubCode })
      .then(({ data }) => {
        clearGithubCode();
        if (data.user) {
          setGithubUser(data.user);
          hasAttemptedUserFetch.current = true; // Mark as fetched to prevent duplicate calls
        }
        // Store the session ID in the cookie for persistence
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
      })
      .catch(() => {
        clearGithubCode();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [githubCode, setGithubUser, clearGithubCode, setSessionId, isLoading]);

  // Attempt to fetch user info if session exists but user hasn't been fetched
  useEffect(() => {
    // Prevent multiple calls and race conditions
    if (githubUser || !sessionId || isLoading || hasAttemptedUserFetch.current) {
      return;
    }

    setIsLoading(true);
    hasAttemptedUserFetch.current = true;

    HTTP.get(`/user`)
      .then(({ data }) => {
        setGithubUser(data.user);
      })
      .catch(() => {
        setSessionId("");
        hasAttemptedUserFetch.current = false; // Reset on error so we can try again
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [githubUser, setGithubUser, setSessionId, sessionId, isLoading]);

  return [githubUser, logout];
}
