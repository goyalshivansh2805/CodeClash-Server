import { Worker } from "bullmq";
import { connection } from "./queues";
import { invokeLambda } from "../services/lambda.service";

const runWorker = new Worker("runQueue",
    async(job)=>{
        const {code,language,input,timeout,taskId,userId} = job.data;
        return await invokeLambda({
            code,
            language,
            input,
            timeout: timeout || 5,
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
      const { code, language, input, timeout, taskId, userId } = job.data;
      return await invokeLambda({
        code,
        language,
        input,
        timeout:timeout || 5,
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