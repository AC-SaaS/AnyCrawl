import { locales } from "@anycrawl/libs";

export interface SearchResult {
    title: string;
    url?: string;
    description?: string;
    source: string;
    page?: number;
}

export interface SearchTask {
    url: string;
    headers: Record<string, string>;
    cookies: Record<string, string>;
}

export type SearchLocale = (typeof locales)[number]["code"] | "all";

export interface SearchOptions {
    query: string;
    limit?: number;
    offset?: number;
    pages?: number;
    lang?: SearchLocale;
    country?: SearchLocale;
    safe_search?: number | null; // 0: off, 1: medium, 2: high, null: default (Google only)
    [key: string]: any;
}

export interface SearchEngine {
    search(options: SearchOptions): Promise<SearchTask>;
    getName(): string;
    parse(html: string, request?: any): Promise<SearchResult[]>;
}
