import { z, ZodSchema } from "zod";
import { NextFunction, Request, Response } from "express";
import { CustomError } from "../types";

const baseSchema = z.object({
  name: z
    .string()
    .min(3, "Name should be more than 3 characters.")
    .optional(),
  email: z
    .string()
    .min(6, "Email must be at least 6 characters long.")
    .email("Invalid email format.")
    .optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/\d/, "Password must contain at least one number.")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character."
    )
    .optional(),
}).strict();

export const registerSchema = baseSchema.pick({
  name: true,
  email: true,
  password: true,
});

export const loginSchema = baseSchema.pick({
  email: true,
  password: true,
});

export const resetPasswordSchema = baseSchema.pick({
  password: true,
});

export const changePasswordSchema = z.object({
  oldPassword: baseSchema.shape.password.optional(),
  newPassword: baseSchema.shape.password,
});

// function to validate the request body against the schema
export const validateRequest =  <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body); 
      next(); 
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map((e) => e.message).join(", ");
        next(new CustomError(errorMessage, 400)); 
        next(new CustomError("Validation failed", 400));
      }
    }
  };
};
