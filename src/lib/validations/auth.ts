import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid company email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

export type LoginValues = z.infer<typeof loginSchema>;