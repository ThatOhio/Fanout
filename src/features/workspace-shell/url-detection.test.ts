import { describe, expect, it } from 'vitest';
import { extractSearchQuery, isExplicitUrl } from './url-detection';

describe('isExplicitUrl', () => {
  const passThroughCases: Array<[string, string]> = [
    ['https://example.com', 'explicit scheme'],
    ['http://example.com/path?q=foo', 'explicit scheme with path'],
    ['ftp://files.example.com', 'non-http scheme'],
    ['example.com', 'hostname pattern, no spaces'],
    ['example.com:8080', 'hostname with port, no scheme'],
    ['sub.example.co.uk', 'multi-level TLD'],
    ['localhost', 'localhost'],
    ['localhost:3000', 'localhost with port'],
    ['192.168.1.1', 'IPv4 address'],
    ['2001:db8::1', 'IPv6 address'],
    ['[::1]:8080', 'bracketed IPv6 with port'],
  ];

  it.each(passThroughCases)('treats %s as an explicit URL (%s)', (input) => {
    expect(isExplicitUrl(input)).toBe(true);
  });

  const searchIntentCases: Array<[string, string]> = [
    ['how to cook pasta', 'search intent (spaces)'],
    ['best restaurants', 'search intent'],
    ['python list comprehension', 'search intent'],
    ['fanout', 'single word, no dot'],
    ['', 'empty string'],
  ];

  it.each(searchIntentCases)('treats %s as a search intent (%s)', (input) => {
    expect(isExplicitUrl(input)).toBe(false);
  });
});

describe('extractSearchQuery', () => {
  it('extracts the query from each supported provider', () => {
    expect(extractSearchQuery('https://www.google.com/search?q=hello+world')).toBe('hello world');
    expect(extractSearchQuery('https://duckduckgo.com/?q=fanout+search')).toBe('fanout search');
    expect(extractSearchQuery('https://search.brave.com/search?q=rust+programming')).toBe('rust programming');
    expect(extractSearchQuery('https://www.bing.com/search?q=typescript+tutorial')).toBe('typescript tutorial');
  });

  it('returns null when a known provider URL has no query value', () => {
    expect(extractSearchQuery('https://www.google.com/')).toBeNull();
    expect(extractSearchQuery('https://www.google.com/search?q=')).toBeNull();
  });

  it('returns null for unknown providers', () => {
    expect(extractSearchQuery('https://yahoo.com/search?q=test')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractSearchQuery('not-a-url')).toBeNull();
  });
});
