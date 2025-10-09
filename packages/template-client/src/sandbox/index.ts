import type { SandboxContext } from "@anycrawl/libs";
import { SandboxError } from "../errors/index.js";
import { createContext, Script } from "vm";

export interface SandboxConfig {
    timeout: number; // Execution timeout in milliseconds
    memoryLimit: number; // Memory limit in MB
    maxWorkers: number; // Maximum number of worker threads
}

/**
 * NodeVM Sandbox - Secure code execution environment using Node.js built-in vm
 */
export class QuickJSSandbox {
    private config: SandboxConfig;

    constructor(config?: Partial<SandboxConfig>) {
        this.config = {
            timeout: config?.timeout || 5000, // 5 seconds default
            memoryLimit: config?.memoryLimit || 64, // 64MB default
            maxWorkers: config?.maxWorkers || 5,
        };
    }

    /**
     * Execute code in sandbox using Node.js vm
     */
    async executeCode(code: string, context: SandboxContext): Promise<any> {
        try {
            // Create sandbox context with direct object access
            const sandbox = {
                // Direct access to context objects
                context: {
                    data: context.executionContext,
                    page: context.page,
                    template: context.template,
                    variables: context.variables
                },

                // Individual objects for easier access
                template: context.template,
                variables: context.variables,
                page: context.page,

                // Console for debugging
                console: {
                    log: (...args: any[]) => {
                        console.log('[SANDBOX]', ...args);
                    },
                    error: (...args: any[]) => {
                        console.error('[SANDBOX]', ...args);
                    },
                    warn: (...args: any[]) => {
                        console.warn('[SANDBOX]', ...args);
                    }
                },

                // Utility objects
                JSON: JSON,
                Math: Math,
                Date: Date,
                RegExp: RegExp,
                Error: Error,
                TypeError: TypeError,
                ReferenceError: ReferenceError,
                SyntaxError: SyntaxError,
                Promise: Promise,

                // Additional utilities
                setTimeout: setTimeout,
                setInterval: setInterval,
                clearTimeout: clearTimeout,
                clearInterval: clearInterval
            };

            // Create a contexified sandbox object
            const vmContext = createContext(sandbox);

            // Wrap code in async function to allow return statements and await
            const wrappedCode = `
                (async function() {
                    ${code}
                })()
            `;

            // Compile and execute the code with timeout
            const script = new Script(wrappedCode, {
                filename: 'template-code.js'
            });

            const resultPromise = script.runInContext(vmContext, {
                timeout: this.config.timeout,
                displayErrors: true
            });

            // Await the result if it's a Promise
            const result = resultPromise instanceof Promise ? await resultPromise : resultPromise;

            return {
                success: true,
                result: result,
                context: context.executionContext,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new SandboxError(`Code execution failed: ${errorMessage}`);
        }
    }

    /**
     * Validate code before execution
     */
    async validateCode(code: string): Promise<boolean> {
        try {
            // Create a minimal sandbox for validation
            const sandbox = {
                console: { log: () => { }, error: () => { }, warn: () => { } },
                JSON: JSON,
                Math: Math,
                Date: Date,
                RegExp: RegExp,
                Error: Error,
                Promise: Promise
            };

            // Create a contexified sandbox object
            const vmContext = createContext(sandbox);

            // Try to compile the code without executing (as async function)
            const wrappedCode = `
                (async function() {
                    ${code}
                })
            `;

            // Compile the script to validate syntax
            new Script(wrappedCode);

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new SandboxError(`Code validation failed: ${errorMessage}`);
        }
    }

    /**
     * Get sandbox statistics
     */
    getStats(): { activeWorkers: number; maxWorkers: number } {
        return {
            activeWorkers: 0, // TODO: Implement worker tracking
            maxWorkers: this.config.maxWorkers,
        };
    }
}