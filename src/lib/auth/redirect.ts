const authPages = new Set(["/login", "/cadastro"]);

export function sanitizeAuthRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  const path = value?.trim();

  if (!path) {
    return fallback;
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return fallback;
  }

  if (authPages.has(path) || path.startsWith("/auth/")) {
    return fallback;
  }

  return path;
}
