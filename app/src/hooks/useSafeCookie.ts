"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export function useSafeCookie(
  key: string,
): [string | undefined, (value: string) => void] {
  const [value, setValue] = useState<string | undefined>();

  useEffect(() => {
    // Only access cookies on the client side
    setValue(Cookies.get(key));
  }, [key]);

  const updateCookie = (newValue: string) => {
    if (newValue === "") {
      // Remove the cookie if empty value is provided
      Cookies.remove(key, { path: '/' });
      setValue(undefined);
      return;
    }

    // Set cookie with proper options for persistence and security
    Cookies.set(key, newValue, {
      expires: 30, // 30 days
      sameSite: 'lax', // Allow same-site and cross-site top-level navigation
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:', // Secure flag for HTTPS
      path: '/' // Available across the entire domain
    });
    setValue(newValue);
  };

  return [value, updateCookie];
}
