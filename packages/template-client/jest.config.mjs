const config = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    globals: {
        "ts-jest": {
            useESM: true,
        },
    },
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    module: "ESNext",
                    moduleResolution: "node",
                    target: "ES2022",
                },
            },
        ],
    },
    transformIgnorePatterns: [
        "node_modules/(?!(@anycrawl|@tootallnate|drizzle-orm)/)",
    ],
    testMatch: ["**/__tests__/**/*.test.ts"],
    verbose: true,
    collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/*.test.{ts,tsx}",
        "!src/**/*.spec.{ts,tsx}",
        "!src/__tests__/**/*",
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
};

export default config;