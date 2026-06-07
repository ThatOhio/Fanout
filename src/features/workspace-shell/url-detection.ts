export const KNOWN_SEARCH_HOSTNAMES = [
  'www.google.com',
  'duckduckgo.com',
  'search.brave.com',
  'www.bing.com',
] as const;

const SEARCH_ENGINE_QUERY_PARAMS: Record<string, string> = {
  'www.google.com': 'q',
  'duckduckgo.com': 'q',
  'search.brave.com': 'q',
  'www.bing.com': 'q',
};

/**
 * Returns true when the input looks like an explicit URL that should pass
 * through to normal browser navigation instead of being routed to Fanout.
 * Errs on the side of pass-through: any string that could be a URL returns true.
 */
export function isExplicitUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  // Explicit scheme (http://, https://, ftp://, ...)
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed)) {
    return true;
  }

  // localhost with optional port/path
  if (/^localhost(:\d+)?([/?#].*)?$/i.test(trimmed)) {
    return true;
  }

  // IPv4 address with optional port/path
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#].*)?$/.test(trimmed)) {
    return true;
  }

  // hostname.tld pattern with no spaces (example.com, sub.example.co.uk)
  if (!trimmed.includes(' ') && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extracts the search query from a recognized search-engine URL.
 * Returns null when the URL is not a known search engine or has no query value.
 */
export function extractSearchQuery(url: string): string | null {
  try {
    const parsed = new URL(url);
    const paramKey = SEARCH_ENGINE_QUERY_PARAMS[parsed.hostname];
    if (!paramKey) {
      return null;
    }

    const query = parsed.searchParams.get(paramKey);
    return query && query.trim() ? query.trim() : null;
  } catch {
    return null;
  }
}
