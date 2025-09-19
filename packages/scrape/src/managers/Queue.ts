import { Job, Queue, Worker } from "bullmq";
import { log } from "crawlee";
import { randomUUID } from "node:crypto";
import { Utils } from "../Utils.js";
import type { EngineType } from "./EngineQueue.js";

export interface RequestTaskOptions {
    headless?: boolean;
    proxy?: string;
    formats?: string[];
    timeout?: number;
    retry?: boolean;
    waitFor?: number;
    includeTags?: string[];
    excludeTags?: string[];
    extractSource?: "html" | "markdown";
}

export interface CrawlOptions {
    excludePaths?: string[];
    includePaths?: string[];
    maxDepth: number;
    limit: number;
    strategy: string;
    scrape_options?: RequestTaskOptions;
}

export interface RequestTask {
    url: string;
    engine: EngineType;
    queueName?: QueueName;
    options?: RequestTaskOptions | CrawlOptions;
    // New fields for crawl support
    type?: 'scrape' | 'crawl';
    crawlJobId?: string;
    // Template support fields
    templateId?: string;
    templateVariables?: Record<string, any>;
}

export type QueueName = "scrape" | "crawl" | string;
export class QueueManager {
    private static instance: QueueManager;
    private queues: Map<string, Queue> = new Map();

    private constructor() { }

    /**
     * Get the singleton instance of QueueManager
     */
    public static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }

    /**
     * Get or create a queue with the specified name
     * @param name Name of the queue
     * @param age How long to keep completed/failed jobs in seconds
     * @returns Queue instance
     */
    public getQueue(name: QueueName, age: number = 3600): Queue {
        if (!this.queues.has(name)) {
            const queue = new Queue(name, {
                connection: Utils.getInstance().getRedisConnection(),
                defaultJobOptions: {
                    removeOnComplete: {
                        age: age,
                    },
                    removeOnFail: {
                        age: age,
                    },
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 1000,
                    },
                },
            });
            this.queues.set(name, queue);
            log.info(`Queue ${name} created.`);
        }
        return this.queues.get(name)!;
    }

    /**
     * Get a job from a specific queue
     * @param queueName Name of the queue
     * @param jobId ID of the job
     * @returns Job instance
     */
    public getJob(queueName: QueueName, jobId: string): Promise<Job | undefined> {
        const queue = this.getQueue(queueName);
        return queue.getJob(jobId);
    }

    /**
     * Add a job to a specific queue
     * @param queueName Name of the queue
     * @param data Job data
     */
    public async addJob(queueName: QueueName, data: RequestTask): Promise<string> {
        const queue = this.getQueue(queueName);
        const jobId = randomUUID();
        log.info(`Adding job to queue ${queueName} with jobId ${jobId}`);
        data.queueName = queueName;
        await queue.add(queueName, data, {
            jobId,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000,
            },
        });
        return jobId;
    }

    /**
     * Cancel a job in a specific queue
     * @param queueName Name of the queue
     * @param jobId ID of the job
     */
    public async cancelJob(queueName: QueueName, jobId: string): Promise<void> {
        const queue = this.getQueue(queueName);
        await queue.remove(jobId);
    }

    /**
     * Get the number of jobs in a specific queue
     * @param queueName Name of the queue
     * @returns Number of jobs in the queue
     */
    public async getJobCount(queueName: QueueName): Promise<number> {
        const queue = this.getQueue(queueName);
        const counts = await queue.getJobCounts();
        return (counts.active || 0) + (counts.waiting || 0) + (counts.delayed || 0);
    }

    /**
     * Close all queues
     */
    public async closeAll(): Promise<void> {
        for (const [name, queue] of this.queues) {
            await queue.close();
            log.info(`Queue ${name} closed.`);
        }
        this.queues.clear();
    }

    /**
     * Get the status of a specific job
     * @param queueName Name of the queue
     * @param jobId ID of the job
     * @returns Job status and data
     */
    public async getJobStatus(
        queueName: QueueName,
        jobId: string
    ): Promise<{ status: string; task_status: string; data: any } | null> {
        const job = await this.getJob(queueName, jobId);

        if (!job) {
            return null;
        }

        const state = await job.getState();
        return {
            status: state,
            task_status: job.data.status,
            data: job.data,
        };
    }

    /**
     * Check if a job is done. A job is done if it is completed or failed.
     * @param queueName Name of the queue
     * @param jobId ID of the job
     * @returns True if the job is done, false otherwise
     */
    public async isJobDone(queueName: QueueName, jobId: string): Promise<boolean> {
        const state = await this.getJobStatus(queueName, jobId);
        return (
            state?.status === "completed" &&
            (state?.task_status === "completed" || state?.task_status === "failed")
        );
    }

    /**
     * Get the data of a specific job
     * @param queueName Name of the queue
     * @param jobId ID of the job
     * @returns Job data
     */
    public async getJobData(queueName: QueueName, jobId: string): Promise<any> {
        const job = await this.getJob(queueName, jobId);
        return job?.data;
    }

    /**
     * Wait for a job to be totally completed
     * @param queueName Name of the queue
     * @param jobId ID of the job
     * @param timeout Timeout in seconds
     * @returns Job data
     */
    public async waitJobDone(
        queueName: QueueName,
        jobId: string,
        timeout: number = 30000
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                log.error(`[${queueName}] checkJob: ${jobId} timed out after ${timeout} seconds`);
                reject(new Error(`Job ${jobId} timed out after ${timeout} seconds`));
            }, timeout);

            const checkJob = async () => {
                try {
                    const isJobDone = await QueueManager.getInstance().isJobDone(queueName, jobId);
                    if (isJobDone) {
                        clearTimeout(timeoutId);
                        const data = await QueueManager.getInstance().getJobData(queueName, jobId);
                        log.info(`[${queueName}] checkJob: ${jobId} done`);
                        resolve(data);
                    } else {
                        // Add delay between checks to reduce CPU usage
                        setTimeout(checkJob, 100); // Check every 100ms
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    log.error(`[${queueName}] checkJob: ${jobId} failed: ${error}`);
                    reject(error);
                }
            };

            checkJob();
        });
    }
}
