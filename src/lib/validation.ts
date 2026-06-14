import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signinSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Staff sign in under their restaurant's code (subdomain) with a username.
export const staffSigninSchema = z.object({
  code: z.string().min(1, "Restaurant code is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const restaurantTypeEnum = z.enum([
  "RESTAURANT",
  "CAFE",
  "HOTEL",
  "CLOUD_KITCHEN",
  "BAR",
]);

export const profileSchema = z.object({
  name: z.string().min(2, "Restaurant name is required").max(120),
  type: restaurantTypeEnum,
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(80).optional().or(z.literal("")),
  postalCode: z.string().max(12).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  orderConfirmation: z.enum(["AUTO", "WAITER_CONFIRM"]),
  paymentTiming: z.enum(["PAY_BEFORE", "PAY_AFTER"]),
  onlinePaymentEnabled: z.coerce.boolean(),
  counterPaymentEnabled: z.coerce.boolean(),
  gstMode: z.enum(["NONE", "INCLUSIVE", "EXCLUSIVE"]),
  gstNumber: z.string().max(20).optional().or(z.literal("")),
  gstPercentage: z.coerce.number().min(0).max(28),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(60),
  icon: z.string().max(8).optional(),
  station: z.enum(["KITCHEN", "BAR"]).default("KITCHEN"),
});

export const menuItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price must be positive"),
  categoryId: z.string().optional().or(z.literal("")),
  imageUrl: z.string().url("Enter a valid image URL").optional().or(z.literal("")),
  isVeg: z.coerce.boolean(),
  isAvailable: z.coerce.boolean(),
  isSpecialOfDay: z.coerce.boolean(),
  availableFrom: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  availableTo: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export const tableSchema = z.object({
  label: z.string().min(1, "Table label is required").max(40),
  seats: z.coerce.number().int().min(1).max(50),
  kind: z.enum(["TABLE", "ROOM"]).default("TABLE"),
});

export const placeOrderSchema = z.object({
  qrToken: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        optionIds: z.array(z.string()).optional(),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1, "Your cart is empty"),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(20).optional(),
  paymentMethod: z.enum(["ONLINE", "COUNTER"]).optional(),
  notes: z.string().max(300).optional(),
  // Ties this order to the diner's current dining session (rounds before the
  // bill is settled). Client-generated; reused across rounds.
  sessionId: z.string().min(6).max(64).optional(),
  // Best-effort device location at order time, used only to classify presence
  // (anti-fake-order). Never persisted as exact coordinates.
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const staffSchema = z.object({
  name: z.string().min(2, "Name is required").max(80),
  // Staff log in with a username (unique within the restaurant), not an email.
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["MANAGER", "CASHIER", "WAITER", "KITCHEN"]),
});

// Owner resets a staff member's password.
export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ActionState = { error?: string; ok?: boolean; message?: string };
