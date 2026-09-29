"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSelfProfile } from "@/actions/user";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

const profileSchema = z.object({
  phoneNumber: z.string().optional().or(z.literal("")),
  bloodGroup: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  emergencyContactRelation: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

interface ProfileDialogProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    dateOfBirth?: Date | null;
    joiningDate?: Date | null;
    phoneNumber?: string | null;
    bloodGroup?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ user, open, onOpenChange }: ProfileDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phoneNumber: user.phoneNumber || "",
      bloodGroup: user.bloodGroup || "",
      dateOfBirth: user.dateOfBirth ? format(new Date(user.dateOfBirth), "yyyy-MM-dd") : "",
      emergencyContactName: user.emergencyContactName || "",
      emergencyContactPhone: user.emergencyContactPhone || "",
      emergencyContactRelation: user.emergencyContactRelation || "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    setIsPending(true);
    try {
      const result = await updateSelfProfile({
        phoneNumber: values.phoneNumber,
        bloodGroup: values.bloodGroup,
        dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth) : undefined,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
        emergencyContactRelation: values.emergencyContactRelation,
        password: values.password || undefined,
      });

      if (result.success) {
        toast.success("Profile updated successfully");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col animate-scale-in p-0 overflow-hidden border-border/80 shadow-2xl rounded-md">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/60 bg-muted/20">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">Profile Settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
            Manage your personal information and security settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              <div className="space-y-6 pb-2">
                {/* Section 1: Official Information (Read-only) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Official Records</span>
                    <Separator className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 p-3 rounded-md bg-muted/20 border border-border/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Full Name</p>
                      <p className="text-xs font-semibold text-foreground">{user.name}</p>
                    </div>
                    <div className="space-y-1 p-3 rounded-md bg-muted/20 border border-border/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Work Email</p>
                      <p className="text-xs font-semibold text-foreground">{user.email}</p>
                    </div>
                    <div className="space-y-1 p-3 rounded-md bg-muted/20 border border-border/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Joining Date</p>
                      <p className="text-xs font-semibold text-foreground">
                        {user.joiningDate ? format(new Date(user.joiningDate), "dd MMMM yyyy") : "Not Set"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 font-medium px-1">Official details are managed by HR. Please contact administration for corrections.</p>
                </div>

                {/* Section 2: Personal Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Personal Details</span>
                    <Separator className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={10} placeholder="98XXXXXXXX" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                          <FormMessage className="text-xs font-medium" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                          <FormMessage className="text-xs font-medium" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bloodGroup"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Blood Group</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. O+" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                          <FormMessage className="text-xs font-medium" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Section 3: Emergency Contact */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Emergency Contact</span>
                    <Separator className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter Name" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={10} placeholder="98XXXXXXXX" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emergencyContactRelation"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">Relationship</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Spouse" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Section 4: Security */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Security</span>
                    <Separator className="flex-1 h-px bg-border/60" />
                  </div>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 max-w-sm">
                        <FormLabel className="text-xs font-semibold text-foreground">New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} placeholder="Leave blank to keep current" className="h-9 text-xs rounded-md bg-background border-border/80 focus:ring-primary/20" />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground/60 font-medium px-0.5">Ensure your password is at least 6 characters long.</p>
                        <FormMessage className="text-xs font-medium" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 shrink-0 border-t border-border/60 bg-muted/10">
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:justify-end">
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="h-9 text-xs font-semibold border-border/80 rounded-md">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="h-9 px-6 text-xs font-semibold rounded-md shadow-xs transition-all">
                  {isPending ? <Spinner className="size-3.5 mr-2" /> : null}
                  Save Profile Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
