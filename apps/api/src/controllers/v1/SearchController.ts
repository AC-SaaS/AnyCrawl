import { Response } from "express";
import { z } from "zod";
import { SearchService } from "@anycrawl/search/SearchService";
import { log } from "@anycrawl/libs/log";
import { searchSchema } from "../../types/SearchSchema.js";
import { RequestWithAuth } from "../../types/Types.js";
import { randomUUID } from "crypto";
import { STATUS, createJob, insertJobResult, completedJob, failedJob, updateJobCounts, JOB_RESULT_STATUS } from "@anycrawl/db";
import { QueueManager } from "@anycrawl/scrape";
export class SearchController {
    private searchService: SearchService;

    constructor() {
        this.searchService = new SearchService();
        // Initialize crawler in constructor
        this.initializeCrawler().catch((error) => {
            log.error(`Failed to initialize crawler: ${error}`);
        });
    }

    private async initializeCrawler() {
        try {
            await this.searchService.initializeCrawler();
            log.info("Crawler initialized successfully");
        } catch (error) {
            log.error(`Error initializing crawler: ${error}`);
            throw error;
        }
    }

    public handle = async (req: RequestWithAuth, res: Response): Promise<void> => {
        let searchJobId: string | null = null;
        let engineName: string | null = null;
        try {
            // Validate request body against searchSchema
            const validatedData = searchSchema.parse(req.body);

            // Execute search and wait for results
            engineName = validatedData.engine ?? "google";

            // Create job for search request (pending)
            searchJobId = randomUUID();
            await createJob({
                job_id: searchJobId,
                job_type: "search",
                job_queue_name: `search-${engineName}`,
                url: `search:${validatedData.query}`,
                req,
                status: STATUS.PENDING,
            });
            req.jobId = searchJobId;

            const expectedPages = validatedData.pages || 1;
            let pagesProcessed = 0;
            let failedPages = 0;
            let successPages = 0;

            let scrapeJobIds: string[] = [];
            const scrapeJobCreationPromises: Promise<void>[] = [];
            const scrapeCompletionPromises: Promise<{ url: string; data: any }>[] = [];
            let completedScrapeCount = 0;
            // Global scrape limit control (if limit provided)
            const shouldLimitScrape = typeof validatedData.limit === 'number' && validatedData.limit > 0;
            let remainingScrape = shouldLimitScrape ? (validatedData.limit as number) : Number.POSITIVE_INFINITY;

            const results = await this.searchService.search(engineName, {
                query: validatedData.query,
                limit: validatedData.limit,
                offset: validatedData.offset,
                pages: expectedPages,
                lang: validatedData.lang,
                // country: validatedData.country,
            }, async (page, pageResults, _uniqueKey, success) => {
                console.log(pageResults)
                try {
                    pagesProcessed += 1;
                    if (!success) {
                        failedPages += 1;
                        // Record a failed page entry (single record per page)
                        await insertJobResult(
                            searchJobId!,
                            `search:${engineName}:${validatedData.query}:page:${page}`,
                            { page, query: validatedData.query, results: [] },
                            JOB_RESULT_STATUS.FAILED
                        );
                    } else {
                        if (validatedData.scrape_options) {
                            const scrapeOptions = validatedData.scrape_options;
                            const engineForScrape = scrapeOptions.engine!;
                            // Respect global limit across pages
                            const allowedCount = Math.max(0, Math.min(pageResults.length, remainingScrape));
                            const toProcess = shouldLimitScrape ? pageResults.slice(0, allowedCount) : pageResults;
                            for (const result of toProcess) {
                                if (!result.url) continue; // Ensure url is a string for RequestTask
                                const resultUrl = result.url as string;
                                const jobPayload = {
                                    url: resultUrl,
                                    engine: engineForScrape,
                                    options: {
                                        ...scrapeOptions,
                                    },
                                };
                                const createTask = (async () => {
                                    const scrapeJobId = await QueueManager.getInstance().addJob(`scrape-${engineForScrape}`, jobPayload);
                                    await createJob({
                                        job_id: scrapeJobId,
                                        job_type: 'scrape',
                                        job_queue_name: `scrape-${engineForScrape}`,
                                        url: resultUrl,
                                        req,
                                        status: STATUS.PENDING,
                                    });
                                    scrapeJobIds.push(scrapeJobId);
                                    // prepare wait-for-completion promise for this job
                                    scrapeCompletionPromises.push((async () => {
                                        const job = await QueueManager.getInstance().waitJobDone(
                                            `scrape-${engineForScrape}`,
                                            scrapeJobId,
                                            scrapeOptions.timeout || 60_000
                                        );
                                        // only merge when status is completed
                                        if (!job || job.status !== 'completed' || job.error) {
                                            return { url: resultUrl, data: null };
                                        }
                                        const { uniqueKey, queueName, options, engine, url: _url, type: _type, status: _status, ...jobData } = job as any;
                                        return { url: resultUrl, data: jobData };
                                    })());
                                })();
                                scrapeJobCreationPromises.push(createTask);
                                if (shouldLimitScrape) remainingScrape -= 1;
                                if (remainingScrape <= 0) break;
                            }
                        }
                        successPages += 1;
                        // Insert a single record for this page with aggregated results
                        await insertJobResult(
                            searchJobId!,
                            `search:${engineName}:${validatedData.query}:page:${page}`,
                            { page, query: validatedData.query, results: pageResults },
                            JOB_RESULT_STATUS.SUCCESS
                        );
                    }

                    // Update job counts based on pages for progress
                    await updateJobCounts(searchJobId!, { total: expectedPages, completed: successPages, failed: failedPages });
                } catch (e) {
                    log.error(`Per-page handler error for job_id=${searchJobId}: ${e instanceof Error ? e.message : String(e)}`);
                }
            });
            // Ensure all scrape jobs have been enqueued before waiting for completion, then enrich results with scrape data
            await Promise.all(scrapeJobCreationPromises);
            if (scrapeCompletionPromises.length > 0) {
                log.info(`Waiting for ${scrapeCompletionPromises.length} scrape jobs to complete, ${scrapeJobIds.join(", ")}`);
                const completedScrapes = await Promise.all(scrapeCompletionPromises);
                const successfulScrapes = completedScrapes.filter(({ data }) => Boolean(data));
                completedScrapeCount = successfulScrapes.length;
                const urlToScrapeData = new Map<string, any>(successfulScrapes
                    .map(({ url, data }) => [url, data])
                );
                for (const r of results as any[]) {
                    if (r && r.url) {
                        const data = urlToScrapeData.get(r.url);
                        if (data) Object.assign(r, data);
                    }
                }
            }
            // credits: pages + one per successfully completed scrape job (if any)
            try {
                const pageCredits = validatedData.pages ?? 1;
                const scrapeCredits = validatedData.scrape_options ? completedScrapeCount : 0;
                req.creditsUsed = pageCredits + scrapeCredits;
            } catch {
                req.creditsUsed = validatedData.pages ?? 1;
            }

            // Mark job status based on page results
            try {
                if (failedPages >= expectedPages) {
                    await failedJob(
                        searchJobId,
                        `All pages failed (${failedPages}/${expectedPages})`,
                        false,
                        { total: expectedPages, completed: successPages, failed: failedPages }
                    );
                } else {
                    await completedJob(searchJobId, true, { total: expectedPages, completed: successPages, failed: failedPages });
                }
            } catch (e) {
                log.error(`Failed to mark job final status for job_id=${searchJobId}: ${e instanceof Error ? e.message : String(e)}`);
            }
            res.json({
                success: true,
                data: results,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                    code: err.code,
                }));

                res.status(400).json({
                    success: false,
                    error: "Validation error",
                    details: {
                        issues: formattedErrors,
                        messages: error.errors.map((err) => err.message),
                    },
                });
            } else {
                if (searchJobId) {
                    try {
                        await failedJob(searchJobId, error instanceof Error ? error.message : "Unknown error", false, { total: 0, completed: 0, failed: 0 });
                    } catch (e) {
                        log.error(`Failed to mark job failed for job_id=${searchJobId}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                }
                res.status(500).json({
                    success: false,
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error occurred",
                });
            }
        }
    };
}
