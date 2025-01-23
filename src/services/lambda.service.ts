import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import parse from 'json-parse-better-errors';

interface CodeExecutionPayload {
  code: string;
  language: string;
  input: string;
  timeout: number;
  taskId: string;
  userId: string;
}

interface LambdaResponse {
  body?: {
    output?: string;
  },
  output?: string;
  error?: string;
  executionTime?: number;
  memory?: number;
}

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function invokeLambda(payload: CodeExecutionPayload): Promise<LambdaResponse> {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.LAMBDA_FUNCTION_NAME!,
      Payload: Buffer.from(JSON.stringify(payload))
    });

    const { Payload } = await lambda.send(command);
    const responseText = Buffer.from(Payload as Uint8Array).toString();
    const parsedResponse = parse(responseText);
    const parsedBody = parse(parsedResponse.body);

    return {
      body: parsedBody,
      output: parsedBody?.output,
      error: parsedBody?.error,
      executionTime: parsedBody?.executionTime,
      memory: parsedBody?.memory
    };
  } catch (error) {
    console.error('Lambda invocation failed:', error);
    throw error;
  }
} 