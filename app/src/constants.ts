const resolveApiBaseUrl = () => {
  const candidate =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_INTERNAL_API_URL;

  if (!candidate) {
    return "http://localhost:8080";
  }

  return candidate.replace(/\/$/, "");
};

export const SERVER_URI = resolveApiBaseUrl();
export const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000";
