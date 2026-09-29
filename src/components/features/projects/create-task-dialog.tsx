"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Label,
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, CalendarIcon, Loader2, Paperclip, X, ListTodo, Layers, FileText, Users, Calendar as CalendarIconLucide, Flag } from "lucide-react"
import { createTask, getAllTasksForMention } from "@/actions/projects/tasks"
import { removeOrphanedAttachment } from "@/actions/attachments"
import { getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { WorkloadPanel } from "@/components/features/projects/workload-panel"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Task name is required"),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  plannedStart: z.date().optional(),
  plannedEnd: z.date().optional(),
  plannedDuration: z.coerce.number().min(0, "Duration cannot be negative").optional(),
  activity: z.string().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().min(1, "Project is required"),
  reviewerId: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  attachmentSize: z.number().optional().nullable(),
  attachments: z.any().optional(),
  mentionedUserIds: z.array(z.string()).optional()
})

interface CreateTaskDialogProps {
  projectId?: string;
  projects?: { id: string; name: string }[];
  members: { id: string; name: string | null; departmentId?: string | null }[];
  isTLorAdmin: boolean;
  departments?: any[];
  currentUserId: string;
  userDepartment?: string;
  allMembers?: any[];
  isExternal?: boolean;
}

export function CreateTaskDialog({
  projectId,
  projects = [],
  members,
  isTLorAdmin,
  departments = [],
  currentUserId,
  userDepartment,
  allMembers = [],
  isExternal,
}: CreateTaskDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const initialParentDeptId = useMemo(() => {
    if (isExternal && departments.length > 0) {
      return departments[0].id
    }
    if (!userDepartment) return null
    const found = departments.find((d: any) => d.id === userDepartment)
    return found?.parentDepartmentId || found?.id || userDepartment
  }, [userDepartment, departments, isExternal])

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(initialParentDeptId)
  const [watchedAssigneeId, setWatchedAssigneeId] = useState<string>(currentUserId || "")
  const [hideWorkloadPanel, setHideWorkloadPanel] = useState(false)

  const [attachments, setAttachments] = useState<{ url: string; name: string; size: number }[]>([])
  const [uploadProgresses, setUploadProgresses] = useState<Record<string, number>>({})
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({})
  const uploadAbortedRef = useRef(false)

  const [mentionedUsers, setMentionedUsers] = useState<{ id: string; name: string }[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [taskMentionQuery, setTaskMentionQuery] = useState<string | null>(null)
  const [projectTasks, setProjectTasks] = useState<{ id: string; name: string; taskNumber: number }[]>([])
  const [showCloseWarning, setShowCloseWarning] = useState(false)

  useEffect(() => {
    if (open) {
      getAllTasksForMention().then(res => {
        if (res.success && res.data) {
          setProjectTasks(res.data)
        }
      })
    }
  }, [open])

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    uploadAbortedRef.current = false;
    const newFiles = Array.from(files);

    for (const file of newFiles) {
      if (uploadAbortedRef.current) break;

      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgresses(prev => ({ ...prev, [fileId]: 0 }));

      try {
        const xhr = new XMLHttpRequest();
        xhrRefs.current[fileId] = xhr;

        const uploadPromise = new Promise<{ url: string; name: string; size: number }>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgresses(prev => ({ ...prev, [fileId]: progress }));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                if (response.success && response.url) {
                  resolve({ url: response.url, name: file.name, size: file.size });
                } else {
                  reject(new Error(response.error || "Upload failed"));
                }
              } catch (e) {
                reject(new Error("Invalid server response"));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          const formData = new FormData();
          formData.append("file", file);
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        const uploadedAttachment = await uploadPromise;
        setAttachments(prev => [...prev, uploadedAttachment]);
        setUploadProgresses(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
        delete xhrRefs.current[fileId];
      } catch (err: any) {
        if (!uploadAbortedRef.current) {
          toast.error(`Failed to upload ${file.name}: ${err.message}`);
        }
        setUploadProgresses(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
        delete xhrRefs.current[fileId];
      }
    }

    setIsUploadingAttachment(false);
    if (e.target) e.target.value = "";
  };

  const handleCancelAttachmentUpload = () => {
    uploadAbortedRef.current = true;
    Object.values(xhrRefs.current).forEach(xhr => xhr.abort());
    xhrRefs.current = {};
    setUploadProgresses({});
    setIsUploadingAttachment(false);
    toast.info("File upload cancelled");
  };

  const handleCancelSingleAttachmentUpload = (fileId: string) => {
    if (xhrRefs.current[fileId]) {
      xhrRefs.current[fileId].abort();
      delete xhrRefs.current[fileId];
    }
    setUploadProgresses(prev => {
      const updated = { ...prev };
      delete updated[fileId];
      return updated;
    });
  };

  const handleRemovePreviewAttachment = async (idx: number, url: string) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    try {
      await removeOrphanedAttachment(url);
    } catch (error) {
      console.error("Failed to delete orphaned attachment:", error);
    }
  };

  const parentDepartments = useMemo(() => {
    if (isExternal) {
      return departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        totalTemplates: (d.taskMasters || []).length,
        taskMasters: d.taskMasters || []
      }))
    }
    return departments
      .filter((d: any) => !d.parentDepartmentId)
      .map((d: any) => {
        const directTemplates = d.taskMasters || []
        let totalTemplates = directTemplates.length

        departments.forEach((sub: any) => {
          if (sub.parentDepartmentId === d.id) {
            totalTemplates += (sub.taskMasters || []).length
          }
        })

        return {
          id: d.id,
          name: d.name,
          totalTemplates,
          taskMasters: directTemplates
        }
      })
  }, [departments, isExternal])

  const availableTemplates = useMemo(() => {
    if (!selectedDepartmentId) return []

    if (selectedDepartmentId === "ALL") {
      if (isExternal) return []
      const all: any[] = []
      departments.forEach((d: any) => {
        const parent = d.parentDepartment || departments.find((p: any) => p.id === d.parentDepartmentId)
        const deptLabel = parent ? `${parent.name} › ${d.name}` : d.name
        ;(d.taskMasters || []).forEach((t: any) => {
          all.push({
            ...t,
            departmentName: deptLabel,
            sourceDeptId: d.id,
            isSubDept: !!parent
          })
        })
      })
      return all
    }

    const familyDeptIds = new Set<string>()
    familyDeptIds.add(selectedDepartmentId)
    departments.forEach((d: any) => {
      if (d.parentDepartmentId === selectedDepartmentId || d.id === selectedDepartmentId) {
        familyDeptIds.add(d.id)
      }
    })

    const templates: any[] = []
    departments.forEach((d: any) => {
      if (familyDeptIds.has(d.id)) {
        const isChildSub = d.parentDepartmentId === selectedDepartmentId
        const deptLabel = isChildSub ? `${d.name}` : d.name
        ;(d.taskMasters || []).forEach((t: any) => {
          templates.push({
            ...t,
            departmentName: deptLabel,
            sourceDeptId: d.id,
            isSubDept: isChildSub
          })
        })
      }
    })

    return templates.sort((a, b) => {
      if (!a.isSubDept && b.isSubDept) return -1
      if (a.isSubDept && !b.isSubDept) return 1
      return a.name.localeCompare(b.name)
    })
  }, [selectedDepartmentId, departments])

  const canAssignOthers = isExternal ? (members && members.length > 1) : isTLorAdmin

  const filteredMembers = useMemo(() => {
    if (isExternal) {
      return (members || []).map((m: any) => {
        const dept = departments.find((d: any) => d.id === m.departmentId)
        return {
          ...m,
          deptBadge: dept?.name || null,
          isSubDeptMember: !!dept?.parentDepartmentId
        }
      })
    }

    const memberPool = (allMembers && allMembers.length > 0) ? allMembers : (members || [])

    let list = memberPool
    if (selectedDepartmentId && selectedDepartmentId !== "ALL") {
      const familyDeptIds = new Set<string>()
      familyDeptIds.add(selectedDepartmentId)
      departments.forEach((d: any) => {
        if (d.parentDepartmentId === selectedDepartmentId || d.id === selectedDepartmentId) {
          familyDeptIds.add(d.id)
        }
      })

      list = memberPool.filter((m: any) => m.departmentId && familyDeptIds.has(m.departmentId))
    }

    if (isTLorAdmin && currentUserId && !list.some((m: any) => m.id === currentUserId)) {
      const currentUser = memberPool.find((m: any) => m.id === currentUserId) || members.find((m: any) => m.id === currentUserId)
      if (currentUser) {
        list = [currentUser, ...list]
      }
    }

    const uniqueMap = new Map<string, any>()
    list.forEach((m: any) => {
      if (m.id && !uniqueMap.has(m.id)) {
        const dept = departments.find((d: any) => d.id === m.departmentId)
        const isSub = !!dept?.parentDepartmentId
        const deptBadge = dept ? dept.name : ""
        uniqueMap.set(m.id, {
          ...m,
          deptBadge,
          isSubDeptMember: isSub
        })
      }
    })

    return Array.from(uniqueMap.values())
  }, [members, allMembers, selectedDepartmentId, departments, currentUserId, isTLorAdmin])

  const crossDeptReviewers = useMemo(() => {
    const listToUse = allMembers && allMembers.length > 0 ? allMembers : (members || [])
    const reviewers = listToUse.filter((m: any) =>
      (m.role === "ADMIN" || m.ledDepartment != null) && m.id !== watchedAssigneeId
    )

    return reviewers
  }, [allMembers, members, watchedAssigneeId])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      assignedToId: currentUserId || "",
      priority: "MEDIUM",
      plannedDuration: 0,
      activity: "",
      departmentId: userDepartment || "",
      projectId: projectId || (projects.length === 1 ? projects[0].id : ""),
      reviewerId: "DEFAULT",
      plannedStart: new Date(),
    },
  })

  useEffect(() => {
    if (open) {
      if (isExternal && departments.length > 0 && !selectedDepartmentId) {
        setSelectedDepartmentId(departments[0].id)
      }
      if ((isExternal || projects.length === 1) && (!form.getValues("projectId") || form.getValues("projectId") === "")) {
        const defaultProjId = projectId || projects[0]?.id || ""
        if (defaultProjId) {
          form.setValue("projectId", defaultProjId)
        }
      }
    }
  }, [open, isExternal, departments, selectedDepartmentId, projects, projectId, form])

  const handleTemplateSelect = (templateId: string) => {
    const template = availableTemplates.find((t: any) => t.id === templateId)

    if (template) {
      form.setValue("name", template.name)
      form.setValue("activity", template.activity || "")
      form.setValue("departmentId", template.departmentId || template.sourceDeptId || selectedDepartmentId || "")
      form.setValue("plannedDuration", template.defaultDurationDays || 0)

      const start = form.getValues("plannedStart")
      if (start && template.defaultDurationDays !== undefined && template.defaultDurationDays !== null) {
        form.setValue("plannedEnd", addDays(start, Number(template.defaultDurationDays)))
      }
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const dataToSubmit = {
      ...values,
      attachments: attachments.length > 0 ? attachments : undefined,
      mentionedUserIds: mentionedUsers.map(u => u.id)
    };
    if (dataToSubmit.reviewerId === "DEFAULT") {
      dataToSubmit.reviewerId = null;
    }
    const result = await createTask(dataToSubmit)
    if (result.success) {
      toast.success("Task created successfully")
      setOpen(false)
      form.reset({
        name: "",
        description: "",
        assignedToId: currentUserId || "",
        priority: "MEDIUM",
        plannedDuration: 0,
        activity: "",
        departmentId: userDepartment || "",
        projectId: projectId || "",
        reviewerId: "DEFAULT",
        plannedStart: new Date(),
      })
      setSelectedDepartmentId(userDepartment || null)
      setWatchedAssigneeId(currentUserId || "")
      setAttachments([])
      setMentionedUsers([])
      setHideWorkloadPanel(false)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to create task")
    }
    setIsSubmitting(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (attachments.length > 0 || Object.keys(uploadProgresses).length > 0) {
        setShowCloseWarning(true);
        return;
      }
      form.reset({
        name: "",
        description: "",
        assignedToId: currentUserId || "",
        priority: "MEDIUM",
        plannedDuration: 0,
        activity: "",
        departmentId: userDepartment || "",
        projectId: projectId || "",
        plannedStart: new Date(),
      })
      setSelectedDepartmentId(userDepartment || null)
      setWatchedAssigneeId(currentUserId || "")
      setAttachments([])
      setMentionedUsers([])
      setMentionQuery(null)
      setTaskMentionQuery(null)
      setHideWorkloadPanel(false)
    }
    setOpen(newOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer gap-1.5 shrink-0">
            <Plus className="size-3.5" />
            <span>New Task</span>
          </Button>
        </DialogTrigger>

        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
          className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card"
        >
          {/* ── Modal Header ── */}
          <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
            <div className="flex items-center gap-3.5">
              <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <ListTodo className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                  Create New Task
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  Assign responsibilities, set milestones, and define task requirements
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {departments.length > 0 && (
              <div className="p-5 bg-muted/15 border-b border-border/70 space-y-3.5">
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <Layers className="size-4 text-purple-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Task Catalog & Quick Templates
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">1. Select Department</Label>
                    {isExternal && parentDepartments.length === 1 ? (
                      <div className="flex items-center justify-between h-9 px-3 rounded-md bg-background border border-border/80 text-xs font-semibold text-foreground">
                        <span className="truncate">{parentDepartments[0].name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal tabular-nums shrink-0">
                          ({parentDepartments[0].totalTemplates} templates)
                        </span>
                      </div>
                    ) : (
                      <Select onValueChange={setSelectedDepartmentId} value={selectedDepartmentId || undefined}>
                        <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                          <SelectValue placeholder="Identify Dept..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-md border-border/80 max-h-[260px]">
                          {!isExternal && (
                            <SelectItem value="ALL" className="text-xs font-bold text-muted-foreground">All Departments (All Templates)</SelectItem>
                          )}
                          {parentDepartments.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate font-semibold max-w-[170px] sm:max-w-[220px]">
                                  {t.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                  ({t.totalTemplates} templates)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">2. Task Template</Label>
                    <Select
                      onValueChange={handleTemplateSelect}
                      disabled={!selectedDepartmentId || availableTemplates.length === 0}
                    >
                      <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                        <SelectValue placeholder={availableTemplates.length > 0 ? `Select Template (${availableTemplates.length} available)...` : "No Templates"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-border/80 max-h-[280px]">
                        {availableTemplates.map((t: any) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs" title={t.name}>
                            <div className="flex items-center justify-between gap-2 w-full">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[220px]">
                                  {t.name}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0 border border-border/50">
                                  {t.departmentName}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-primary shrink-0 tabular-nums">
                                {t.defaultDurationDays ? `${t.defaultDurationDays}d` : "0d"}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <form id="create-task-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* SECTION 1: Identity & Scope */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Task Identity & Project Context
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!projectId && projects.length > 0 && (
                      <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2 space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-foreground">
                              {isExternal ? "Project Context" : "Select Project"} <span className="text-destructive">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                                  <SelectValue placeholder="Select Project Context..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-md border-border/80">
                                {projects.map((p) => {
                                  const isDefaultExternal = p.name.toLowerCase() === "external"
                                  return (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                      <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="truncate max-w-[200px] sm:max-w-[320px] font-medium">{p.name}</span>
                                        {isExternal && (
                                          <span
                                            className={cn(
                                              "text-[9px] font-bold px-1.5 py-0.5 rounded ml-2",
                                              isDefaultExternal
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                            )}
                                          >
                                            {isDefaultExternal ? "Default External" : "Shared Project"}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2 space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Task Name <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter concise task title..."
                              className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2 space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Task Description & Work Requirements
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-2 relative">
                              {mentionQuery !== null && (
                                <div className="absolute bottom-full left-0 mb-1 w-64 bg-card border border-border/80 rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-1.5 bg-muted/40 border-b border-border/60">Mention User</div>
                                  <ScrollArea className="max-h-[150px]">
                                    <div className="flex flex-col">
                                      {(() => {
                                        const listToUse = allMembers && allMembers.length > 0 ? allMembers : (members || [])
                                        const filtered = listToUse.filter((m: any) => m.name?.toLowerCase().includes(mentionQuery.toLowerCase()))
                                        if (filtered.length === 0) return <div className="p-3 text-center text-[10px] text-muted-foreground">No matches</div>
                                        return filtered.map((member: any) => (
                                          <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => {
                                              const val = field.value || ""
                                              const lastAt = val.lastIndexOf("@")
                                              if (lastAt !== -1) {
                                                const beforeAt = val.substring(0, lastAt)
                                                const mentionText = `@${member.name} `
                                                field.onChange(beforeAt + mentionText)
                                              }
                                              if (!mentionedUsers.find(u => u.id === member.id)) {
                                                setMentionedUsers(prev => [...prev, { id: member.id, name: member.name }])
                                              }
                                              setMentionQuery(null)
                                            }}
                                            className="flex items-center gap-2 p-2 hover:bg-muted/50 text-left transition-colors cursor-pointer"
                                          >
                                            <Avatar className="size-5 shrink-0">
                                              <AvatarImage src={member.avatarUrl} />
                                              <AvatarFallback className="text-[8px] font-bold">{getInitials(member.name || "")}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-semibold truncate flex-1">{member.name}</span>
                                          </button>
                                        ))
                                      })()}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}

                              {/* Inline Task Mention Dropdown */}
                              {taskMentionQuery !== null && (
                                <div className="absolute bottom-full left-0 mb-1 w-80 bg-card border border-border/80 rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-1.5 bg-muted/40 border-b border-border/60">Reference Task</div>
                                  <ScrollArea className="max-h-[150px]">
                                    <div className="flex flex-col">
                                      {(() => {
                                        const filtered = projectTasks.filter(t =>
                                          t.name.toLowerCase().includes(taskMentionQuery.toLowerCase()) ||
                                          t.taskNumber.toString().includes(taskMentionQuery)
                                        )
                                        if (filtered.length === 0) return <div className="p-3 text-center text-[10px] text-muted-foreground">No matches</div>
                                        return filtered.map(t => (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => {
                                              const val = field.value || ""
                                              const lastHash = val.lastIndexOf("#")
                                              if (lastHash !== -1) {
                                                const beforeHash = val.substring(0, lastHash)
                                                const mentionText = `#${t.taskNumber} `
                                                field.onChange(beforeHash + mentionText)
                                              }
                                              setTaskMentionQuery(null)
                                            }}
                                            className="flex flex-col items-start gap-0.5 p-2 hover:bg-muted/50 text-left transition-colors border-b border-border/40 last:border-0 cursor-pointer"
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">#{t.taskNumber}</span>
                                              <span className="text-xs font-semibold truncate max-w-[200px]">{t.name}</span>
                                            </div>
                                          </button>
                                        ))
                                      })()}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}

                              <RichTextEditor
                                placeholder="Provide comprehensive task instructions, requirements, and deliverables... (Type @ to mention team members or # to reference tasks)"
                                value={field.value || ""}
                                onChange={(html, text) => {
                                  field.onChange(html)

                                  const val = text || ""
                                  const lastAt = val.lastIndexOf("@")
                                  const lastHash = val.lastIndexOf("#")

                                  if (lastHash !== -1 && lastHash > lastAt) {
                                    const afterHash = val.substring(lastHash + 1)
                                    if (!afterHash.includes(" ") && !afterHash.includes("\n")) {
                                      setTaskMentionQuery(afterHash)
                                      setMentionQuery(null)
                                    } else {
                                      setTaskMentionQuery(null)
                                    }
                                  } else if (lastAt !== -1) {
                                    const afterAt = val.substring(lastAt + 1)
                                    if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
                                      setMentionQuery(afterAt)
                                      setTaskMentionQuery(null)
                                    } else {
                                      setMentionQuery(null)
                                    }
                                  } else {
                                    setMentionQuery(null)
                                    setTaskMentionQuery(null)
                                  }
                                }}
                                className="min-h-[120px] bg-background border border-border/80 rounded-md text-xs font-medium focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/40 shadow-none"
                              />

                              <div className="flex items-center justify-between border border-border/70 rounded-md p-2 bg-muted/15">
                                <div className="relative">
                                  {!isUploadingAttachment ? (
                                    <>
                                      <input
                                        type="file"
                                        multiple
                                        id="task-create-attachment"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        onChange={handleAttachmentUpload}
                                      />
                                      <Button variant="ghost" size="sm" type="button" className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground relative pointer-events-none gap-1.5 rounded-md" title="Attach file">
                                        <Paperclip className="size-3.5 shrink-0 text-primary" />
                                        <span>Attach Reference Files</span>
                                      </Button>
                                    </>
                                  ) : (
                                    <Button variant="ghost" size="sm" type="button" onClick={handleCancelAttachmentUpload} className="h-8 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 relative gap-1.5 rounded-md" title="Cancel Upload">
                                      <X className="size-3.5 shrink-0" />
                                      <span>Cancel Upload</span>
                                    </Button>
                                  )}
                                </div>

                                {(attachments.length > 0 || Object.keys(uploadProgresses).length > 0) && (
                                  <div className="flex flex-wrap gap-1.5 ml-2">
                                    {attachments.map((att, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 bg-background border border-border/80 px-2 py-1 rounded-md text-[11px]">
                                        <span className="font-medium truncate max-w-[140px]">{att.name}</span>
                                        <button type="button" onClick={() => handleRemovePreviewAttachment(idx, att.url)} className="text-muted-foreground hover:text-rose-600 p-0.5 rounded-md hover:bg-rose-500/10 cursor-pointer">
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    ))}
                                    {Object.entries(uploadProgresses).map(([fileId, progress]) => (
                                      <div key={fileId} className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-2 py-1 rounded-md text-[11px] min-w-[120px] relative overflow-hidden group">
                                        <div className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                                        <span className="font-medium truncate max-w-[100px] text-primary relative z-10">{fileId.split('-')[0]}</span>
                                        <span className="text-primary font-bold ml-auto relative z-10">{progress}%</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCancelSingleAttachmentUpload(fileId)}
                                          className="text-primary hover:text-rose-600 rounded-md relative z-10 p-0.5 ml-1 transition-colors cursor-pointer"
                                          title="Cancel this upload"
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* SECTION 2: Assignments & Ownership */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <Users className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Task Assignment & Priority
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="assignedToId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Assignee
                          </FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(v)
                              setWatchedAssigneeId(v)
                              setHideWorkloadPanel(false)
                            }}
                            value={field.value}
                            disabled={!canAssignOthers}
                          >
                            <FormControl>
                              <SelectTrigger className={cn("h-9 bg-background border-border/80 rounded-md text-xs font-semibold", !canAssignOthers && "opacity-60 pointer-events-none")}>
                                <SelectValue placeholder={canAssignOthers ? "Assign To" : "Self (Assigned)"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-md border-border/80 max-h-[260px]">
                              {filteredMembers.map((member) => (
                                <SelectItem key={member.id} value={member.id} className="text-xs">
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <span className="truncate font-medium max-w-[150px] sm:max-w-[220px]">{member.name || member.email || member.id}</span>
                                    {member.deptBadge && (
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border", member.isSubDeptMember ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border/60")}>
                                        {member.deptBadge}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reviewerId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Reviewer (Cross-Dept)
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "DEFAULT"}>
                            <FormControl>
                              <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                                <SelectValue placeholder="Select Reviewer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-md border-border/80">
                              <SelectItem value="DEFAULT" className="text-xs italic text-muted-foreground">Default (TL/Admin)</SelectItem>
                              {crossDeptReviewers.map((member: any, index: number) => (
                                <SelectItem key={`rev-${member.id}-${index}`} value={member.id} className="text-xs">
                                  <span className="truncate max-w-[150px] sm:max-w-[250px]">{member.name || member.id}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Priority Level
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-bold">
                                <SelectValue placeholder="Priority..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-md border-border/80">
                              <SelectItem value="LOW" className="text-emerald-600 font-bold text-xs">Low Priority</SelectItem>
                              <SelectItem value="MEDIUM" className="text-amber-600 font-bold text-xs">Medium Priority</SelectItem>
                              <SelectItem value="HIGH" className="text-orange-600 font-bold text-xs">High Priority</SelectItem>
                              <SelectItem value="URGENT" className="text-rose-600 font-bold text-xs">Urgent Priority</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Workload Panel: visible when TL/Admin assigns to someone else */}
                    {isTLorAdmin && watchedAssigneeId && watchedAssigneeId !== currentUserId && filteredMembers.length > 0 && !hideWorkloadPanel && (
                      <div className="md:col-span-3">
                        <WorkloadPanel
                          memberIds={filteredMembers.map(m => m.id)}
                          selectedId={watchedAssigneeId}
                          showSoftWarning={true}
                          onSelect={(id) => {
                            form.setValue("assignedToId", id)
                            setWatchedAssigneeId(id)
                            setHideWorkloadPanel(true)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Schedule & Planning */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <CalendarIconLucide className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Timeline & Schedule Planning
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="plannedStart"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 flex flex-col">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Planned Start Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "h-9 w-full bg-background border-border/80 rounded-md text-xs font-medium px-3 focus:ring-primary/20 shadow-none text-left cursor-pointer",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick Start Date</span>
                                  )}
                                  <CalendarIcon className="ml-auto size-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-md overflow-hidden border-border/80 shadow-xl" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  field.onChange(date)
                                  const duration = form.getValues("plannedDuration")
                                  if (date && duration !== undefined && duration !== null) {
                                    form.setValue("plannedEnd", addDays(date, Number(duration)))
                                  }
                                }}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="plannedEnd"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 flex flex-col">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Planned End Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "h-9 w-full bg-background border-border/80 rounded-md text-xs font-medium px-3 focus:ring-primary/20 shadow-none text-left cursor-pointer",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick End Date</span>
                                  )}
                                  <CalendarIcon className="ml-auto size-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-md overflow-hidden border-border/80 shadow-xl" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < (form.getValues("plannedStart") || new Date())
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="plannedDuration"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Planned Duration (Days)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e)
                                const dur = parseFloat(e.target.value)
                                const start = form.getValues("plannedStart")
                                if (start && !isNaN(dur)) {
                                  form.setValue("plannedEnd", addDays(start, dur))
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="activity"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Activity Category
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Engineering, Site Inspection"
                              className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* ── Modal Pinned Footer ── */}
          <div className="px-6 py-4 border-t shrink-0 bg-background/50 border-border/60 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-task-form"
              disabled={isSubmitting}
              className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Creating Task...</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Create Task</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Attachments</AlertDialogTitle>
            <AlertDialogDescription>
              You have attachments that are uploading or haven't been saved yet.
              If you close this dialog now, these attachments will be orphaned and discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCloseWarning(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (Object.keys(xhrRefs.current).length > 0 || isUploadingAttachment) {
                  handleCancelAttachmentUpload();
                }
                // Delete orphaned attachments
                attachments.forEach(att => removeOrphanedAttachment(att.url).catch(console.error));
                setShowCloseWarning(false);
                form.reset();
                setSelectedDepartmentId(null)
                setWatchedAssigneeId(currentUserId || "")
                setAttachments([])
                setMentionedUsers([])
                setHideWorkloadPanel(false)
                setOpen(false)
              }}
            >
              Discard and Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

