import { getTemplate, getDB, schemas, eq } from "@anycrawl/db";
import { AVAILABLE_ENGINES } from "@anycrawl/scrape";
import { TemplateClient } from "@anycrawl/template-client";
import { mergeOptionsWithTemplate } from "./optionMerger.js";
import { TemplateScrapeSchema, TemplateCrawlSchema, TemplateSearchSchema } from "@anycrawl/libs";
import { RequestWithAuth } from "@anycrawl/libs";

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
     * Check if user has permission to use template
     * @param template - The template configuration
     * @param currentUserId - Current user ID from API key
     * @returns true if user has permission, false otherwise
     */
    private static hasTemplateAccess(template: any, currentUserId?: string): boolean {
        // If current request API key has no associated user, any template can be used
        if (!currentUserId) {
            return true;
        }

        const templateCreatedBy = template.createdBy;

        // If template creator equals current user, access is allowed
        if (templateCreatedBy === currentUserId) {
            return true;
        }

        const templateStatus = template.status;
        const templateReviewStatus = template.reviewStatus;
        // If template creator doesn't match current user, but status is published and review status is approved, access is allowed
        if (templateStatus === 'published' || templateReviewStatus === 'approved') {
            return true;
        }

        // If template creator doesn't match current user, and status is not published or review status is not approved, access is denied
        return false;
    }

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
     * @param currentUserId - Current user ID from API key
     * @param options - Processing options
     * @returns TemplateProcessingResult
     */
    public static async processTemplate(
        templateId: string,
        url: string,
        requestOptions: any,
        templateType: "scrape" | "crawl" | "search",
        currentUserId?: string,
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

            // Check template access permission
            if (!this.hasTemplateAccess(template, currentUserId)) {
                return {
                    success: false,
                    error: `Access denied: You don't have permission to use this template`
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
     * @param currentUserId - Current user ID from API key
     * @returns TemplateProcessingResult
     */
    public static async processScrapeTemplate(
        templateId: string,
        url: string,
        requestOptions: any,
        currentUserId?: string
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url, requestOptions, "scrape", currentUserId, {
            validateDomain: true,
            mergeOptions: true,
            validateEngine: true
        });
    }

    /**
     * Get template options for merging before schema parse
     * @param templateId - The template ID
     * @param templateType - The template type
     * @param currentUserId - Current user ID from API key
     * @returns Template options for merging
     */
    public static async getTemplateOptionsForMerge(
        templateId: string,
        templateType: "scrape" | "crawl" | "search",
        currentUserId?: string
    ): Promise<{ success: boolean; templateOptions?: TemplateScrapeSchema | TemplateCrawlSchema | TemplateSearchSchema; error?: string }> {
        try {
            const templateClient = this.getTemplateClient();
            const template = await templateClient.getTemplate(templateId);

            if (!template) {
                return {
                    success: false,
                    error: `Template not found: ${templateId}`
                };
            }

            // Check template access permission
            if (!this.hasTemplateAccess(template, currentUserId)) {
                return {
                    success: false,
                    error: `Access denied: You don't have permission to use this template`
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
     * @param currentUserId - Current user ID from API key
     * @returns TemplateProcessingResult
     */
    public static async processCrawlTemplate(
        templateId: string,
        url: string,
        crawlOptions: any,
        currentUserId?: string
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url, crawlOptions, "crawl", currentUserId, {
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
     * @param currentUserId - Current user ID from API key
     * @param options - Additional options
     * @returns TemplateProcessingResult
     */
    public static async processSearchTemplate(
        templateId: string,
        url: string | null,
        searchOptions: any,
        currentUserId?: string,
        options: {
            validateDomain?: boolean;
            validateEngine?: boolean;
        } = {}
    ): Promise<TemplateProcessingResult> {
        return this.processTemplate(templateId, url || '', searchOptions, "search", currentUserId, {
            validateDomain: options.validateDomain ?? false, // Search doesn't need domain validation
            mergeOptions: true,
            validateEngine: options.validateEngine ?? true
        });
    }
}
