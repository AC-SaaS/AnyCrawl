import { describe, expect, it } from "@jest/globals";
import { jsonSchemaType } from "@anycrawl/libs";

describe('jsonSchemaType validation', () => {
    it('should validate a simple object schema', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name'],
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(true);
    });

    it('should validate a nested object schema', () => {
        const schema = {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        address: {
                            type: 'object',
                            properties: {
                                street: { type: 'string' },
                                city: { type: 'string' },
                            },
                        },
                    },
                },
            },
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(true);
    });

    it('should validate an array schema', () => {
        const schema = {
            type: 'array',
            properties: {
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                    },
                },
            },
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
        const schema = {
            type: 'invalid_type',
            properties: {
                name: { type: 'string' },
            },
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(false);
    });

    it('should reject invalid properties type', () => {
        const schema = {
            type: 'object',
            properties: 'invalid_properties',
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(false);
    });

    it('should reject invalid required field type', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
            required: 'name', // should be an array
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(false);
    });

    it('should validate schema', () => {
        const schema = {
            type: 'object',
            properties: {
                company_mission: {
                    type: 'string'
                },
                is_open_source: {
                    type: 'object',
                    properties: {
                        a: {
                            type: 'string'
                        },
                        v: {
                            type: 'boolean'
                        }
                    }
                },
                asd: {
                    type: 'number'
                }
            },
            required: ['company_mission']
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(true);
    });

    it('should validate schema', () => {
        const schema = {
            type: 'object',
            properties: {
                company_mission: {
                    type: 'string'
                },
                is_open_source: {
                    type: 'object',
                    properties: {
                        a: {
                            type: 'string'
                        },
                        v: {
                            type: 'boolean'
                        }
                    }
                },
                asd: {
                    type: 'number'
                }
            },
            required: ['company_mission']
        };

        const result = jsonSchemaType.safeParse(schema);
        expect(result.success).toBe(true);
    });
}); 