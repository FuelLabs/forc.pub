"use client";

import { useTheme } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";

export function useIsMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("md"));
}
