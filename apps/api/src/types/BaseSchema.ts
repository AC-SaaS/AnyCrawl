import { z } from "zod";
import { ALLOWED_ENGINES, SCRAPE_FORMATS, EXTRACT_SOURCES } from "@anycrawl/scrape/constants";

export { ALLOWED_ENGINES, SCRAPE_FORMATS, EXTRACT_SOURCES };

// Define the recursive JSON Schema type
export const jsonSchemaType: z.ZodType<any> = z.lazy(() =>
    z.object({
        type: z.enum(["object", "array", "string", "number", "boolean", "null"]),
        // For object schemas
        properties: z.record(jsonSchemaType).optional(),
        required: z.array(z.string()).optional(),
        // For array schemas
        items: z.union([jsonSchemaType, z.array(jsonSchemaType)]).optional(),
        // Helpful hints for LLM extraction
        description: z.string().optional(),
    })
);

// define json options schema
export const jsonOptionsSchema = z.object({
    /**
     * The JSON schema to be used for extracting structured data
     */
    schema: jsonSchemaType.optional(),

    /**
     * The user prompt to be used for extracting structured data
     */
    user_prompt: z.string().optional(),
    schema_name: z.string().optional(),
    schema_description: z.string().optional(),
}).strict();

// define base schema
export const baseSchema = z.object({
    /**
     * Template ID to use for this crawl
     */
    template_id: z.string().optional(),
    /**
     * The URL to be processed
     */
    url: z.string().url(),

    /**
     * The engine to be used
     */
    engine: z.enum(ALLOWED_ENGINES).default("cheerio"),

    /**
     * The proxy to be used
     */
    proxy: z.string().url().optional(),

    /**
     * The formats to be used
     */
    formats: z.array(z.enum(SCRAPE_FORMATS)).default(["markdown"]),

    /**
     * The timeout to be used
     */
    timeout: z.number().min(1000).max(600_000).default(300_000),

    /**
     * The wait for to be used
     */
    wait_for: z.number().min(1).max(60_000).optional(),

    /**
     * The retry to be used
     */
    retry: z.boolean().default(false),

    /**
     * The include tags to be used
     */
    include_tags: z.array(z.string()).optional(),

    /**
     * The exclude tags to be used
     */
    exclude_tags: z.array(z.string()).optional(),

    /**
     * The JSON options to be used for extracting structured data
     */
    json_options: jsonOptionsSchema.optional(),

    /**
     * The source format to use for JSON extraction (html or markdown)
     */
    extract_source: z.enum(EXTRACT_SOURCES).default("markdown"),
});

export type BaseSchema = z.infer<typeof baseSchema>;

export type JsonSchemaType = z.infer<typeof jsonSchemaType>;