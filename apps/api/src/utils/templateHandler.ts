import { getTemplate } from "@anycrawl/db";
import { AVAILABLE_ENGINES } from "@anycrawl/scrape";
import { TemplateClient } from "@anycrawl/template-client";
import { mergeOptionsWithTemplate } from "./optionMerger.js";
import { ScrapeOptions, CrawlOptions, SearchOptions } from "@anycrawl/libs";

/**
 * Template processing result
 */
export interface TemplateProcessingResult {
    success: boolean;
    engineName?: string;
    mergedOptions?: any;
    error?: string;
}

/**
 * Template handler for processing template-related logic
 */
export class TemplateHandler {
    private static templateClient: TemplateClient | null = null;

    /**
     * Get or create TemplateClient instance (singleton)
     */
    private static getTemplateClient(): TemplateClient {
        if (!this.templateClient) {
            this.templateClient = new TemplateClient();
        }
        return this.templateClient;
    }
    /**
     * Process template for a given request
     * @param templateId - The template ID
     * @param url - The URL to validate against domain restrictions
     * @param requestOptions - Options from the request
     * @param templateType - Expected template type (scrape, crawl, search)
     * @param options - Processing options
     * @returns TemplateProcessingResult
     */
    public static async processTemplate(
        templateId: string,
        url: string,
        requestOptions: any,
        templateType: "scrape" | "crawl" | "search",
        options: {
            validateDomain?: boolean;
            mergeOptions?: boolean;
            validateEngine?: boolean;
        } = {}
    ): Promise<TemplateProcessingResult> {
        const {
            validateDomain = true,
            mergeOptions = true,
            validateEngine = true
        } = options;

        try {
            // Get template from database
            const template = await getTemplate(templateId);
            if (!template) {
                return {
                    success: false,
                    error: `Template not found: ${templateId}`
                };
            }

            // Validate template type
            if (template.templateType !== templateType) {
                return {
                    success: false,
                    error: `Template type mismatch: expected ${templateType}, got ${template.templateType}`
                };
            }

            // Get the appropriate options for the template type
            const templateOptions = this.getTemplateOptionsForType(template, templateType);
            if (!templateOptions) {
                return {
                    success: false,
                    error: `No options found for template type: ${templateType}`
                };
            }

            // Validate engine if required
            if (validateEngine && templateOptions.engine) {
                if (!AVAILABLE_ENGINES.includes(templateOptions.engine)) {
                    return {
                        success: false,
                        error: `Invalid template engine: ${templateOptions.engine}`
                    };
                }
            }

            // Validate domain restrictions if required
            if (validateDomain) {
                const templateClient = this.getTemplateClient();
                const domainValidation = templateClient.validateDomainRestrictions(template, url);
                if (!domainValidation.isValid) {
                    return {
                        success: false,
                        error: `Domain validation failed: ${domainValidation.error}`
                    };
                }
            }

            // Merge options if required
            let mergedOptions = requestOptions;
            if (mergeOptions) {
                mergedOptions = mergeOptionsWithTemplate(
                    templateOptions as any,
                    requestOptions
                );
            }

            return {
                success: true,
                engineName: templateOptions.engine,
                mergedOptions
            };
        } catch (error) {
            return {
                success: false,
                error: `Template processing failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Get template options for a specific type
     * @param template - The template configuration
     * @param templateType - The template type
     * @returns Template options for the specified type
     */
    private static getTemplateOptionsForType(template: any, templateType: "scrape" | "crawl" | "search"): any {
        const reqOptions = template.reqOptions || {};

        // With the new structure, reqOptions directly contains the type-specific options
        // No need to extract from nested objects
        return reqOptions;
    }

    /**
     * Process template for scrape operations
     * @param templateId - The template ID
     * @param url - The URL to validate
     * @param requestOptions - Request options
     * @returns TemplateProcessingResult
     */
    public static async processScrapeTemplate(
        templateId: string,
        url: string,
        requestOptions: any
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url, requestOptions, "scrape", {
            validateDomain: true,
            mergeOptions: true,
            validateEngine: true
        });
    }

    /**
     * Get template options for merging before schema parse
     * @param templateId - The template ID
     * @param templateType - The template type
     * @returns Template options for merging
     */
    public static async getTemplateOptionsForMerge(
        templateId: string,
        templateType: "scrape" | "crawl" | "search"
    ): Promise<{ success: boolean; templateOptions?: ScrapeOptions | CrawlOptions | SearchOptions; error?: string }> {
        try {
            const templateClient = this.getTemplateClient();
            const template = await templateClient.getTemplate(templateId);

            if (!template) {
                return {
                    success: false,
                    error: `Template not found: ${templateId}`
                };
            }

            // Validate template type
            if (template.templateType !== templateType) {
                return {
                    success: false,
                    error: `Template type mismatch. Expected: ${templateType}, got: ${template.templateType}`
                };
            }

            const templateOptions = this.getTemplateOptionsForType(template, templateType);
            if (!templateOptions) {
                return {
                    success: false,
                    error: `No options found for template type: ${templateType}`
                };
            }

            return {
                success: true,
                templateOptions
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get template: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Process template for crawl operations
     * @param templateId - The template ID
     * @param url - The URL to validate
     * @param crawlOptions - Crawl options to merge
     * @returns TemplateProcessingResult
     */
    public static async processCrawlTemplate(
        templateId: string,
        url: string,
        crawlOptions: any
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url, crawlOptions, "crawl", {
            validateDomain: true,
            mergeOptions: true,
            validateEngine: true
        });
    }

    /**
     * Process template for search operations
     * @param templateId - The template ID
     * @param url - The URL to validate (optional for search)
     * @param searchOptions - Search options to merge
     * @param options - Additional options
     * @returns TemplateProcessingResult
     */
    public static async processSearchTemplate(
        templateId: string,
        url: string | null,
        searchOptions: any,
        options: {
            validateDomain?: boolean;
            validateEngine?: boolean;
        } = {}
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url || '', searchOptions, "search", {
            validateDomain: options.validateDomain ?? false, // Search doesn't need domain validation
            mergeOptions: true,
            validateEngine: options.validateEngine ?? true
        });
    }
}
