# Code Issues Report - CodeClash Server

This document outlines the issues identified in the codebase during code review.

---

## 1. Security Issues

### 1.1 CORS Configuration Too Permissive
**File:** `src/socket/socket.ts:19-21`
```typescript
cors: {
  origin: "*",
  credentials: true
}
```
**Issue:** Using `origin: "*"` with `credentials: true` is a security risk. This allows any origin to make credentialed requests, which can lead to CSRF attacks.
**Severity:** High

### 1.2 Missing Return Statement After `next()` in Login
**File:** `src/controllers/auth/login.ts:17-19`
```typescript
if (!email || !password) {
  next(new CustomError("Email and password are required", 400));
}
// Missing return statement - code continues executing
```
**Issue:** Missing `return` after calling `next()` allows code to continue executing, potentially causing issues.
**Severity:** Medium

### 1.3 Non-Atomic Environment Variable Check
**File:** `src/middlewares/verifyToken.ts:18`
```typescript
const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as DecodedToken;
```
**Issue:** Using non-null assertion (`!`) on environment variables without validation. If the variable is undefined, `jwt.verify` will throw a cryptic error.
**Severity:** Medium

---

## 2. Logic & Flow Control Issues

### 2.1 Response Sent Before Async Operation Completes
**File:** `src/controllers/auth/register.ts:53-58`
```typescript
sendOtpEmail(req, res, next);

res.status(201).send({
  success: true,
  message: "OTP sent to your email",
});
```
**Issue:** Response is sent immediately after calling `sendOtpEmail`, but before the OTP is actually sent. The response claims "OTP sent" but this isn't guaranteed.
**Severity:** Medium

### 2.2 Double Response in OTP Resend
**File:** `src/controllers/auth/otp.ts:219-220`
```typescript
sendOtpEmail(req, res, next);
res.status(200).json({ success: true, message: 'OTP sent to your email' });
```
**Issue:** `sendOtpEmail` may send a response (line 72), and then another response is sent on line 220. This causes "headers already sent" errors.
**Severity:** High

### 2.3 Promise.all with await Inside
**File:** `src/controllers/contest/submitSolution.ts:202-233`
```typescript
Promise.all([await prisma.contestParticipation.update({...}), await prisma.contestLeaderboard.upsert({...})])
```
**Issue:** Using `await` inside `Promise.all()` defeats the purpose of parallel execution. The operations run sequentially, not in parallel.
**Severity:** Low (Performance)

### 2.4 Missing Response in `logOutFromSession`
**File:** `src/controllers/user/user.ts:283-303`
```typescript
const logOutFromSession = async (req: CustomRequest, res: Response, next: NextFunction) => {
  // ... code ...
  await prisma.session.delete({
    where:{
      id:sessionId
    }
  })
  // Missing res.status(200).json() response!
}
```
**Issue:** The function deletes the session but never sends a response to the client, leaving the request hanging.
**Severity:** High

### 2.5 Unused `contest` Variable
**File:** `src/controllers/contest/submitSolution.ts:35-42`
```typescript
const contest = await prisma.contest.findFirst({
  where: {
    id: contestId,
    status: 'ONGOING',
    participants: { some: { userId } },
    questions: { some: { id: questionId } }
  }
});
// Variable `contest` is never used
```
**Issue:** Query is executed but result is never checked or used, wasting a database query.
**Severity:** Low (Performance)

---

## 3. Error Handling Issues

### 3.1 Synchronous File Operations in Error Handler
**File:** `src/middlewares/errorHandler.ts:13-18`
```typescript
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
if (!fs.existsSync(logFilePath)){
    fs.writeFileSync(logFilePath,"");
}
```
**Issue:** Using synchronous file operations (`existsSync`, `mkdirSync`, `writeFileSync`) blocks the event loop. In an error handler, this can compound performance issues.
**Severity:** Medium

### 3.2 Race Condition in OTP Creation
**File:** `src/controllers/auth/otp.ts:58-69`
```typescript
await Promise.allSettled([
  prisma.oTP.deleteMany({
    where: { email }
  }),
  prisma.oTP.create({
    data: { email, otp, expiresAt: ... }
  })
]);
```
**Issue:** Using `Promise.allSettled` means the delete and create run concurrently, creating a race condition. The new OTP might be created before old ones are deleted, and could potentially be deleted.
**Severity:** Medium

---

## 4. Validation Issues

### 4.1 Missing Authorization Check for Session Deletion
**File:** `src/controllers/user/user.ts:295-299`
```typescript
await prisma.session.delete({
  where:{
    id:sessionId
  }
})
```
**Issue:** No validation that the session belongs to the requesting user. A user could delete another user's session if they know the sessionId.
**Severity:** High (Security)

### 4.2 Missing Ban Check in `handleRunCode`
**File:** `src/controllers/contest/submitSolution.ts:17-57`
**Issue:** `handleRunCode` doesn't check if user is banned from contest before allowing code execution, unlike `handleSubmitCode` which does check.
**Severity:** Medium

### 4.3 Unused Import
**File:** `src/controllers/auth/oauth.ts:7`
```typescript
import { promise } from 'zod';
```
**Issue:** `promise` is imported but never used.
**Severity:** Low

### 4.4 Syntax Error in OAuth Callback
**File:** `src/controllers/auth/oauth.ts:16`
```typescript
if (err) {``
```
**Issue:** There are random backticks after the condition which is invalid syntax (though TypeScript might not catch this if it's treated as an empty template literal).
**Severity:** Low

### 4.5 Schema Validation Fields Are Optional
**File:** `src/middlewares/schemaValidation.ts:6-25`
```typescript
const baseSchema = z.object({
  username: z.string().min(3, "...").optional(),
  email: z.string().min(6, "...").email("...").optional(),
  password: z.string().min(8, "...").optional(),
}).strict();
```
**Issue:** All fields are marked as `optional()`, which means validation passes even if fields are missing. This is likely unintentional for required fields.
**Severity:** Medium

---

## 5. Potential Memory Leaks & Resource Issues

### 5.1 setTimeout Without Cleanup
**File:** `src/socket/handlers/game.ts:165-197`
```typescript
setTimeout(async () => {
  try {
    // ... cleanup code ...
  } catch (error) {
    console.error('Abandonment check error:', error);
  }
}, 60000);
```
**Issue:** `setTimeout` is created but never cleaned up if the match ends normally. Additionally, if the server restarts, these timers are lost and abandonments won't be processed.
**Severity:** Medium

### 5.2 Recursive setTimeout in Matchmaking
**File:** `src/socket/services/matchmakingService.ts:136`
```typescript
setTimeout(() => findMatch(io, socket), QUEUE_CHECK_INTERVAL);
```
**Issue:** Creates repeated timeouts without cleanup. If a player disconnects while in queue, these timeouts continue executing.
**Severity:** Medium

### 5.3 Commented Out Validation Check
**File:** `src/socket/handlers/matchmaking.ts:32-35`
```typescript
// if (ongoingMatch) {
//   socket.emit('matchmaking_error', { message: 'You are already in an ongoing match' });
//   return;
// }
```
**Issue:** Important validation to prevent users from joining matchmaking while already in a match is commented out.
**Severity:** Medium

---

## 6. Database Query Issues

### 6.1 Missing Pagination Total Count Query
**File:** `src/controllers/admin/contest.ts:193-194`
```typescript
const totalSubmissions = contestSubmissions.length;
```
**Issue:** `totalSubmissions` is calculated from the paginated array length, not from a separate count query. This means pagination metadata will always show the page size as total, not the actual total count.
**Severity:** Medium

### 6.2 N+1 Query Potential in Leaderboard Ranks
**File:** `src/controllers/contest/leaderboard.ts:198-205`
```typescript
await prisma.$transaction(
  leaderboard.map((entry, index) =>
    prisma.contestLeaderboard.update({
      where: { id: entry.id },
      data: { rank: index + 1 }
    })
  )
);
```
**Issue:** Creates N separate update queries in a transaction instead of using a bulk update or raw SQL. For large leaderboards, this is inefficient.
**Severity:** Low (Performance)

---

## 7. Type Safety Issues

### 7.1 Type Assertion Without Validation
**File:** `src/controllers/user/user.ts:85`
```typescript
const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password as string);
```
**Issue:** `user.password` could be null (for OAuth users), but it's cast to `string` without checking. This could cause bcrypt to crash.
**Severity:** Medium

### 7.2 Non-null Assertion on Winner/Loser
**File:** `src/socket/handlers/game.ts:84-85`
```typescript
const winner = match.players.find(p => p.id === winnerId)!;
const loser = match.players.find(p => p.id !== winnerId)!;
```
**Issue:** Using `!` asserts these will always find values, but if winnerId is invalid or if there's only one player, this will throw.
**Severity:** Medium

---

## 8. Configuration Issues

### 8.1 Hardcoded Values
**File:** `src/socket/services/matchmakingService.ts:9-11`
```typescript
const RATING_RANGE = 200;
const QUEUE_CHECK_INTERVAL = 5000;
const MAX_QUEUE_TIME = 30000;
```
**Issue:** These matchmaking parameters are hardcoded and should be configurable via environment variables for easier tuning.
**Severity:** Low

### 8.2 GitHub OAuth Handler Not Properly Exported
**File:** `src/controllers/auth/oauth.ts:29-33`
```typescript
const startGithubOauth = () => {
  passport.authenticate("github", {
    scope: ["user:email"],
  });
};
```
**Issue:** This function doesn't return anything or use the Express request/response objects. It's not a proper middleware function and won't work correctly.
**Severity:** High

---

## 9. Code Quality Issues

### 9.1 Inconsistent Error Handling Patterns
Throughout the codebase, there are inconsistent patterns:
- Some functions use `throw new CustomError()`
- Some use `next(new CustomError())` with `return`
- Some use `next(new CustomError())` without `return`

**Recommendation:** Standardize on one approach (preferably `throw` with async middleware pattern).

### 9.2 Console.log Statements in Production Code
Multiple files contain `console.log` debugging statements:
- `src/socket/handlers/matchmaking.ts:13`
- `src/socket/handlers/game.ts:41`
- `src/socket/socket.ts:37, 40, 44, 49, 54, 60, 64, 69`

**Issue:** Debug logging should use a proper logging library with log levels.
**Severity:** Low

### 9.3 UAParser Import Not Used
**File:** `src/controllers/auth/login.ts:6`
```typescript
import {UAParser} from "ua-parser-js";
```
**Issue:** UAParser is imported but never used in this file.
**Severity:** Low

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 6     |
| Medium   | 14    |
| Low      | 8     |

### Critical Issues to Address First:
1. Missing response in `logOutFromSession`
2. Double response in OTP resend
3. Missing authorization check for session deletion
4. CORS configuration security
5. GitHub OAuth handler not working
6. Missing return after `next()` in login
