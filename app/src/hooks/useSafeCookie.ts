"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

interface CookieOptions {
  expires: number;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  secure?: boolean;
}

export function useSafeCookie(
  key: string,
): [string | undefined, (value: string) => void, boolean] {
  const [value, setValue] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setValue(Cookies.get(key));
    setIsLoading(false);
  }, [key]);

  const updateCookie = (newValue: string) => {
    if (newValue === "") {
      Cookies.remove(key, { path: '/' });
      setValue(undefined);
      return;
    }

    const cookieOptions: CookieOptions = {
      expires: 30,
      sameSite: 'lax',
      path: '/'
    };

    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      cookieOptions.secure = true;
    }

    Cookies.set(key, newValue, cookieOptions);
    setValue(newValue);
  };

  return [value, updateCookie, isLoading];
}
