import { Worker } from "bullmq";
import { connection } from "./queues";
import { invokeLambda } from "../services/lambda.service";

const runWorker = new Worker("runQueue",
    async(job)=>{
        const {code,language,input,timeoutMs,taskId,userId} = job.data;
        return await invokeLambda({
            code,
            language,
            input,
            timeoutMs: timeoutMs || 5000,
            taskId,
            userId
          });
    },
    {
        connection,
        concurrency:200
    }
);


const submitWorker = new Worker('submitQueue',
    async (job) => {
      const { code, language, input, timeoutMs, taskId, userId } = job.data;
      return await invokeLambda({
        code,
        language,
        input,
        timeoutMs:timeoutMs || 5000,
        taskId,
        userId
      });
    },
    {
      connection,
      concurrency: 300,
    }
  );

runWorker.on('failed', (job, err) => {
    console.error(`Run Job ${job?.id} failed:`, err);
});

submitWorker.on('failed', (job, err) => {
    console.error(`Submit Job ${job?.id} failed:`, err);
});