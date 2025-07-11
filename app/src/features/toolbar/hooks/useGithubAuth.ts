"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSession } from "../../../utils/localStorage";
import { useSafeCookie } from "../../../hooks/useSafeCookie";
import HTTP, { AuthenticatedUser } from "../../../utils/http";

const USER_CACHE_KEY = "fp_user_cache";

// Helper functions for user data caching
const getCachedUser = (): AuthenticatedUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedUser = (user: AuthenticatedUser | null) => {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export function useGithubAuth(): [
  AuthenticatedUser | null,
  () => Promise<void>,
  boolean, // isAuthLoading
] {
  const [sessionId, setSessionId, isCookieLoading] = useSafeCookie("fp_session");
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(() => {
    // Initialize with cached user data if available
    return getCachedUser();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasAttemptedUserFetch = useRef(false);
  const hasAttemptedLogin = useRef(false);

  const logout = useCallback(async () => {
    await HTTP.post(`/logout`);
    setSessionId("");
    router.refresh();
    setGithubUser(null);
    setCachedUser(null); // Clear cached user data
    setIsAuthLoading(false);
    hasAttemptedUserFetch.current = false;
    hasAttemptedLogin.current = false;
  }, [setGithubUser, setSessionId, router]);

  // Initial auth check - wait for cookie to load before making any decisions
  useEffect(() => {
    // Don't make any auth decisions until cookie is loaded
    if (isCookieLoading) {
      return;
    }

    // Cookie loaded: if no session cookie exists, we're definitely not logged in
    if (!sessionId) {
      setGithubUser(null);
      setCachedUser(null);
      setIsAuthLoading(false);
      return;
    }

    // If we have both session cookie and cached user data, we're good to go!
    if (sessionId && githubUser) {
      setIsAuthLoading(false);
      return;
    }

    // If we have session but no cached user, we need to fetch
    if (sessionId && !githubUser && !hasAttemptedUserFetch.current) {
      setIsAuthLoading(true);
    }
  }, [isCookieLoading, sessionId, githubUser]);

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
    if (!githubCode || hasAttemptedLogin.current) {
      return;
    }

    hasAttemptedLogin.current = true; // Mark login attempt as started
    setIsLoading(true);
    setIsAuthLoading(true);
    HTTP.post(`/login`, { code: githubCode })
      .then(({ data }) => {
        clearGithubCode();
        if (data.user) {
          setGithubUser(data.user);
          setCachedUser(data.user); // Cache the user data
          hasAttemptedUserFetch.current = true;
        }
        // Store the session ID in the cookie for persistence
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
      })
      .catch(() => {
        clearGithubCode();
        hasAttemptedLogin.current = false; // Reset on error so we can try again
      })
      .finally(() => {
        setIsLoading(false);
        setIsAuthLoading(false);
      });
  }, [githubCode, setGithubUser, clearGithubCode, setSessionId]);

  // Attempt to fetch user info if session exists but user hasn't been fetched
  useEffect(() => {
    // Don't attempt to fetch user data until cookie is loaded
    if (isCookieLoading) {
      return;
    }

    // Prevent multiple calls and race conditions
    if (githubUser || !sessionId || isLoading || hasAttemptedUserFetch.current) {
      return;
    }

    setIsLoading(true);
    setIsAuthLoading(true);
    hasAttemptedUserFetch.current = true;

    HTTP.get(`/user`)
      .then(({ data }) => {
        setGithubUser(data.user);
        setCachedUser(data.user); // Cache the user data
      })
      .catch(() => {
        setSessionId("");
        setCachedUser(null); // Clear invalid cache
        hasAttemptedUserFetch.current = false;
      })
      .finally(() => {
        setIsLoading(false);
        setIsAuthLoading(false);
      });
  }, [isCookieLoading, githubUser, setGithubUser, setSessionId, sessionId, isLoading]);

  return [githubUser, logout, isAuthLoading];
}
