import type { TemplateConfig } from "@anycrawl/libs";
import { TemplateValidationError } from "../errors/index.js";

/**
 * Template Code Validator - Validates template code for security and syntax
 */
export class TemplateCodeValidator {
    /**
     * Validate template code
     */
    async validateCode(code: string, template: TemplateConfig): Promise<void> {
        // 1. Basic syntax check
        this.validateSyntax(code);

        // 2. Security check
        this.validateSecurity(code);

        // 3. Complexity check
        this.validateComplexity(code);
    }

    /**
     * Validate JavaScript/TypeScript syntax
     */
    private validateSyntax(code: string): void {
        try {
            // Wrap code in async function to allow await syntax, same as sandbox execution
            const wrappedCode = `
                (async function() {
                    ${code}
                })
            `;
            // Basic syntax validation using Function constructor
            new Function(wrappedCode);
        } catch (error) {
            throw new TemplateValidationError(`Invalid syntax: ${(error as Error).message}`);
        }
    }

    /**
     * Validate code security
     */
    private validateSecurity(code: string): void {
        const dangerousPatterns = [
            { pattern: /eval\s*\(/g, message: "eval() is not allowed" },
            { pattern: /Function\s*\(/g, message: "Function constructor is not allowed" },
            { pattern: /setTimeout\s*\(/g, message: "setTimeout is not allowed" },
            { pattern: /setInterval\s*\(/g, message: "setInterval is not allowed" },
            { pattern: /process\./g, message: "process object is not allowed" },
            { pattern: /require\s*\(/g, message: "require() is not allowed" },
            { pattern: /import\s+/g, message: "import statements are not allowed" },
            { pattern: /fs\./g, message: "fs module is not allowed" },
            { pattern: /child_process/g, message: "child_process module is not allowed" },
        ];

        for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(code)) {
                throw new TemplateValidationError(`Security violation: ${message}`);
            }
        }
    }

    /**
     * Validate code complexity
     */
    private validateComplexity(code: string): void {
        // Check code length
        if (code.length > 10000) {
            throw new TemplateValidationError("Code too long (max 10000 characters)");
        }

        // Check nesting depth
        const maxNestingDepth = 10;
        let currentDepth = 0;
        let maxDepth = 0;

        for (const char of code) {
            if (char === "{" || char === "(" || char === "[") {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === "}" || char === ")" || char === "]") {
                currentDepth--;
            }
        }

        if (maxDepth > maxNestingDepth) {
            throw new TemplateValidationError(`Code nesting too deep (max ${maxNestingDepth} levels)`);
        }

        // Check loop count
        const loopPatterns = [
            /for\s*\(/g,
            /while\s*\(/g,
            /do\s*{/g,
        ];

        let totalLoops = 0;
        for (const pattern of loopPatterns) {
            const matches = code.match(pattern);
            if (matches) {
                totalLoops += matches.length;
            }
        }

        if (totalLoops > 10) {
            throw new TemplateValidationError("Too many loops (max 10)");
        }
    }
}