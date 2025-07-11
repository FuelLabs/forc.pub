"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export function useSafeCookie(
  key: string,
): [string | undefined, (value: string) => void, boolean] { // Added isLoading as third return value
  const [value, setValue] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true); // Start with loading = true

  useEffect(() => {
    // Only access cookies on the client side
    setValue(Cookies.get(key));
    setIsLoading(false); // Mark as loaded after we've read the cookie
  }, [key]);

  const updateCookie = (newValue: string) => {
    if (newValue === "") {
      // Remove the cookie if empty value is provided
      Cookies.remove(key, { path: '/' });
      setValue(undefined);
      return;
    }

    // Set cookie with proper options for persistence and security
    const expiryDays = parseInt(process.env.NEXT_PUBLIC_COOKIE_EXPIRY_DAYS || '30', 10);
    Cookies.set(key, newValue, {
      expiryDays,
      sameSite: 'lax', // Allow same-site and cross-site top-level navigation
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:', // Secure flag for HTTPS
      path: '/' // Available across the entire domain
    });
    setValue(newValue);
  };

  return [value, updateCookie, isLoading];
}
