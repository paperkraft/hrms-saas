import * as z from "zod";

export const leaveApplicationSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  duration: z.enum(["FULL", "HALF", "SHORT"], {
    required_error: "Please select a leave duration.",
  }),
  category: z.enum(["MONTHLY_POLICY_1", "SEMI_ANNUAL_POLICY_2", "UNPAID"], {
    required_error: "Please select which policy to deduct this leave from.",
  }),
  leaveType: z.enum(["CASUAL", "MEDICAL"]).nullable().optional(),
  reason: z.string().min(8, "Please provide a reason (minimum 8 characters).").max(500),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  halfDayType: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional().nullable(),
}).refine((data) => {
  // Requirement: Monthly leaves need a type (Casual or Medical)
  if (data.category === "MONTHLY_POLICY_1" && !data.leaveType) return false;
  return true;
}, {
  message: "Please select a leave type (Casual or Medical) for Monthly leave.",
  path: ["leaveType"],
}).refine((data) => {
  // HALF Leave Enforcement: Requires First/Second selection
  if (data.duration === "HALF" && !data.halfDayType) return false;
  return true;
}, {
  message: "Please select which half of the day you are taking leave for.",
  path: ["halfDayType"],
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
}).refine((data) => {
  // Block starting on a Sunday
  const start = new Date(data.startDate);
  return start.getDay() !== 0;
}, {
  message: "Leave applications cannot start on a Sunday.",
  path: ["startDate"],
}).refine((data) => {
  // Block ending on a Sunday
  const end = new Date(data.endDate);
  return end.getDay() !== 0;
}, {
  message: "Leave applications cannot end on a Sunday.",
  path: ["endDate"],
}).refine((data) => {
  // Business Logic Enforcement: Semi-Annual leaves are only FULL days.
  if (data.category === "SEMI_ANNUAL_POLICY_2" && data.duration !== "FULL") {
    return false;
  }
  return true;
}, {
  message: "Semi-Annual leaves (Policy 2) can only be taken as Full days.",
  path: ["duration"],
}).refine((data) => {
  // SHORT Leave Enforcement: Time range required and max 2 hours
  if (data.duration === "SHORT") {
    if (!data.startTime || !data.endTime) return false;
    
    // Ensure same day
    if (data.startDate !== data.endDate) return false;

    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    const totalStartM = startH * 60 + startM;
    const totalEndM = endH * 60 + endM;
    
    const diff = totalEndM - totalStartM;
    // Must be positive and <= 120 minutes (2 hours)
    return diff > 0 && diff <= 120;
  }
  return true;
}, {
  message: "Short leave requires a start/end time on the same day, not exceeding 2 hours.",
  path: ["startTime"],
});

export type LeaveApplicationValues = z.infer<typeof leaveApplicationSchema>;