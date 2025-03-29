import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis({
    host:'redis',
    port:6379,
    maxRetriesPerRequest:null
});
const runQueueEvents = new QueueEvents("runQueue", { connection });
const submitQueueEvents = new QueueEvents("submitQueue", { connection });

const runQueue = new Queue("runQueue", {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});

const submitQueue = new Queue("submitQueue", {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
})

export { runQueue, submitQueue,runQueueEvents,submitQueueEvents };