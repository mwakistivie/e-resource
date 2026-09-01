import { z } from "zod";

export const checkoutSchema = z.object({
  resourceId: z.string().min(1),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Enter a valid email"),
  // Accepts 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
  phone: z
    .string()
    .trim()
    .regex(/^(\+?254|0)?[71]\d{8}$/, "Enter a valid Safaricom/Kenyan number"),
});

export const resourceInputSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  resourceType: z.string(),
  subject: z.string().min(2),
  gradeLevel: z.string().min(1),
  term: z.string().optional(),
  priceKsh: z.number().int().positive(),
  isBundle: z.boolean().default(false),
  bundleChildIds: z.array(z.string()).optional(),
});
