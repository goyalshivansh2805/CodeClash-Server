export interface Problem {
  id: string;
  title: string;
  description: string;
  rating: number; 
  testCases: TestCase[];
}

export interface TestCase {
  input: string;
  output: string;
  isHidden: boolean;
}

export interface SubmissionResult {
  success: boolean;
  output?: string;
  error?: string;
  testCasesPassed?: number;
  totalTestCases?: number;
  executionTime?: number;
}

export interface PlayerState {
  userId: string;
  problemsSolved: number;
  solvedProblems: Set<string>;
  lastSubmission?: Date;
} 