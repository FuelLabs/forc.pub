"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSession } from "../../../utils/localStorage";
import { useSafeCookie } from "../../../hooks/useSafeCookie";
import HTTP, { AuthenticatedUser } from "../../../utils/http";

const USER_CACHE_KEY = "fp_user_cache";

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
  boolean,
] {
  const [sessionId, setSessionId, isCookieLoading] = useSafeCookie("fp_session");
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(() => {
    return getCachedUser();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasAttemptedUserFetch = useRef(false);
  const hasAttemptedLogin = useRef(false);
  const isLoggingOut = useRef(false);

  const logout = useCallback(async () => {
    // Prevent multiple simultaneous logout calls
    if (isLoggingOut.current) {
      return;
    }
    
    isLoggingOut.current = true;
    
    try {
      // Only attempt server logout if we have a valid session
      if (sessionId) {
        try {
          await HTTP.post(`/logout`);
        } catch {
          // Session likely expired - server cleanup not needed
        }
      }
      
      // Always perform local cleanup
      setSessionId("");
      setGithubUser(null);
      setCachedUser(null);
      setIsAuthLoading(false);
      hasAttemptedUserFetch.current = false;
      hasAttemptedLogin.current = false;
    } finally {
      isLoggingOut.current = false;
    }
  }, [setGithubUser, setSessionId, sessionId]);

  useEffect(() => {
    if (isCookieLoading) {
      return;
    }

    if (!sessionId) {
      setGithubUser(null);
      setCachedUser(null);
      setIsAuthLoading(false);
      return;
    }

    if (sessionId && githubUser) {
      setIsAuthLoading(false);
      return;
    }

    if (sessionId && !githubUser && !hasAttemptedUserFetch.current) {
      setIsAuthLoading(true);
    }
  }, [isCookieLoading, sessionId, githubUser]);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !githubCode) {
      saveGithubCode(code);
      hasAttemptedLogin.current = false;
      router.refresh();
      window.close();
    }
  }, [searchParams, saveGithubCode, router, githubCode]);

  useEffect(() => {
    if (!githubCode || hasAttemptedLogin.current || isLoggingOut.current) {
      return;
    }

    setCachedUser(null);
    setGithubUser(null);
    hasAttemptedUserFetch.current = false;

    hasAttemptedLogin.current = true;
    setIsLoading(true);
    setIsAuthLoading(true);
    
    HTTP.post(`/login`, { code: githubCode })
      .then(({ data }) => {
        clearGithubCode();
        if (data.user) {
          setGithubUser(data.user);
          setCachedUser(data.user);
          hasAttemptedUserFetch.current = true;
        }
        if (data.sessionId) {
          setSessionId(String(data.sessionId));
        }
      })
      .catch(() => {
        clearGithubCode();
        hasAttemptedLogin.current = false;
      })
      .finally(() => {
        setIsLoading(false);
        setIsAuthLoading(false);
      });
  }, [githubCode, setGithubUser, clearGithubCode, setSessionId]);

  useEffect(() => {
    if (isCookieLoading) {
      return;
    }

    if (githubUser || !sessionId || isLoading) {
      return;
    }

    // Reset attempt flag when sessionId changes to allow re-fetching on navigation
    if (!hasAttemptedUserFetch.current) {
      setIsLoading(true);
      setIsAuthLoading(true);
      hasAttemptedUserFetch.current = true;

      HTTP.get(`/user`)
        .then(({ data }) => {
          setGithubUser(data.user);
          setCachedUser(data.user);
        })
        .catch((error) => {
          console.error("Failed to fetch user:", error);
          // Only clear session if it's a 401 (unauthorized)
          if (error?.response?.status === 401) {
            setSessionId("");
            setCachedUser(null);
          }
          hasAttemptedUserFetch.current = false;
        })
        .finally(() => {
          setIsLoading(false);
          setIsAuthLoading(false);
        });
    }
  }, [isCookieLoading, githubUser, setGithubUser, setSessionId, sessionId, isLoading]);

  // Reset attempt flag when sessionId changes to allow re-fetching
  useEffect(() => {
    hasAttemptedUserFetch.current = false;
  }, [sessionId]);

  return [githubUser, logout, isAuthLoading];
}
