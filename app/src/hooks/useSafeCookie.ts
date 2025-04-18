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
    Cookies.set(key, newValue);
    setValue(newValue);
  };

  return [value, updateCookie];
}
