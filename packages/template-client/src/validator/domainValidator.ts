import { minimatch } from "minimatch";

/**
 * Domain restriction configuration
 */
export interface DomainRestriction {
    type: "glob" | "exact";
    patterns: string[];
}

/**
 * Domain validation result
 */
export interface DomainValidationResult {
    isValid: boolean;
    error?: string;
    code?: string;
}

/**
 * Domain validator for template domain restrictions
 */
export class DomainValidator {
    /**
     * Validate if a URL is allowed based on domain restrictions
     * @param url - The URL to validate
     * @param domainRestriction - Domain restriction configuration
     * @returns DomainValidationResult
     */
    public static validateDomain(url: string, domainRestriction?: DomainRestriction): DomainValidationResult {
        try {
            if (!domainRestriction || !domainRestriction.patterns || domainRestriction.patterns.length === 0) {
                return {
                    isValid: true
                };
            }

            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            let isAllowed = false;

            for (const pattern of domainRestriction.patterns) {
                if (domainRestriction.type === 'exact') {
                    // Exact match
                    if (hostname === pattern.toLowerCase()) {
                        isAllowed = true;
                        break;
                    }
                } else if (domainRestriction.type === 'glob') {
                    // Glob pattern match
                    if (minimatch(hostname, pattern.toLowerCase())) {
                        isAllowed = true;
                        break;
                    }
                }
            }

            if (!isAllowed) {
                return {
                    isValid: false,
                    error: `Domain '${hostname}' is not allowed for this template. Allowed patterns: ${domainRestriction.patterns.join(', ')}`,
                    code: 'DOMAIN_NOT_ALLOWED'
                };
            }

            return {
                isValid: true
            };
        } catch (error) {
            return {
                isValid: false,
                error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`,
                code: 'INVALID_URL'
            };
        }
    }

    /**
     * Parse domain patterns from template metadata
     * @param allowedDomains - Allowed domains from template metadata
     * @returns DomainRestriction or undefined
     */
    public static parseDomainRestriction(allowedDomains: any): DomainRestriction | undefined {
        if (!allowedDomains || typeof allowedDomains !== 'object') {
            return undefined;
        }

        // Handle different formats of allowedDomains
        if (Array.isArray(allowedDomains)) {
            return {
                type: 'exact',
                patterns: allowedDomains
            };
        }

        if (allowedDomains.patterns && Array.isArray(allowedDomains.patterns)) {
            return {
                type: allowedDomains.type || 'exact',
                patterns: allowedDomains.patterns
            };
        }

        return undefined;
    }
}
