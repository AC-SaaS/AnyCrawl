import * as p from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

export const apiKey = p.pgTable("api_key", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // user uuid
    user: p.uuid("user"),
    // API key value - must be unique
    key: p.text("key").notNull().unique(),
    // Display name for the API key
    name: p.text("name").default("default"),
    // Whether the key is currently active
    isActive: p.boolean("is_active").notNull().default(true),
    // User/system that created this key
    createdBy: p.integer("created_by").default(-1),
    // Available credit balance
    credits: p.integer("credits").notNull().default(0),
    // Timestamp when the key was created
    createdAt: p.timestamp("created_at").notNull(),
    // Timestamp of last API key usage
    lastUsedAt: p.timestamp("last_used_at"),
    // Optional expiration timestamp
    expiresAt: p.timestamp("expires_at"),
});

export const requestLog = p.pgTable("request_log", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // API key that made the request
    apiKey: p.uuid("api_key_id").references(() => apiKey.uuid),
    // path that was called
    path: p.text("path").notNull(),
    // HTTP method used
    method: p.text("method").notNull(),
    // Response status code
    statusCode: p.integer("status_code").notNull(),
    // Request processing time in milliseconds
    processingTimeMs: p.real("processing_time_ms").notNull(),
    // Number of credits consumed
    creditsUsed: p.integer("credits_used").notNull().default(0),
    // Request IP address
    ipAddress: p.text("ip_address"),
    // User agent string
    userAgent: p.text("user_agent"),
    // Request body
    requestPayload: p.jsonb("request_payload"),
    // Request header
    requestHeader: p.jsonb("request_header"),
    // Response body
    responseBody: p.jsonb("response_body"),
    // Response header
    responseHeader: p.jsonb("response_header"),
    // Success or not
    success: p.boolean("success").notNull().default(true),
    // create at
    createdAt: p.timestamp("created_at").notNull(),
});

export const jobs = p.pgTable("jobs", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // job id
    jobId: p.text("job_id").notNull(),
    // job type
    jobType: p.text("job_type").notNull(),
    // job queue name
    jobQueueName: p.text("job_queue_name").notNull(),
    // job expire at
    jobExpireAt: p.timestamp("job_expire_at").notNull().$defaultFn(() => new Date(Date.now() + 3 * 60 * 60 * 1000)),
    // url
    url: p.text("url").notNull(),
    // payload from job
    payload: p.jsonb("payload"),
    // api key
    apiKey: p.uuid("api_key_id").references(() => apiKey.uuid),
    // total urls/pages found
    total: p.integer("total").notNull().default(0),
    // completed urls/pages
    completed: p.integer("completed").notNull().default(0),
    // failed urls/pages
    failed: p.integer("failed").notNull().default(0),
    // Number of credits consumed
    creditsUsed: p.integer("credits_used").notNull().default(0),
    // Origin, playground or api
    origin: p.text("origin").notNull(),
    // status of job
    status: p.text("status").notNull(),
    // job success or not
    isSuccess: p.boolean("is_success").notNull().default(false),
    // job error message
    errorMessage: p.text("error_message"),
    // job created at
    createdAt: p.timestamp("created_at").notNull(),
    // job updated at
    updatedAt: p.timestamp("updated_at").notNull(),
});

export const jobResults = p.pgTable("job_results", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // job uuid
    jobUuid: p.uuid("job_uuid").references(() => jobs.uuid),
    // url
    url: p.text("url").notNull(),
    // data
    data: p.jsonb("data"),
    // status
    status: p.text("status").notNull(),
    // created at
    createdAt: p.timestamp("created_at").notNull(),
    // updated at
    updatedAt: p.timestamp("updated_at").notNull(),
});

// Template system tables
export const templates = p.pgTable("templates", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // Template ID (business identifier)
    templateId: p.text("template_id").notNull().unique(),
    // Template name
    name: p.text("name").notNull(),
    // Template description
    description: p.text("description"),
    // Template tags (JSON array)
    tags: p.jsonb("tags").notNull(),
    // Template version
    version: p.text("version").notNull().default("1.0.0"),
    // Template type - determines which operation this template supports
    templateType: p.text("template_type").notNull().default("scrape"),
    // Pricing information (JSON): { perCall: number, currency: "credits" }
    pricing: p.jsonb("pricing").notNull(),
    // Request options configuration (JSON) - supports scrape, crawl, and search
    reqOptions: p.jsonb("req_options").notNull(),
    // Custom handlers code (JSON)
    customHandlers: p.jsonb("custom_handlers"),
    // Template metadata (JSON)
    metadata: p.jsonb("metadata").notNull(),
    // Template variables (JSON): { [key: string]: { type: string, description: string, required: boolean, defaultValue?: any } }
    variables: p.jsonb("variables"),
    // User information
    createdBy: p.text("created_by").notNull(),
    publishedBy: p.text("published_by"),
    reviewedBy: p.text("reviewed_by"),
    // Status fields
    status: p.text("status").default("draft").notNull(),
    reviewStatus: p.text("review_status").default("pending").notNull(),
    reviewNotes: p.text("review_notes"),
    // Trusted flag - if true, can use AsyncFunction with page object; if false, must use VM sandbox
    trusted: p.boolean("trusted").notNull().default(false),
    // Timestamps
    createdAt: p.timestamp("created_at").notNull(),
    updatedAt: p.timestamp("updated_at").notNull(),
    publishedAt: p.timestamp("published_at"),
    reviewedAt: p.timestamp("reviewed_at"),
    archivedAt: p.timestamp("archived_at"),
});

export const templateExecutions = p.pgTable("template_executions", {
    // Primary key with auto-incrementing ID
    uuid: p
        .uuid()
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    // Foreign key to templates
    templateUuid: p.uuid("template_uuid").notNull().references(() => templates.uuid),
    // API key that made the request
    apiKey: p.uuid("api_key_id").references(() => apiKey.uuid),
    // Job information
    jobUuid: p.uuid("job_uuid").references(() => jobs.uuid),
    // Request processing time in milliseconds
    processingTimeMs: p.real("processing_time_ms").notNull(),
    // Number of credits consumed
    creditsCharged: p.integer("credits_charged").default(0).notNull(),
    // Success or not
    success: p.boolean("success").notNull(),
    // Error message if failed
    errorMessage: p.text("error_message"),
    // Timestamp
    createdAt: p.timestamp("created_at").notNull(),
});