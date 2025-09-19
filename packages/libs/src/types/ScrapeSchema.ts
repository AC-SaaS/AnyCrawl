import { z } from "zod";
import { baseSchema } from "./BaseSchema.js";

const pickedSchema = baseSchema.pick({
    url: true,
    template_id: true,
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
    options: {
        templateId: data.template_id,
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

export const TemplateScrapeSchema = scrapeSchema.transform((data: z.infer<typeof scrapeSchema>) => {
    const { templateId, ...optionsWithoutTemplate } = data.options;
    return {
        url: data.url,
        engine: data.engine,
        ...optionsWithoutTemplate,
    };
});

export type TemplateScrapeSchema = z.infer<typeof TemplateScrapeSchema>;
export type ScrapeSchema = z.infer<typeof scrapeSchema>;
