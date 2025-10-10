import { z } from "zod";
import { baseSchema } from "./BaseSchema.js";

const pickedSchema = baseSchema.pick({
    url: true,
    template_id: true,
    variables: true,
    engine: true,
    proxy: true,
    formats: true,
    timeout: true,
    retry: true,
    wait_for: true,
    include_tags: true,
    exclude_tags: true,
    json_options: true,
    extract_source: true,
});

export const scrapeSchema = pickedSchema.transform((data: z.infer<typeof pickedSchema>) => ({
    url: data.url,
    engine: data.engine,
    templateVariables: data.variables,
    options: {
        template_id: data.template_id,
        proxy: data.proxy,
        formats: data.formats,
        timeout: data.timeout,
        retry: data.retry,
        wait_for: data.wait_for,
        include_tags: data.include_tags,
        exclude_tags: data.exclude_tags,
        json_options: data.json_options,
        extract_source: data.extract_source,
    }
}));

// create a template schema that inherits scrapeSchema but all attributes are optional
const templateScrapeInputSchema = baseSchema
    .pick({
        url: true,
        engine: true,
        proxy: true,
        formats: true,
        timeout: true,
        retry: true,
        wait_for: true,
        include_tags: true,
        exclude_tags: true,
        json_options: true,
        extract_source: true,
    })
    .partial(); // to make all attributes optional

export const TemplateScrapeSchema = templateScrapeInputSchema;

export type TemplateScrapeSchema = z.infer<typeof TemplateScrapeSchema>;
export type ScrapeSchema = z.infer<typeof scrapeSchema>;
