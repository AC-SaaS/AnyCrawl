import { CrawlingContext } from "crawlee";
import type { TemplateScrapeSchema, TemplateCrawlSchema, TemplateSearchSchema } from "./index.js";

// Template configuration types
export interface TemplateConfig {
    // Basic information
    uuid: string;
    templateId: string;
    name: string;
    description?: string;
    tags: string[];
    version: string;

    // Pricing information
    pricing: {
        perCall: number;
        currency: "credits";
    };

    // Template type - determines which operation this template supports
    templateType: "scrape" | "crawl" | "search";

    // Request options configuration - structure depends on templateType
    reqOptions: TemplateScrapeSchema | TemplateCrawlSchema | TemplateSearchSchema;

    // Custom handlers code
    customHandlers?: {
        requestHandler?: {
            enabled: boolean;
            code: {
                language: "javascript" | "typescript";
                source: string;
                compiled?: string;
            };
        };
        failedRequestHandler?: {
            enabled: boolean;
            code: {
                language: "javascript" | "typescript";
                source: string;
                compiled?: string;
            };
        };
    };

    // Template metadata
    metadata: {
        reviewRcords?: [
            {
                reviewDate: Date;
                reviewStatus: "pending" | "approved" | "rejected";
                reviewNotes?: string;
                reviewUser?: string;
            }
        ],
        // Domain restrictions
        allowedDomains?: {
            type: "glob" | "exact";
            patterns: string[];
        },
        [key: string]: any;
    };

    // Template variables
    variables?: {
        [key: string]: {
            type: "string" | "number" | "boolean" | "url";
            description: string;
            required: boolean;
            defaultValue?: any;
        };
    };

    // User information
    createdBy: string;
    publishedBy?: string;
    reviewedBy?: string;

    // Status information
    status: "draft" | "pending" | "approved" | "rejected" | "published" | "archived";
    reviewStatus: "pending" | "approved" | "rejected";
    reviewNotes?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
    reviewedAt?: Date;
    archivedAt?: Date;
}

// Template client configuration
export interface TemplateClientConfig {
    cacheConfig?: {
        ttl: number; // Cache time-to-live in milliseconds
        maxSize: number; // Maximum number of cached templates
        cleanupInterval: number; // Cleanup interval in milliseconds
    };
    sandboxConfig?: {
        timeout: number; // Execution timeout in milliseconds
        memoryLimit: number; // Memory limit in MB
        maxWorkers: number; // Maximum number of worker threads
    };
}

// Template execution context
export interface TemplateExecutionContext {
    templateId: string;
    variables?: Record<string, any>;
    request: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: any;
    };
    response?: CrawlingContext['response'];
    metadata?: Record<string, any>;
    scrapeResult?: {
        url?: string;
        title?: string;
        markdown?: string;
        html?: string;
        text?: string;
        screenshot?: string;
        "screenshot@fullPage"?: string;
        rawHtml?: string;
        json?: any;
        [key: string]: any;
    };
}

// Template execution result
export interface TemplateExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    creditsCharged: number;
    metadata?: Record<string, any>;
}

// Template filters for querying
export interface TemplateFilters {
    tags?: string[];
    status?: string;
    reviewStatus?: string;
    createdBy?: string;
    difficulty?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

// Template list response
export interface TemplateListResponse {
    templates: TemplateConfig[];
    total: number;
    limit: number;
    offset: number;
}

// Cache entry
export interface CachedTemplate {
    template: TemplateConfig;
    timestamp: number;
}

// Sandbox execution context
export interface SandboxContext {
    template: TemplateConfig;
    executionContext: TemplateExecutionContext;
    variables: Record<string, any>;
    page?: any; // Page object from browser engines (Playwright/Puppeteer)
}

// Error types
export class TemplateError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = "TemplateError";
    }
}

export class TemplateNotFoundError extends TemplateError {
    constructor(templateId: string) {
        super(`Template not found: ${templateId}`, "TEMPLATE_NOT_FOUND");
    }
}

export class TemplateExecutionError extends TemplateError {
    constructor(message: string, public originalError?: Error) {
        super(message, "TEMPLATE_EXECUTION_ERROR");
    }
}

export class TemplateValidationError extends TemplateError {
    constructor(message: string) {
        super(message, "TEMPLATE_VALIDATION_ERROR");
    }
}

export class SandboxError extends TemplateError {
    constructor(message: string) {
        super(message, "SANDBOX_ERROR");
    }
}