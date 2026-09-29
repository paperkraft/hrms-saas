"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Trash2 } from "lucide-react";
import { createPolicy, updatePolicy, deletePolicy } from "@/actions/policy";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface PolicyManagementDialogProps {
  policy?: any;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function PolicyManagementDialog({ policy, trigger, onSuccess }: PolicyManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>(policy?.content || "");

  useEffect(() => {
    if (open) {
      setContent(policy?.content || "");
    }
  }, [open, policy]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      category: (formData.get("category") as string) || "Attendance & Leave",
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      content: content,
      requirements: [],
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      order: parseInt(formData.get("order") as string) || 0
    };

    try {
      const res = policy
        ? await updatePolicy(policy.id, data)
        : await createPolicy(data);

      if (res.success) {
        toast.success(policy ? "Policy updated" : "Policy created");
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(res.error || "Operation failed");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest border-primary/20 hover:bg-primary/5">
            {policy ? "Edit Policy" : "Add New Policy"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl p-0 overflow-hidden border-border bg-card rounded-md shadow-xl flex flex-col max-h-[90vh] gap-0">
        <DialogHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20 gap-0">
          <DialogTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            {policy ? "Edit Company Policy" : "Create New Company Policy"}
          </DialogTitle>
          <DialogDescription className="sr-only" />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <form id="policy-form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
                <Input name="category" defaultValue={policy?.category || "Attendance & Leave"} required placeholder="e.g. Code of Conduct" className="h-9 text-xs rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Title</Label>
                <Input name="title" defaultValue={policy?.title} required placeholder="e.g. Workplace Ethics & Standards" className="h-9 text-xs rounded-md" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Description (Short Summary)</Label>
              <Input name="description" defaultValue={policy?.description} required placeholder="Brief summary of the policy purpose and scope..." className="h-9 text-xs rounded-md" />
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col">
              <Label className="text-xs font-semibold text-muted-foreground">Policy Content</Label>
              <div className="flex-1 overflow-hidden min-h-[220px]">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write the complete policy details here..."
                />
              </div>
            </div>

            <div className="w-full sm:w-36 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Display Order</Label>
              <Input type="number" name="order" defaultValue={policy?.order || 0} className="h-9 text-xs rounded-md" />
            </div>
          </form>
        </div>

        <div className="p-3.5 sm:p-4 border-t border-border/70 bg-muted/10 flex items-center justify-between gap-2">
          {policy ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (confirm("Are you sure you want to delete this policy?")) {
                  const res = await deletePolicy(policy.id);
                  if (res.success) {
                    toast.success("Policy deleted");
                    setOpen(false);
                    onSuccess?.();
                  }
                }
              }}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md cursor-pointer h-9 px-2.5"
            >
              <Trash2 className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Delete Policy</span>
              <span className="sm:hidden">Delete</span>
            </Button>
          ) : <div />}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="h-9 text-xs font-medium rounded-md">
              Cancel
            </Button>
            <Button form="policy-form" type="submit" disabled={loading} className="h-9 px-4 sm:px-6 bg-primary text-primary-foreground text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer">
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <><Save className="size-3.5 mr-1.5" /> {policy ? "Update" : "Publish"}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
