import { gotScraping, Request } from 'crawlee';
import proxyConfiguration from './managers/Proxy.js';
import { log } from '@anycrawl/libs';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpClientOptions {
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
    retries?: number;
    followRedirects?: boolean;
    requireProxy?: boolean; // default true
    cookieHeader?: string;
    proxy?: string; // per-request override, e.g. http://user:pass@host:port
}

export interface HttpResponse<T = any> {
    status: number;
    headers: Record<string, string>;
    data: T;
    rawText?: string;
}

function redactUrl(input?: string): string | undefined {
    if (!input) return input;
    return input.replace(/(https?:\/\/)([^@\n]+)@/gi, '$1***@')
        .replace(/(https?:\/\/)([^\s\/]+)(:\d+)?/gi, '$1***');
}

function normalizeProxyUrl(input?: string): string | undefined {
    if (!input) return undefined;
    const hasScheme = /^\w+:\/\//.test(input);
    return hasScheme ? input : `http://${input}`;
}

export async function request<T = any>(method: HttpMethod, url: string, opts?: HttpClientOptions): Promise<HttpResponse<T>> {
    if (!url) throw new Error('Invalid URL');

    const requireProxy = opts?.requireProxy !== false; // default true
    // Prefer per-request proxy override if provided
    let proxyUrl = normalizeProxyUrl(opts?.proxy);
    if (!proxyUrl) {
        // Provide request context so ProxyConfiguration can route by URL
        const req = new Request({ url });
        proxyUrl = await proxyConfiguration.newUrl(undefined, { request: req });
    }
    if (requireProxy && !proxyUrl) {
        const e = new Error('PROXY_REQUIRED');
        e.name = 'PROXY_REQUIRED';
        throw e;
    }

    const headers = Object.assign({}, opts?.headers);
    if (opts?.cookieHeader) headers['cookie'] = opts.cookieHeader;

    const gsOpts: any = {
        method,
        headers,
        timeout: { request: opts?.timeoutMs ?? 20000 },
        retry: { limit: opts?.retries ?? 2 },
        followRedirect: opts?.followRedirects !== false,
        throwHttpErrors: false,
    };

    if (opts?.body !== undefined) {
        if (typeof opts.body === 'object' && !(opts.body instanceof Buffer)) {
            headers['content-type'] ||= 'application/json';
            gsOpts.body = JSON.stringify(opts.body);
        } else {
            gsOpts.body = opts.body;
        }
    }

    if (proxyUrl) gsOpts.proxyUrl = proxyUrl;

    try {
        const bodyLen = typeof gsOpts.body === 'string' ? gsOpts.body.length : (gsOpts.body ? 1 : 0);
        log.info(`[HTTP] start method=${method} url=${redactUrl(url)} proxy=${redactUrl(proxyUrl || '')} requireProxy=${requireProxy} timeout=${gsOpts.timeout?.request} retries=${gsOpts.retry?.limit} bodyLen=${bodyLen}`);
        const res = await gotScraping(url, gsOpts);
        const contentType = String(res.headers['content-type'] || '');
        const flatHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') flatHeaders[k.toLowerCase()] = v;
            else if (Array.isArray(v)) flatHeaders[k.toLowerCase()] = v.join(', ');
        }
        let data: any;
        let rawText: string | undefined;
        if (/application\/json|text\/json/i.test(contentType)) {
            try { data = JSON.parse(res.body as unknown as string); } catch { data = res.body; }
        } else {
            rawText = String(res.body ?? '');
            data = rawText as unknown as T;
        }
        const size = (res.body as any)?.length ?? 0;
        log.info(`[HTTP] done method=${method} status=${res.statusCode} url=${redactUrl(url)} proxy=${redactUrl(proxyUrl || '')} ct=${contentType} bytes=${size}`);
        return { status: res.statusCode, headers: flatHeaders, data, rawText };
    } catch (err: any) {
        log.error(`[HTTP] error method=${method} url=${redactUrl(url)} proxy=${redactUrl(proxyUrl || '')} msg=${err?.message || ''}`);
        const e = new Error(`HTTP_REQUEST_ERROR ${err?.message || ''} url=${redactUrl(url)} proxy=${redactUrl(proxyUrl || '')}`.trim());
        e.name = 'HTTP_REQUEST_ERROR';
        throw e;
    }
}

export const HttpClient = {
    get: <T = any>(url: string, opts?: HttpClientOptions) => request<T>('GET', url, opts),
    post: <T = any>(url: string, opts?: HttpClientOptions) => request<T>('POST', url, opts),
    put: <T = any>(url: string, opts?: HttpClientOptions) => request<T>('PUT', url, opts),
    delete: <T = any>(url: string, opts?: HttpClientOptions) => request<T>('DELETE', url, opts),
};


