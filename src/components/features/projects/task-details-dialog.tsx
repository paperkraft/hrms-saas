"use client"

import { useState, useEffect, useRef, useMemo } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Separator,
  DialogDescription,
  Slider,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui"
import {
  Calendar,
  User,
  Clock,
  Send,
  History,
  CheckCircle2,
  TrendingUp,
  PlayCircle,
  CheckSquare,
  MessageSquare,
  Eye,
  RotateCcw,
  XCircle,
  Star,
  StarHalf,
  Paperclip,
  Pin,
  PinOff,
  FileText,
  X,
  Trash2
} from "lucide-react"
import { format, differenceInCalendarDays } from "date-fns"
import { cn, getInitials, formatFileSize, stripHtml } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  updateTask,

  approveTask,
  getLatestTask,
  getAllTasksForMention
} from "@/actions/projects/tasks"
import {
  removeTaskAttachment,
  removeTaskCommentAttachment,
  removeOrphanedAttachment
} from "@/actions/attachments"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Textarea } from "@/components/ui/textarea"
import { canManageTask, getPermissions } from "@/lib/permissions"
import {
  respondToTask,
  forceCommitTask,
  acceptProposedDeadline,
  rejectProposedDeadline
} from "@/actions/commitments/responses"
import {
  replyToThread,
  pinThreadEntry,
  deleteThreadEntry
} from "@/actions/commitments/thread"
import { CalendarIcon, Lock, Hourglass, ArrowLeftRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RichTextViewer } from "@/components/ui/rich-text-viewer"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReassignmentReason } from "@prisma/client"

const isMilestoneComment = (c: any) => {
  if (!c?.content) return false
  return (
    c.type === "ACCEPTANCE" ||
    c.type === "FORCE_COMMIT" ||
    c.content.includes("✅ Accepted") ||
    c.content.includes("✅ APPROVED") ||
    c.content.includes("❌ REJECTED") ||
    c.content.includes("🔄 RE-OPENED")
  )
}

const isMilestoneLog = (l: any) => {
  const action = l.action
  return (
    action === "TASK_ACCEPTED" ||
    action === "NEGOTIATION_ACCEPTED" ||
    action === "TASK_FORCE_COMMITTED" ||
    action === "REOPEN_TASK" ||
    action === "REJECT_TASK" ||
    action === "APPROVE_TASK" ||
    (l.details && (
      l.details.includes("RE-OPENED") ||
      l.details.includes("REJECTED") ||
      l.details.includes("Accepted") ||
      l.details.includes("Approved")
    ))
  )
}

interface TaskDetailsDialogProps {
  task: any
  open: boolean
  onOpenChange: (open: boolean) => void
  members?: any[]
  allMembers?: any[]
}

export function TaskDetailsDialog({
  task: initialTask,
  open,
  onOpenChange,
  members = [],
  allMembers = []
}: TaskDetailsDialogProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [task, setTask] = useState(initialTask)
  const [showLogs, setShowLogs] = useState(false)
  const [approvalReason, setApprovalReason] = useState("")
  const [showReopenForm, setShowReopenForm] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [tempProgress, setTempProgress] = useState(initialTask?.progress || 0)
  const [rating, setRating] = useState<number>(0)

  // Commitment Workflow States
  const [activeTab, setActiveTab] = useState<"details" | "thread">("details")
  const [responseComment, setResponseComment] = useState("")
  const [responseAction, setResponseAction] = useState<"ACCEPT" | "WORKLOAD_CONCERN" | "REQUEST_REASSIGNMENT" | null>(null)
  const [proposedEnd, setProposedEnd] = useState<Date | undefined>(undefined)
  const [reassignmentReason, setReassignmentReason] = useState<ReassignmentReason | "">("")
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)
  const [threadComment, setThreadComment] = useState("")
  const [revisedEnd, setRevisedEnd] = useState<Date | undefined>(undefined)
  const [forceCommitReason, setForceCommitReason] = useState("")
  const [showForceCommitForm, setShowForceCommitForm] = useState(false)

  // Thread Enrichment States
  const [attachments, setAttachments] = useState<{ url: string; name: string; size: number }[]>([])
  const [uploadProgresses, setUploadProgresses] = useState<Record<string, number>>({})
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)

  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({})
  const uploadAbortedRef = useRef(false)

  const [isDeletingComment, setIsDeletingComment] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)

  const [showCloseWarning, setShowCloseWarning] = useState(false)

  const [isRemovingAttachment, setIsRemovingAttachment] = useState(false)
  const [removingCommentAttachmentId, setRemovingCommentAttachmentId] = useState<string | null>(null)
  const [mentionedUsers, setMentionedUsers] = useState<{ id: string; name: string }[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [projectTasks, setProjectTasks] = useState<{ id: string; name: string; taskNumber: number }[]>([])
  const [taskMentionQuery, setTaskMentionQuery] = useState<string | null>(null)

  const mentionableUsers = useMemo(() => {
    const map = new Map<string, any>()

    // 1. Members passed in via props
    ;(allMembers || []).forEach((m: any) => {
      if (m?.id) {
        const name = m.name || m.email?.split('@')[0] || "User"
        map.set(m.id, { ...m, name, email: m.email || "" })
      }
    })
    ;(members || []).forEach((m: any) => {
      if (m?.id && !map.has(m.id)) {
        const name = m.name || m.email?.split('@')[0] || "User"
        map.set(m.id, { ...m, name, email: m.email || "" })
      }
    })

    // 2. People directly attached to this task (creator, assignee, reviewer, proposedBy)
    const taskPeople = [
      task?.createdBy,
      task?.creator,
      task?.assignedTo,
      task?.proposedBy,
      task?.reviewer
    ]
    taskPeople.forEach((p: any) => {
      if (p?.id && !map.has(p.id)) {
        const name = p.name || p.email?.split('@')[0] || "User"
        map.set(p.id, { id: p.id, name, avatarUrl: p.avatarUrl, email: p.email || "" })
      }
    })

    // 3. Comment authors on this task
    if (task?.comments) {
      task.comments.forEach((c: any) => {
        if (c?.user?.id && !map.has(c.user.id)) {
          const name = c.user.name || c.user.email?.split('@')[0] || "User"
          map.set(c.user.id, { id: c.user.id, name, avatarUrl: c.user.avatarUrl, email: c.user.email || "" })
        }
      })
    }

    return Array.from(map.values())
  }, [allMembers, members, task])

  // Confirmation States
  const [acceptDeadlineCommentId, setAcceptDeadlineCommentId] = useState<string | null>(null)
  const [rejectDeadlineCommentId, setRejectDeadlineCommentId] = useState<string | null>(null)
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)
  const [deleteAttachmentData, setDeleteAttachmentData] = useState<{ isComment: boolean; commentId?: string; url?: string } | null>(null)

  const onTaskUpdated = async () => {
    const latestTaskRes = await getLatestTask(task.id)
    if (latestTaskRes.success && latestTaskRes.data) {
      setTask(latestTaskRes.data)
    }
    router.refresh()
  }

  // Fetch full activity logs and latest task data periodically when open
  useEffect(() => {
    let isMounted = true
    let intervalId: NodeJS.Timeout

    if (open && task?.id) {
      const fetchUpdates = async (isInitial = false) => {
        if (isInitial) setUpdating(true) // Reuse updating or just skip loadingLogs
        try {
          const promises: Promise<any>[] = [
            getLatestTask(task.id)
          ]

          if (isInitial && projectTasks.length === 0) {
            promises.push(getAllTasksForMention())
          }

          const results = await Promise.all(promises)
          const taskResult = results[0]
          const projectTasksResult = isInitial && projectTasks.length === 0 ? results[1] : null

          if (isMounted) {
            if (projectTasksResult?.success && projectTasksResult.data) {
              setProjectTasks(projectTasksResult.data)
            }
            if (taskResult?.success && taskResult.data) {
              const updatedTaskData = taskResult.data
              setTask((prev: any) => {
                if (
                  !isInitial &&
                  JSON.stringify(prev?.comments) === JSON.stringify(updatedTaskData.comments) &&
                  prev?.status === updatedTaskData.status &&
                  prev?.progress === updatedTaskData.progress &&
                  prev?.subTlApproved === updatedTaskData.subTlApproved &&
                  prev?.tlApproved === updatedTaskData.tlApproved &&
                  prev?.adminApproved === updatedTaskData.adminApproved
                ) {
                  return prev;
                }
                return {
                  ...prev,
                  ...updatedTaskData,
                }
              })
            }
          }
        } catch (error) {
          console.error("Failed to fetch task updates:", error)
        } finally {
          if (isInitial && isMounted) setUpdating(false)
        }
      }

      // Initial fetch
      fetchUpdates(true)

      // Set up polling interval every 15 seconds for smooth chat-like experience
      // This strikes a balance between real-time feel and server performance
      intervalId = setInterval(() => {
        fetchUpdates(false)
      }, 15000)
    }

    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [open, task?.id])

  // Reset all temporary form states when the dialog is closed
  useEffect(() => {
    if (!open) {
      setApprovalReason("")
      setShowReopenForm(false)
      setIsApproving(false)
      setIsRejecting(false)
      setRating(0)
      setActiveTab("details")
      setResponseComment("")
      setResponseAction(null)
      setProposedEnd(undefined)
      setReassignmentReason("")
      setIsSubmittingResponse(false)
      setThreadComment("")
      setRevisedEnd(undefined)
      setForceCommitReason("")
      setShowForceCommitForm(false)
      setShowLogs(false)
      setAttachments([])
      setIsUploadingAttachment(false)
      setMentionedUsers([])
      setMentionQuery(null)
      setTaskMentionQuery(null)
      if (task?.progress !== undefined) {
        setTempProgress(task.progress)
      }
    }
  }, [open, task?.progress])

  // Sync with prop if it changes from outside
  useEffect(() => {
    setTask(initialTask)
    if (initialTask?.progress !== undefined) {
      setTempProgress(initialTask.progress)
    }
  }, [initialTask])

  if (!task) return null

  const {
    hasAuthority,
    canApprove,
    canRejectReview,
    canReject,
    isAssigned: isAssignee,
    isDone,
    subTlApproved,
    tlApproved,
    adminApproved,
    activeApprovalStage,
    canApproveSubTL,
    canApproveTL,
    canApproveAdmin
  } = canManageTask(session?.user as any, task, members)

  const { isAdmin, isTL } = getPermissions(session?.user as any)
  const isMentioned = task.comments?.some((c: any) => c.mentionedUserIds?.includes(session?.user?.id)) || task.mentionedUserIds?.includes(session?.user?.id)
  const canSeeDiscussion = isAdmin || isTL || isAssignee || isMentioned
  const discussionCommentsCount = task.comments?.filter((c: any) => !isMilestoneComment(c)).length || 0

  const assigneeDept = task.assignedTo?.department;
  const taskDept = task.department;
  const isAssigneeSub = !!assigneeDept?.parentDepartmentId;
  const isTaskSub = !!taskDept?.parentDepartmentId;

  const subDept = isTaskSub ? taskDept : (isAssigneeSub ? assigneeDept : null);
  const parentDept = isTaskSub
    ? (taskDept?.parentDepartment || taskDept)
    : (isAssigneeSub ? (assigneeDept?.parentDepartment || taskDept) : (taskDept || assigneeDept));

  const isSubDepartment = !!subDept;
  const subDepartmentLeaderId = subDept ? (subDept.teamLeaderId || subDept.teamLeader?.id) : null;
  const parentDepartmentLeaderId = parentDept ? (parentDept.teamLeaderId || parentDept.teamLeader?.id) : null;

  const leaderMember = members?.find((m: any) => m.id === parentDepartmentLeaderId) || allMembers?.find((m: any) => m.id === parentDepartmentLeaderId) || parentDept?.teamLeader;
  const isParentTlAdmin = (parentDepartmentLeaderId && parentDepartmentLeaderId === session?.user?.id && isAdmin) ||
    (parentDept?.id && (session?.user as any)?.ledDepartmentIds?.includes(parentDept.id) && isAdmin) ||
    leaderMember?.role === "ADMIN" ||
    leaderMember?.role === "SYSTEM_ADMIN" ||
    parentDept?.teamLeader?.role === "ADMIN" ||
    parentDept?.teamLeader?.role === "SYSTEM_ADMIN";
  const isAssigneeTL = (!!parentDepartmentLeaderId && task.assignedToId === parentDepartmentLeaderId) || (task.assignedTo?.ledDepartmentId && task.assignedTo.ledDepartmentId === parentDept?.id);
  const isAssigneeSubTL = !!(subDepartmentLeaderId && task.assignedToId === subDepartmentLeaderId);

  const hasSubTlTier = Boolean(
    task.reviewerId ||
    (isSubDepartment && subDepartmentLeaderId && !isAssigneeSubTL) ||
    task.subTlApproved ||
    task.subTlRating ||
    task.subTlApprovalComment
  );
  const hasTlTier = Boolean(
    task.tlApproved ||
    task.tlRating ||
    task.tlApprovalComment ||
    (!task.reviewerId && !isAssigneeTL && !isParentTlAdmin && !!parentDepartmentLeaderId)
  );

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true)
    uploadAbortedRef.current = false;

    try {
      const filesArray = Array.from(files);

      const uploadPromises = filesArray.map(file => {
        if (file.size > 300 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 300MB limit`);
          return Promise.resolve(null);
        }

        const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setUploadProgresses(prev => ({ ...prev, [fileId]: 0 }));

        return new Promise<{ url: string; name: string; size: number } | null>(async (resolve) => {
          try {
            // 1. Get Presigned URL
            const presignedRes = await fetch(`/api/upload-presigned?filename=${encodeURIComponent(file.name)}&folder=tasks`);
            const presignedData = await presignedRes.json();

            if (!presignedRes.ok || !presignedData.success) {
              toast.error(presignedData.error || `Failed to get upload URL for ${file.name}`);
              setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
              return resolve(null);
            }

            const { presignedUrl, fileUrl, fileName } = presignedData;

            if (uploadAbortedRef.current) return resolve(null);

            // 2. Upload directly to MinIO
            const xhr = new XMLHttpRequest();
            xhrRefs.current[fileId] = xhr;

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgresses(prev => ({ ...prev, [fileId]: percentComplete }));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
                resolve({ url: fileUrl, name: fileName, size: file.size });
              } else {
                toast.error(`Upload failed for ${file.name} with status ${xhr.status}`);
                setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
                resolve(null);
              }
            };

            xhr.onerror = () => {
              toast.error(`Network Error uploading ${file.name}`);
              setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
              resolve(null);
            };

            xhr.onabort = () => {
              setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
              resolve(null);
            };

            xhr.open("PUT", presignedUrl, true);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.send(file);
          } catch (e) {
            toast.error(`Error uploading ${file.name}`);
            setUploadProgresses(prev => { const n = { ...prev }; delete n[fileId]; return n; });
            resolve(null);
          }
        });
      });

      const results = await Promise.all(uploadPromises);
      const newAttachments = results.filter((r): r is { url: string; name: string; size: number } => r !== null);

      if (newAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newAttachments])
        toast.success(newAttachments.length > 1 ? `${newAttachments.length} files attached` : "File attached")
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsUploadingAttachment(false)
      if (e.target) e.target.value = ""
    }
  }

  const handleCancelAttachmentUpload = () => {
    uploadAbortedRef.current = true;
    Object.values(xhrRefs.current).forEach(xhr => xhr.abort());
    xhrRefs.current = {};
    setIsUploadingAttachment(false);
    setUploadProgresses({});
    toast.info("Upload cancelled");
  }

  const handleCancelSingleAttachmentUpload = (fileId: string) => {
    if (xhrRefs.current[fileId]) {
      xhrRefs.current[fileId].abort();
      delete xhrRefs.current[fileId];
      toast.info(`Upload cancelled for ${fileId.split('-')[0]}`);
    }
  }

  const handleRemovePreviewAttachment = async (idx: number, url: string) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    try {
      await removeOrphanedAttachment(url);
    } catch (error) {
      console.error("Failed to delete orphaned attachment:", error);
    }
  }

  const handleRemoveAttachment = async (urlToRemove?: string) => {
    if (!task) return

    setIsRemovingAttachment(true)
    try {
      await removeTaskAttachment(task.id, urlToRemove)
      toast.success("Attachment removed successfully")
      onTaskUpdated()
    } catch (error: any) {
      toast.error(error.message || "Failed to remove attachment")
    } finally {
      setIsRemovingAttachment(false)
    }
  }

  const handleRemoveCommentAttachment = async (commentId: string, urlToRemove?: string) => {
    setRemovingCommentAttachmentId(commentId)
    try {
      await removeTaskCommentAttachment(commentId, urlToRemove)
      toast.success("Attachment removed successfully")
      onTaskUpdated()
    } catch (error: any) {
      toast.error(error.message || "Failed to remove attachment")
    } finally {
      setRemovingCommentAttachmentId(null)
    }
  }

  const handlePinToggle = async (commentId: string) => {
    const result = await pinThreadEntry(commentId)
    if (result.success) {
      toast.success("Pin status updated")
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
      }
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update pin status")
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    setIsDeletingComment(true)
    const result = await deleteThreadEntry(commentId)
    setIsDeletingComment(false)
    if (result.success) {
      toast.success("Message deleted")
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
      }
      router.refresh()
    } else {
      toast.error(result.error || "Failed to delete message")
    }
  }

  const handleAcceptDeadline = async (commentId: string) => {
    setIsSubmittingResponse(true)
    const result = await acceptProposedDeadline(task.id, commentId)
    setIsSubmittingResponse(false)

    if (result.success) {
      toast.success("Deadline accepted and task committed")
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
      }
      router.refresh()
    } else {
      toast.error(result.error || "Failed to accept deadline")
    }
  }

  const handleRejectDeadline = async (commentId: string) => {
    setIsSubmittingResponse(true)
    const result = await rejectProposedDeadline(task.id, commentId)
    setIsSubmittingResponse(false)

    if (result.success) {
      toast.success("Proposed deadline rejected")
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
      }
      router.refresh()
    } else {
      toast.error(result.error || "Failed to reject deadline")
    }
  }

  const handleProgressUpdate = async (newProgress: number) => {
    setUpdating(true)
    // Optimistic update for smooth UI
    setTempProgress(newProgress)
    setTask((prev: any) => ({
      ...prev,
      progress: newProgress,
      status: (newProgress === 100 && prev?.status === "IN_PROGRESS") ? "IN_REVIEW" : prev?.status
    }))

    const updates: any = { progress: newProgress }

    // Automatically move to IN_REVIEW if progress reaches 100
    if (newProgress === 100 && task.status === "IN_PROGRESS") {
      updates.status = "IN_REVIEW"
    }

    const result = await updateTask(task.id, updates)
    setUpdating(false)
    if (result.success) {
      const updated = result.data
      // Merge updated data but preserve deep relations that updateTask doesn't return
      setTask((prev: any) => ({
        ...prev,
        ...updated,
        creator: prev?.creator,
        reviewer: prev?.reviewer,
        department: prev?.department,
        assignedTo: prev?.assignedTo,
        comments: prev?.comments
      }))
      setTempProgress(updated?.progress)



      if (updates.status === "IN_REVIEW") {
        toast.success("Task completed and submitted for review!")
      } else {
        toast.success(`Progress updated to ${newProgress}%`)
      }
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update progress")
      // Revert optimistic update
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
        setTempProgress(latestTaskRes.data.progress)
      }
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true)
    // Optimistic update for smooth UI
    setTask((prev: any) => ({ ...prev, status: newStatus }))

    const result = await updateTask(task.id, { status: newStatus })
    setUpdating(false)
    if (result.success) {
      const updated = result.data
      // Merge updated data but preserve deep relations that updateTask doesn't return
      setTask((prev: any) => ({
        ...prev,
        ...updated,
        creator: prev?.creator,
        reviewer: prev?.reviewer,
        department: prev?.department,
        assignedTo: prev?.assignedTo,
        comments: prev?.comments
      }))

      toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update status")
      // Revert optimistic update
      const latestTaskRes = await getLatestTask(task.id)
      if (latestTaskRes.success && latestTaskRes.data) {
        setTask(latestTaskRes.data)
      }
    }
  }

  const isSelfAssigned = task.createdById === task.assignedToId || (task.creator?.id === task.assignedTo?.id && task.creator?.id);
  const isOverdue = task.status !== "COMPLETED" && task.plannedEnd && differenceInCalendarDays(new Date(task.plannedEnd), new Date()) < 0;
  const overdueDays = isOverdue ? Math.abs(differenceInCalendarDays(new Date(task.plannedEnd), new Date())) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "text-emerald-600 bg-emerald-50 border-emerald-100"
      case "IN_PROGRESS": return "text-blue-600 bg-blue-50 border-blue-100"
      case "IN_REVIEW": return "text-orange-600 bg-orange-50 border-orange-100"
      case "ON_HOLD": return "text-rose-600 bg-rose-50 border-rose-100"
      default: return "text-muted-foreground bg-muted/50 border-border"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT": return "text-rose-600 bg-rose-50 border-rose-100"
      case "HIGH": return "text-orange-600 bg-orange-50 border-orange-100"
      case "MEDIUM": return "text-amber-600 bg-amber-50 border-amber-100"
      default: return "text-emerald-600 bg-emerald-50 border-emerald-100"
    }
  }


  const SidebarContent = ({ className = "p-5 space-y-4" }: { className?: string }) => (
    <div className={className}>
      {/* People */}
      <div className="space-y-4">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">People</h4>
        <div className="space-y-4">
          {task.creator?.id && task.assignedTo?.id && task.creator.id === task.assignedTo.id ? (
            <div className="flex items-start gap-3">
              <Avatar className="size-7 shrink-0">
                {task.assignedTo?.avatarUrl && (
                  <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name} className="object-cover" />
                )}
                <AvatarFallback className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                  {getInitials(task.assignedTo?.name || "")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Creator & Assignee</p>
                <p className="text-[11px] font-bold text-foreground truncate" title={task.assignedTo?.name}>{task.assignedTo?.name}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <Avatar className="size-7 shrink-0">
                  {task.creator?.avatarUrl && (
                    <AvatarImage src={task.creator.avatarUrl} alt={task.creator.name} className="object-cover" />
                  )}
                  <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary uppercase">
                    {getInitials(task.creator?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Created By</p>
                  <p className="text-[11px] font-bold text-foreground truncate" title={task.creator?.name}>{task.creator?.name || "System"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Avatar className="size-7 shrink-0">
                  {task.assignedTo?.avatarUrl && (
                    <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name} className="object-cover" />
                  )}
                  <AvatarFallback className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                    {getInitials(task.assignedTo?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Assigned To</p>
                  <p className="text-[11px] font-bold text-foreground truncate" title={task.assignedTo?.name}>{task.assignedTo?.name || "Unassigned"}</p>
                </div>
              </div>
            </>
          )}
          {task.reviewer && (
            <div className="flex items-start gap-3">
              <Avatar className="size-7 shrink-0">
                {task.reviewer.avatarUrl && (
                  <AvatarImage src={task.reviewer.avatarUrl} alt={task.reviewer.name} className="object-cover" />
                )}
                <AvatarFallback className="text-[9px] font-bold bg-indigo-500/10 text-indigo-600 uppercase">
                  {getInitials(task.reviewer.name || "")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-600">Reviewer</p>
                <p className="text-[11px] font-bold text-foreground truncate" title={task.reviewer.name}>{task.reviewer.name}</p>
              </div>
            </div>
          )}
          {task.department?.name && (
            <div className="flex items-start gap-3">
              <div className="size-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <CheckSquare className="size-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Department</p>
                <p className="text-[11px] font-bold text-foreground truncate">{task.department.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* Schedule */}
      <div className="space-y-4">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Schedule</h4>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-7 rounded-sm bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <Calendar className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Start Date</p>
              <p className="text-[11px] font-bold tabular-nums truncate text-foreground">
                {task.plannedStart ? format(new Date(task.plannedStart), "MMM d, yyyy") : "Not Set"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className={cn(
              "size-7 rounded-sm flex items-center justify-center shrink-0",
              isOverdue ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"
            )}>
              <Calendar className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className={cn("text-[9px] font-bold uppercase tracking-widest", isOverdue ? "text-rose-600" : "text-muted-foreground/80")}>
                {isOverdue ? `Overdue by ${overdueDays} Day${overdueDays > 1 ? "s" : ""}` : "Deadline"}
              </p>
              <p className={cn("text-[11px] font-bold tabular-nums truncate", isOverdue ? "text-rose-600" : "text-foreground")}>
                {task.plannedEnd ? format(new Date(task.plannedEnd), "MMM d, yyyy") : "Not Set"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-7 rounded-sm bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <Clock className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Duration</p>
              <p className="text-[11px] font-bold text-foreground">
                {task.plannedDuration ? `${task.plannedDuration} Days` : "Not Specified"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {(task.status === "IN_REVIEW" || task.status === "COMPLETED" || task.subTlApproved || task.tlApproved || task.adminApproved) && (
        <>
          <Separator className="bg-border/40" />
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Verification</h4>
            <div className="space-y-2.5">
              {hasSubTlTier && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground">{task.reviewerId ? 'Reviewer' : 'Sub-TL'} Approval</span>
                  <div className="flex items-center gap-1.5">
                    {task.subTlApproved ? (
                      <>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Approved</span>
                        <div className="size-1.5 rounded-full bg-emerald-500" />
                      </>
                    ) : activeApprovalStage === "SUB_TL" ? (
                      <>
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Pending</span>
                        <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Awaiting</span>
                        <div className="size-1.5 rounded-full bg-muted" />
                      </>
                    )}
                  </div>
                </div>
              )}
              {hasTlTier && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground">TL Approval</span>
                  <div className="flex items-center gap-1.5">
                    {task.tlApproved ? (
                      <>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Approved</span>
                        <div className="size-1.5 rounded-full bg-emerald-500" />
                      </>
                    ) : activeApprovalStage === "TL" ? (
                      <>
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Pending</span>
                        <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          {task.subTlApproved || !hasSubTlTier ? "Awaiting" : "Locked"}
                        </span>
                        <div className="size-1.5 rounded-full bg-muted" />
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-muted-foreground">Admin Approval</span>
                <div className="flex items-center gap-1.5">
                  {task.adminApproved ? (
                    <>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Approved</span>
                      <div className="size-1.5 rounded-full bg-emerald-500" />
                    </>
                  ) : activeApprovalStage === "ADMIN" ? (
                    <>
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Pending</span>
                      <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {task.tlApproved || (!hasTlTier && (task.subTlApproved || !hasSubTlTier)) ? "Awaiting" : "Locked"}
                      </span>
                      <div className="size-1.5 rounded-full bg-muted" />
                    </>
                  )}
                </div>
              </div>
              {(task.subTlRating || task.tlRating || task.adminRating) && (
                <div className="pt-2 border-t border-border/40 mt-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Task Performance Rating</p>
                  <div className="flex items-center gap-0.5">
                    {(() => {
                      const ratings = [task.subTlRating, task.tlRating, task.adminRating].filter(r => r !== null && r !== undefined);
                      const average = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
                      return (
                        <>
                          {[1, 2, 3, 4, 5].map((s) => {
                            if (s <= average) {
                              return <Star key={s} className="size-2.5 fill-amber-400 text-amber-400" />
                            } else if (s - 0.5 <= average) {
                              return <StarHalf key={s} className="size-2.5 fill-amber-400 text-amber-400" />
                            } else {
                              return <Star key={s} className="size-2.5 text-muted-foreground/20" />
                            }
                          })}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (attachments.length > 0 || Object.keys(uploadProgresses).length > 0) {
        setShowCloseWarning(true);
        return;
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          className="p-0 rounded-sm border border-border overflow-hidden w-[94vw] sm:w-[calc(100%-2rem)] sm:max-w-212.5 h-[90vh] flex flex-col gap-0 bg-white dark:bg-card shadow-lg"
        >
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/5 shrink-0">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                {task.taskNumber && (
                  <span className="text-[11px] font-black tabular-nums tracking-tight text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-sm shrink-0">
                    #{task.taskNumber}
                  </span>
                )}
                <Badge variant="outline" className="text-[9px] font-bold tracking-widest uppercase rounded-sm border-primary/20 bg-primary/5 text-primary px-2 py-0.5 truncate max-w-60 sm:max-w-none">
                  {task.project?.name || "Global Project"}
                </Badge>
                <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest uppercase rounded-sm px-2 py-0.5 shrink-0", getPriorityColor(task.priority))}>
                  {task.priority} Priority
                </Badge>
              </div>
              <DialogTitle className="font-bold tracking-tight text-foreground/90 leading-tight">
                {task.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed information, schedule, and approval actions for task: {task.name}
              </DialogDescription>
              <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2 sm:gap-3">
                <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[10px] font-bold uppercase tracking-widest", getStatusColor(task.status))}>
                  <div className={cn("size-1.5 rounded-full animate-pulse", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-current")} />
                  {task.status.replace("_", " ")}
                </div>
                {task.status === "IN_REVIEW" && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-sm bg-amber-50/50 border border-amber-100/50 text-[9px] font-black uppercase tracking-widest text-amber-700">
                    {task.tlApproved ? (
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3" /> {task.reviewerId ? 'Reviewer' : 'TL'} Approved • Waiting for Admin</span>
                    ) : task.adminApproved ? (
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3" /> Admin Approved • Waiting for {task.reviewerId ? 'Reviewer' : 'TL'}</span>
                    ) : task.assignedTo?.ledDepartment && !task.reviewerId ? (
                      <span className="flex items-center gap-1.5"><Clock className="size-3" /> Waiting for Admin Approval (TL Task)</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><Clock className="size-3" /> Waiting for {task.reviewerId ? 'Reviewer' : 'TL'}/Admin Approval</span>
                    )}
                  </div>
                )}
                {task.lifecycleStatus && task.lifecycleStatus !== "COMMITTED" && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-sm bg-indigo-50/50 border border-indigo-100/50 text-[9px] font-black uppercase tracking-widest text-indigo-700 animate-pulse">
                    <Hourglass className="size-3" /> {task.lifecycleStatus === "PROPOSED" ? "Proposed Task" : "Negotiating Task"}
                  </div>
                )}
                {isSelfAssigned && (
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                    <User className="size-3" /> Personal Task
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Tab selection */}
          <div className="flex border-b border-border/40 bg-muted/5 shrink-0">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "flex-1 sm:flex-initial px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                activeTab === "details"
                  ? "border-primary text-primary bg-white dark:bg-card"
                  : "border-transparent text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <span className="hidden sm:inline">Details & Progress</span>
              <span className="inline sm:hidden">Details</span>
            </button>
            {canSeeDiscussion && (
              <button
                onClick={() => setActiveTab("thread")}
                className={cn(
                  "flex-1 sm:flex-initial px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2",
                  activeTab === "thread"
                    ? "border-primary text-primary bg-white dark:bg-card"
                    : "border-transparent text-muted-foreground/70 hover:text-foreground"
                )}
              >
                <MessageSquare className="size-3.5" />
                <span className="hidden sm:inline">Discussion Thread</span>
                <span className="inline sm:hidden">Discussion</span>
                {discussionCommentsCount > 0 && (
                  <Badge variant="secondary" className="size-4 p-0 flex items-center justify-center text-[9px] font-black rounded-full">
                    {discussionCommentsCount}
                  </Badge>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Main Content Pane */}
            {activeTab === "details" || !canSeeDiscussion ? (
              <ScrollArea className="flex-1 h-full min-h-0 border-r-0 md:border-r border-border/40">
                <div className="p-6 space-y-4">
                  {/* Proposed/Negotiating Banner & Response Block */}
                  {task.lifecycleStatus && task.lifecycleStatus !== "COMMITTED" && (
                    <div className="p-4 rounded-sm border border-indigo-100 bg-indigo-50/20 dark:bg-indigo-950/5 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Hourglass className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">
                            Pending Commitment
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isAssignee
                              ? "Please review the task details and confirm your commitment."
                              : `Awaiting response from ${task.assignedTo?.name || "assignee"}.`}
                          </p>
                        </div>
                      </div>

                      {/* Employee response buttons & inputs */}
                      {isAssignee && (
                        <div className="space-y-3 pt-2 border-t border-indigo-100/50">
                          {!responseAction ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => { setResponseAction("ACCEPT"); setResponseComment("") }}
                                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                Accept Task
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => { setResponseAction("WORKLOAD_CONCERN"); setResponseComment("") }}
                                className="h-8 border-amber-200 text-amber-600 hover:bg-amber-50 text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                Workload Concern
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => { setResponseAction("REQUEST_REASSIGNMENT"); setResponseComment("") }}
                                className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                Request Reassignment
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                                  {responseAction === "ACCEPT" ? "Confirm Acceptance" : responseAction === "WORKLOAD_CONCERN" ? "Workload Concern details" : "Reassignment request details"}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setResponseAction(null); setResponseComment("") }}
                                  className="h-6 text-[9px] font-black uppercase tracking-widest"
                                >
                                  Change choice
                                </Button>
                              </div>

                              {/* Additional inputs based on action choice */}
                              {responseAction === "WORKLOAD_CONCERN" && (
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <CalendarIcon className="size-3" /> Proposed Alternative Deadline (Optional)
                                  </label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "h-8 text-xs font-semibold w-full justify-start text-left px-3 rounded-sm",
                                          !proposedEnd && "text-muted-foreground"
                                        )}
                                      >
                                        {proposedEnd ? format(proposedEnd, "PPP") : <span>Select date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-sm" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={proposedEnd}
                                        onSelect={setProposedEnd}
                                        disabled={(date) => {
                                          if (task.plannedEnd) {
                                            return date <= new Date(new Date(task.plannedEnd).setHours(0, 0, 0, 0))
                                          }
                                          return date < new Date(new Date().setHours(0, 0, 0, 0))
                                        }}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )}

                              {responseAction === "REQUEST_REASSIGNMENT" && (
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <ArrowLeftRight className="size-3" /> Reassignment Reason category
                                  </label>
                                  <Select
                                    value={reassignmentReason}
                                    onValueChange={(v) => setReassignmentReason(v as any)}
                                  >
                                    <SelectTrigger className="h-8 text-xs font-semibold rounded-sm">
                                      <SelectValue placeholder="Select a reason category" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-sm">
                                      <SelectItem value="OVERLOADED">Currently Overloaded / Multi-tasked</SelectItem>
                                      <SelectItem value="NO_ACCESS">Dependency or Access Missing</SelectItem>
                                      <SelectItem value="SKILL_MISMATCH">Skill Mismatch / Experience Gap</SelectItem>
                                      <SelectItem value="LEAVE_PLANNED">Planned Leave / Out of Office</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <RichTextEditor
                                placeholder="Describe your reasoning (required, minimum 5 characters)..."
                                value={responseComment}
                                onChange={(html, text) => setResponseComment(html)}
                                minHeight="100px"
                                maxHeight="200px"
                                className="min-h-20 max-h-37.5 text-xs font-medium bg-white rounded-sm focus-within:ring-1 focus-within:ring-indigo-300"
                              />

                              <Button
                                disabled={responseComment.trim().length < 5 || isSubmittingResponse || (responseAction === "REQUEST_REASSIGNMENT" && !reassignmentReason)}
                                onClick={async () => {
                                  setIsSubmittingResponse(true)
                                  const result = await respondToTask(
                                    task.id,
                                    responseAction === "ACCEPT" ? "ACCEPT" : responseAction === "WORKLOAD_CONCERN" ? "WORKLOAD_CONCERN" : "REQUEST_REASSIGNMENT",
                                    responseComment,
                                    {
                                      proposedEnd,
                                      reassignmentReason: reassignmentReason || undefined
                                    }
                                  )
                                  setIsSubmittingResponse(false)
                                  if (result.success) {
                                    toast.success(responseAction === "ACCEPT" ? "Task accepted and active!" : "Negotiation comment registered.")
                                    setResponseAction(null)
                                    setResponseComment("")
                                    router.refresh()
                                    onOpenChange(false)
                                  } else {
                                    toast.error(result.error || "Failed to submit response")
                                  }
                                }}
                                className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                {isSubmittingResponse ? <Spinner className="size-3.5" /> : "Submit Response"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manager force commit bypass */}
                      {!isAssignee && hasAuthority && (
                        <div className="pt-2 border-t border-indigo-100/50 space-y-2">
                          {!showForceCommitForm ? (
                            <Button
                              variant="outline"
                              onClick={() => setShowForceCommitForm(true)}
                              className="h-7 w-full border-rose-200 text-rose-600 hover:bg-rose-50 text-[9px] font-black uppercase tracking-widest rounded-sm flex items-center justify-center gap-1.5"
                            >
                              <Lock className="size-3" /> Force Commit Task
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-rose-600 uppercase tracking-widest">
                                Provide Business Rationale to Override Employee concern
                              </label>
                              <RichTextEditor
                                placeholder="Business justification (required, minimum 5 characters)..."
                                value={forceCommitReason}
                                onChange={(html, text) => setForceCommitReason(html)}
                                className="min-h-20 max-h-37.5 text-xs font-medium rounded-sm border-rose-200"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setShowForceCommitForm(false); setForceCommitReason("") }}
                                  className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest rounded-sm"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={forceCommitReason.trim().length < 10 || isSubmittingResponse}
                                  onClick={async () => {
                                    setIsSubmittingResponse(true)
                                    const result = await forceCommitTask(task.id, forceCommitReason)
                                    setIsSubmittingResponse(false)
                                    if (result.success) {
                                      toast.success("Task committed successfully!")
                                      setShowForceCommitForm(false)
                                      setForceCommitReason("")
                                      router.refresh()
                                      onOpenChange(false)
                                    } else {
                                      toast.error(result.error || "Failed to force commit")
                                    }
                                  }}
                                  className="flex-1 h-7 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest rounded-sm"
                                >
                                  Confirm Force Commit
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                      <MessageSquare className="size-3" /> Description
                    </h3>
                    <div className="bg-muted/30 p-2 px-4 rounded-sm border border-dashed space-y-3">
                      {task.description ? (
                        <RichTextViewer content={task.description} className="text-xs" />
                      ) : (
                        <p className="text-xs text-muted-foreground font-medium">No description provided for this task.</p>
                      )}

                      {/* Attachments and Mentions in Description */}
                      {(task.attachmentUrl || (task.attachments && (task.attachments as any[]).length > 0) || (task.mentionedUserIds && task.mentionedUserIds.length > 0)) && (
                        <div className="pt-3 border-t border-border/40 space-y-2">
                          {task.attachmentUrl && (
                            <div className="flex items-center gap-2">
                              <a
                                href={`${task.attachmentUrl}${task.attachmentUrl.includes('?') ? '&' : '?'}download=1`}
                                rel="noopener noreferrer"
                                download
                                className="inline-flex items-center gap-2 p-1.5 px-2 bg-background border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors rounded-sm group max-w-fit"
                              >
                                <div className="p-1.5 bg-primary/10 text-primary rounded-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                  <FileText className="size-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-[11px] font-bold truncate max-w-50 leading-tight">
                                    {task.attachmentName || "Attachment"}
                                  </span>
                                  {task.attachmentSize && (
                                    <span className="text-[9px] text-muted-foreground font-medium">
                                      {formatFileSize(task.attachmentSize)}
                                    </span>
                                  )}
                                </div>
                              </a>
                              {(hasAuthority || task.assignedToId === session?.user?.id || task.createdById === session?.user?.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteAttachmentData({ isComment: false, url: task.attachmentUrl });
                                  }}
                                  disabled={isRemovingAttachment}
                                  title="Remove attachment"
                                >
                                  {isRemovingAttachment ? <Spinner className="size-3" /> : <X className="size-3" />}
                                </Button>
                              )}
                            </div>
                          )}

                          {task.attachments && (task.attachments as any[]).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(task.attachments as any[]).map((att: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <a
                                    href={`${att.url}${att.url.includes('?') ? '&' : '?'}download=1`}
                                    rel="noopener noreferrer"
                                    download
                                    className="inline-flex items-center gap-2 p-1.5 px-2 bg-background border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors rounded-sm group max-w-fit"
                                  >
                                    <div className="p-1.5 bg-primary/10 text-primary rounded-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                      <FileText className="size-3.5" />
                                    </div>
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <span className="text-[11px] font-bold truncate max-w-50 leading-tight">
                                        {att.name || "Attachment"}
                                      </span>
                                      {att.size && (
                                        <span className="text-[9px] text-muted-foreground font-medium">
                                          {formatFileSize(att.size)}
                                        </span>
                                      )}
                                    </div>
                                  </a>
                                  {(hasAuthority || task.assignedToId === session?.user?.id || task.createdById === session?.user?.id) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeleteAttachmentData({ isComment: false, url: att.url });
                                      }}
                                      disabled={isRemovingAttachment}
                                      title="Remove attachment"
                                    >
                                      {isRemovingAttachment ? <Spinner className="size-3" /> : <X className="size-3" />}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {task.mentionedUserIds && task.mentionedUserIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Mentions:</span>
                              {task.mentionedUserIds.map((userId: string) => {
                                const member = allMembers?.find(m => m.id === userId) || members?.find(m => m.id === userId)
                                return (
                                  <Badge key={userId} variant="secondary" className="text-[9px] py-0 px-1.5 h-4 font-semibold text-blue-600 bg-blue-50 border-blue-200">
                                    @{member?.name || userId}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Quick Actions */}
                  {!isDone && isAssignee && (!task.lifecycleStatus || task.lifecycleStatus === "COMMITTED") && (task.status === "TODO" || task.status === "ON_HOLD" || task.status === "IN_PROGRESS") && (
                    <section className="space-y-3">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                        <CheckSquare className="size-3" /> Quick Actions
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(task.status === "TODO" || task.status === "ON_HOLD") && (
                          <Button
                            size="sm"
                            disabled={updating}
                            onClick={() => handleStatusUpdate("IN_PROGRESS")}
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm"
                          >
                            <PlayCircle className="size-3.5 mr-2" />
                            {task.status === "ON_HOLD" ? "Resume Task" : "Start Task"}
                          </Button>
                        )}
                        {task.status === "IN_PROGRESS" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updating}
                              onClick={() => handleStatusUpdate("IN_REVIEW")}
                              className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50 text-[10px] font-black uppercase tracking-widest rounded-sm"
                            >
                              Mark for Review
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updating}
                              onClick={() => handleStatusUpdate("ON_HOLD")}
                              className="h-8 border-amber-200 text-amber-600 hover:bg-amber-50 text-[10px] font-black uppercase tracking-widest rounded-sm"
                            >
                              Put On Hold
                            </Button>
                          </>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Progress */}
                  <section className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2 shrink-0">
                        <TrendingUp className="size-3" /> Current Progress
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-baseline items-end gap-0.5 sm:gap-1.5 min-w-0">
                        <span className="text-xs md:text-sm font-bold text-primary tabular-nums transition-all">{tempProgress}%</span>
                        <span className="text-[7px] md:text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-right">
                          <span className="hidden sm:inline">• </span>
                          {isDone ? "Complete" : tempProgress === 100 ? "Ready to Review" : "In Progress"}
                        </span>
                      </div>
                    </div>

                    <div>
                      {(!isDone && isAssignee && task.status !== "TODO") ? (
                        <div className="px-1">
                          <Slider
                            value={[tempProgress]}
                            max={100}
                            step={10}
                            onValueChange={(vals) => setTempProgress(vals[0])}
                            onValueCommit={(vals) => handleProgressUpdate(vals[0])}
                            disabled={updating}
                            className="py-4"
                          />
                          <div className="flex justify-between mt-1 px-1">
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((s) => (
                              <span
                                key={s}
                                className={cn(
                                  "text-[8px] font-black transition-all",
                                  tempProgress >= s ? "text-primary" : "text-muted-foreground/30"
                                )}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden border border-border/20">
                            <div
                              className="h-full bg-primary transition-all duration-300 ease-out"
                              style={{ width: `${tempProgress}%` }}
                            />
                          </div>

                          {task.status === "TODO" && isAssignee && (
                            <div className="flex items-center gap-2 py-2 px-3 rounded-sm bg-blue-50/50 border border-blue-100/50 dark:bg-blue-900/10 dark:border-blue-900/30">
                              <Clock className="size-3 text-blue-600" />
                              <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                                {task.lifecycleStatus && task.lifecycleStatus !== "COMMITTED"
                                  ? "Accept this task to begin working on it"
                                  : "Start this task to begin recording progress"}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Multi-Tier Approval Chain Stepper */}
                  {(task.status === "IN_REVIEW" || task.status === "COMPLETED" || task.subTlApproved || task.tlApproved || task.adminApproved) && (
                    <section className="p-3.5 rounded-sm border bg-muted/5 border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-1.5">
                          <CheckSquare className="size-3 text-primary" /> Approval Pipeline
                        </h4>
                        <span className="text-[9px] font-bold text-muted-foreground/60">
                          {task.status === "COMPLETED" ? "All Approved ✓" : "Review in Progress"}
                        </span>
                      </div>

                      {(() => {
                        const visibleTiersCount = (hasSubTlTier ? 1 : 0) + (hasTlTier ? 1 : 0) + 1
                        const gridColsClass = visibleTiersCount === 3
                          ? "grid-cols-1 sm:grid-cols-3"
                          : visibleTiersCount === 2
                            ? "grid-cols-1 sm:grid-cols-2"
                            : "grid-cols-1"

                        return (
                          <div className={cn("grid gap-2", gridColsClass)}>
                            {/* Tier: Sub-TL / Reviewer */}
                            {hasSubTlTier && (
                              <div className={cn(
                                "p-2.5 rounded-sm border flex flex-col justify-between gap-1.5",
                                task.subTlApproved ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20" :
                                  activeApprovalStage === "SUB_TL" ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 ring-1 ring-amber-400/40" :
                                    "bg-muted/20 border-border/40 opacity-70"
                              )}>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                                    {visibleTiersCount === 3 ? "1. " : ""}{task.reviewerId ? "Reviewer" : "Sub-TL"}
                                  </span>
                                  {task.subTlApproved ? (
                                    <Badge variant="outline" className="text-[8px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200 px-1 font-bold shrink-0">Approved ✓</Badge>
                                  ) : activeApprovalStage === "SUB_TL" ? (
                                    <Badge variant="outline" className="text-[8px] h-4 bg-amber-100 text-amber-700 border-amber-300 px-1 font-bold animate-pulse shrink-0">Pending ⏳</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground border-border px-1 font-bold shrink-0">Awaiting</Badge>
                                  )}
                                </div>
                                {task.subTlApprovalComment && (
                                  <p className="text-[10px] text-muted-foreground italic truncate" title={task.subTlApprovalComment}>
                                    "{task.subTlApprovalComment}"
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Tier: Team Leader */}
                            {hasTlTier && (
                              <div className={cn(
                                "p-2.5 rounded-sm border flex flex-col justify-between gap-1.5",
                                task.tlApproved ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20" :
                                  activeApprovalStage === "TL" ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 ring-1 ring-amber-400/40" :
                                    "bg-muted/20 border-border/40 opacity-70"
                              )}>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                                    {visibleTiersCount === 3 ? "2. " : visibleTiersCount === 2 && !hasSubTlTier ? "1. " : "2. "}Team Leader
                                  </span>
                                  {task.tlApproved ? (
                                    <Badge variant="outline" className="text-[8px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200 px-1 font-bold shrink-0">Approved ✓</Badge>
                                  ) : activeApprovalStage === "TL" ? (
                                    <Badge variant="outline" className="text-[8px] h-4 bg-amber-100 text-amber-700 border-amber-300 px-1 font-bold animate-pulse shrink-0">Pending ⏳</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground border-border px-1 font-bold shrink-0">
                                      {task.subTlApproved || !hasSubTlTier ? "Awaiting" : "Locked 🔒"}
                                    </Badge>
                                  )}
                                </div>
                                {task.tlApprovalComment && (
                                  <p className="text-[10px] text-muted-foreground italic truncate" title={task.tlApprovalComment}>
                                    "{task.tlApprovalComment}"
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Tier: Admin Approval */}
                            <div className={cn(
                              "p-2.5 rounded-sm border flex flex-col justify-between gap-1.5",
                              task.adminApproved ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20" :
                                activeApprovalStage === "ADMIN" ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 ring-1 ring-amber-400/40" :
                                  "bg-muted/20 border-border/40 opacity-70"
                            )}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                                  {visibleTiersCount === 3 ? "3. Admin Approval" : visibleTiersCount === 2 ? "2. Admin Approval" : "Admin Approval (Direct)"}
                                </span>
                                {task.adminApproved ? (
                                  <Badge variant="outline" className="text-[8px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200 px-1 font-bold shrink-0">Approved ✓</Badge>
                                ) : activeApprovalStage === "ADMIN" ? (
                                  <Badge variant="outline" className="text-[8px] h-4 bg-amber-100 text-amber-700 border-amber-300 px-1 font-bold animate-pulse shrink-0">
                                    Pending ⏳
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground border-border px-1 font-bold shrink-0">
                                    {task.tlApproved || (!hasTlTier && (task.subTlApproved || !hasSubTlTier)) ? "Awaiting" : "Locked 🔒"}
                                  </Badge>
                                )}
                              </div>
                              {task.adminApprovalComment && (
                                <p className="text-[10px] text-muted-foreground italic truncate" title={task.adminApprovalComment}>
                                  "{task.adminApprovalComment}"
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </section>
                  )}

                  {/* Review/Approval Actions */}
                  {(canApprove || canRejectReview || (isDone && canReject)) && (
                    <section className={cn(
                      "p-4 rounded-sm border space-y-1",
                      isDone ? "bg-rose-50/40 border-rose-100" : "bg-orange-50/40 border-orange-100 dark:bg-orange-950/10 dark:border-orange-900/40"
                    )}>
                      <div className="flex items-center gap-2">
                        {isDone ? <History className="size-3.5 text-rose-600" /> : <Eye className="size-3.5 text-orange-600" />}
                        <h3 className={cn("text-[10px] font-bold uppercase tracking-widest", isDone ? "text-rose-700" : "text-orange-700")}>
                          {isDone
                            ? (showReopenForm ? "Confirm Re-opening" : "Task Completed")
                            : (isApproving ? "Add Approval Remarks" : isRejecting ? "Rejection Feedback" :
                              activeApprovalStage === "SUB_TL" ? "Stage 1: Sub-Team Leader Approval Required" :
                                activeApprovalStage === "TL" ? (hasSubTlTier ? "Stage 2: Team Leader Approval Required" : "Team Leader Approval Required") :
                                  activeApprovalStage === "ADMIN" ? ((hasTlTier || hasSubTlTier) ? "Final Stage: Admin Approval Required" : "Direct Admin Approval Required") :
                                    "Approval Action Required")}
                        </h3>
                      </div>

                      {isDone && !showReopenForm ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium text-rose-600/70 leading-relaxed italic">
                            Task finalized. Re-open to make changes.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => setShowReopenForm(true)}
                            className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                          >
                            <RotateCcw className="size-3 mr-2" />
                            Re-open
                          </Button>
                        </div>
                      ) : !isDone && !isApproving && !isRejecting ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-medium text-orange-600/70 leading-relaxed italic">
                            {activeApprovalStage === "SUB_TL" ? "Submitted for review. Awaiting Sub-Team Leader / Reviewer verification." :
                              activeApprovalStage === "TL" ? (hasSubTlTier ? "Verified by Sub-TL. Awaiting Team Leader approval." : "Submitted for review. Awaiting Team Leader approval.") :
                                activeApprovalStage === "ADMIN" ? ((hasTlTier || hasSubTlTier) ? "Verified by team leadership. Awaiting final Admin approval." : "Submitted for review. Awaiting direct Admin approval.") :
                                  "Submitted for review. Please verify and decide."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {canApprove && (
                              <Button
                                onClick={() => setIsApproving(true)}
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                <CheckCircle2 className="size-3.5 mr-2" />
                                {activeApprovalStage === "SUB_TL" ? (task.reviewerId ? "Approve (Reviewer)" : "Approve (Sub-TL)") :
                                  activeApprovalStage === "TL" ? "Approve (TL)" :
                                    activeApprovalStage === "ADMIN" ? "Approve (Admin)" : "Approve"}
                              </Button>
                            )}
                            {canRejectReview && (
                              <Button
                                variant="outline"
                                onClick={() => setIsRejecting(true)}
                                className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest rounded-sm"
                              >
                                <XCircle className="size-3.5 mr-2" />
                                Reject
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {isApproving && (
                            <div className="space-y-2 p-3 bg-primary/5 rounded-sm border border-primary/10 mt-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <Star className="size-3 fill-primary" /> Performance Rating
                              </label>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                  >
                                    <Star
                                      className={cn(
                                        "size-5 transition-colors",
                                        (rating || 0) >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                      )}
                                    />
                                  </button>
                                ))}
                                {rating && (
                                  <span className="ml-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                    {rating === 1 ? "Needs Improvement" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very Good" : "Excellent"}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          <Textarea
                            placeholder={isRejecting ? "Reason for rejection (required)..." : isApproving ? "Approval remarks (optional)..." : "Reason for re-opening (required)..."}
                            value={approvalReason}
                            onChange={(e) => setApprovalReason(e.target.value)}
                            className="min-h-15 mt-2 text-sm font-normal bg-white dark:bg-slate-900 border-border rounded-sm shadow-none focus-visible:ring-1 transition-all"
                          />
                          <div className="flex items-center gap-2">
                            {isApproving && (
                              <Button
                                type="button"
                                disabled={updating}
                                onClick={async () => {
                                  setUpdating(true)
                                  const result = await approveTask(task.id, "APPROVED", approvalReason, rating > 0 ? rating : undefined)
                                  setUpdating(false)
                                  if (result.success) {
                                    const updatedTask = result.data
                                    // Merge updated data but preserve deep relations that approveTask doesn't return
                                    setTask((prev: any) => ({
                                      ...prev,
                                      ...updatedTask,
                                      creator: prev?.creator,
                                      reviewer: prev?.reviewer,
                                      department: prev?.department,
                                      assignedTo: prev?.assignedTo,
                                      comments: prev?.comments
                                    }))

                                    // Fetch the latest task to get new comments
                                    const latestTaskRes = await getLatestTask(task.id)
                                    if (latestTaskRes.success && latestTaskRes.data) {
                                      setTask(latestTaskRes.data)
                                    }



                                    toast.success("Task approved successfully")
                                    setApprovalReason("")
                                    setRating(0)
                                    setIsApproving(false)
                                    router.refresh()
                                  } else {
                                    toast.error(result.error || "Failed to approve task")
                                  }
                                }}
                                className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm"
                              >
                                {activeApprovalStage === "SUB_TL" ? (task.reviewerId ? "Confirm Reviewer Approval" : "Confirm Sub-TL Approval") :
                                  activeApprovalStage === "TL" ? "Confirm Team Leader Approval" :
                                    activeApprovalStage === "ADMIN" ? "Confirm Admin Approval" : "Confirm Approval"}
                              </Button>
                            )}
                            {(isRejecting || isDone) && (
                              <Button
                                variant="outline"
                                disabled={updating}
                                onClick={async () => {
                                  if (!approvalReason.trim()) {
                                    toast.error(isDone ? "Reason required." : "Feedback required.")
                                    return
                                  }
                                  setUpdating(true)
                                  const result = await approveTask(task.id, "REJECTED", approvalReason)
                                  setUpdating(false)
                                  if (result.success) {
                                    const updatedTask = result.data
                                    // Merge updated data but preserve deep relations that approveTask doesn't return
                                    setTask((prev: any) => ({
                                      ...prev,
                                      ...updatedTask,
                                      creator: prev?.creator,
                                      reviewer: prev?.reviewer,
                                      department: prev?.department,
                                      assignedTo: prev?.assignedTo,
                                      comments: prev?.comments
                                    }))

                                    // Fetch the latest task to get new comments
                                    const latestTaskRes = await getLatestTask(task.id)
                                    if (latestTaskRes.success && latestTaskRes.data) {
                                      setTask(latestTaskRes.data)
                                    }



                                    toast.success(isDone ? "Task Re-opened" : "Task Rejected")
                                    setApprovalReason("")
                                    setIsRejecting(false)
                                    setShowReopenForm(false)
                                    router.refresh()
                                  }
                                }}
                                className="flex-1 h-9 border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                              >
                                {isDone ? "Confirm Re-open" : "Confirm Reject"}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setIsApproving(false)
                                setIsRejecting(false)
                                setShowReopenForm(false)
                                setApprovalReason("")
                                setRating(0)
                              }}
                              className="h-9 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Milestone History (Acceptance, Rejection & Reopen Log) */}
                  {(() => {
                    const milestoneTimeline: any[] = []

                    // Add milestone comments
                    task.comments?.forEach((c: any) => {
                      if (isMilestoneComment(c)) {
                        milestoneTimeline.push({
                          id: `comment-${c.id}`,
                          date: new Date(c.createdAt),
                          type: "comment",
                          content: c.content,
                          user: c.user,
                          commentType: c.type
                        })
                      }
                    })


                    // Sort descending (latest milestone first)
                    milestoneTimeline.sort((a, b) => b.date.getTime() - a.date.getTime())

                    if (milestoneTimeline.length === 0) return null

                    return (
                      <section className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                            <History className="size-3" />
                            <span>Task History</span>
                          </h3>
                          {(milestoneTimeline.length > 3) && (
                            <button
                              onClick={() => setShowLogs(!showLogs)}
                              className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline"
                            >
                              {showLogs ? "Show Less" : "View Full"}
                            </button>
                          )}
                        </div>
                        <div className="relative space-y-4 pl-3 border-l border-border/60">
                          {milestoneTimeline
                            .slice(0, showLogs ? 50 : 3)
                            .map((item) => {
                              const isReject = item.content.includes("❌ REJECTED") || item.content.includes("Rejected") || item.content.includes("REJECT_TASK")
                              const isReopen = item.content.includes("🔄 RE-OPENED") || item.content.includes("Re-opened") || item.content.includes("REOPEN_TASK")
                              const isApproval = item.content.includes("✅ APPROVED") || item.content.includes("Approved") || item.content.includes("APPROVE_TASK")
                              const isAccept = !isReject && !isReopen && !isApproval

                              // Clean content for display
                              const cleanedContent = item.content
                                .replace("❌ REJECTED: ", "")
                                .replace("🔄 RE-OPENED: ", "")
                                .replace("✅ APPROVED: ", "")
                                .replace("✅ Accepted: ", "")
                                .replace("✅ Accepted negotiated terms: ", "")

                              return (
                                <div key={item.id} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar className="size-5 shrink-0">
                                        {item.user?.avatarUrl && (
                                          <AvatarImage src={item.user.avatarUrl} alt={item.user.name || "System"} className="object-cover" />
                                        )}
                                        <AvatarFallback className="text-[7px] font-bold bg-muted">
                                          {getInitials(item.user?.name || "")}
                                        </AvatarFallback>
                                      </Avatar>

                                      <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-foreground/80 truncate">
                                            {item.user?.name || "System"}
                                          </span>
                                          {/* Badge on desktop (next to username) */}
                                          <div className="hidden sm:block shrink-0 mb-0.5">
                                            {isReject && <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border-rose-200 px-1.5 rounded-sm">Rejection</Badge>}
                                            {isReopen && <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border-blue-200 px-1.5 rounded-sm">Reopen</Badge>}
                                            {isApproval && <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 rounded-sm">Approval</Badge>}
                                            {isAccept && <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 rounded-sm">Acceptance</Badge>}
                                          </div>
                                        </div>
                                        {/* Date time on mobile (below username) */}
                                        <span className="block sm:hidden text-[8px] font-semibold text-muted-foreground/50 tabular-nums">
                                          {format(item.date, "MMM d, h:mm a")}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Badge on mobile (at the end) */}
                                    <div className="block sm:hidden shrink-0">
                                      {isReject && <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border-rose-200 px-1.5 rounded-sm">Rejection</Badge>}
                                      {isReopen && <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border-blue-200 px-1.5 rounded-sm">Reopen</Badge>}
                                      {isApproval && <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 rounded-sm">Approval</Badge>}
                                      {isAccept && <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 rounded-sm">Acceptance</Badge>}
                                    </div>

                                    {/* Date time on desktop (at the end) */}
                                    <span className="hidden sm:inline text-[8px] font-semibold text-muted-foreground/50 tabular-nums ml-auto">
                                      {format(item.date, "MMM d, h:mm a")}
                                    </span>
                                  </div>
                                  <div className={cn(
                                    "text-xs leading-relaxed font-medium prose prose-p:my-0 prose-p:leading-relaxed prose-strong:text-current prose-strong:font-bold",
                                    isReject ? "text-rose-600" : isAccept || isApproval ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/80"
                                  )} dangerouslySetInnerHTML={{ __html: cleanedContent }} />
                                </div>
                              )
                            })}
                        </div>
                      </section>
                    )
                  })()}



                  {/* Mobile-only Sidebar Content (People, Schedule, Verification) */}
                  <div className="block md:hidden border-t pt-4 mt-4">
                    <SidebarContent className="space-y-3" />
                  </div>

                </div>
              </ScrollArea>
            ) : (
              /* Unified Negotiation & Discussion Chronological Thread */
              <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col justify-between border-r-0 md:border-r border-border/40 bg-white dark:bg-card overflow-hidden">
                <ScrollArea className="flex-1 min-w-0 h-full min-h-0">
                  <div className="space-y-1 p-4 sm:p-6 pb-2 min-w-0 max-w-full">
                    {(() => {
                      const timeline: { id: string; date: Date; type: "comment" | "log"; content: string; user?: any; details?: string; commentType?: string; proposedEnd?: string | Date; isPinned?: boolean; attachmentUrl?: string; attachmentName?: string; attachmentSize?: number; mentionedUserIds?: string[] }[] = []

                      // Add comments
                      task.comments?.forEach((c: any) => {
                        if (isMilestoneComment(c)) return // Filter out milestones
                        timeline.push({
                          id: `comment-${c.id}`,
                          date: new Date(c.createdAt),
                          type: "comment",
                          content: c.content,
                          user: c.user,
                          commentType: c.type,
                          isPinned: c.isPinned,
                          attachmentUrl: c.attachmentUrl,
                          attachmentName: c.attachmentName,
                          attachmentSize: c.attachmentSize,
                          attachments: c.attachments,
                          mentionedUserIds: c.mentionedUserIds,
                          proposedEnd: c.proposedEnd,
                          userId: c.userId
                        } as any)
                      })

                      // Sort chronologically ascending
                      timeline.sort((a, b) => a.date.getTime() - b.date.getTime())

                      const lastProposalId = timeline
                        .filter(c => c.proposedEnd)
                        .pop()?.id;

                      if (timeline.length === 0) {
                        return (
                          <div className="py-12 text-center text-muted-foreground/50 border border-dashed rounded-sm">
                            <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground/20" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No messages logged yet</p>
                          </div>
                        )
                      }

                      return timeline.map((item) => {
                        // Style comment box according to negotiation type
                        const isRejected = item.commentType === "WORKLOAD_CONCERN_REJECTED" || item.commentType === "NEGOTIATION_REJECTED"
                        const isConcern = item.commentType === "WORKLOAD_CONCERN" || item.commentType === "WORKLOAD_CONCERN_REJECTED"
                        const isAcceptance = item.commentType === "ACCEPTANCE"
                        const isNegotiation = item.commentType === "NEGOTIATION" || item.commentType === "NEGOTIATION_REJECTED"
                        const isReassignment = item.commentType === "REASSIGNMENT_REQUEST"
                        const isForceCommit = item.commentType === "FORCE_COMMIT"
                        const isDiscussion = item.commentType === "DISCUSSION" || (!isConcern && !isAcceptance && !isNegotiation && !isReassignment && !isForceCommit)

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "relative pl-3 py-2 border-l-2 rounded-r-sm min-w-0 max-w-full overflow-hidden wrap-break-word [word-break:break-word]",
                              isConcern
                                ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/5"
                                : isAcceptance
                                  ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/5"
                                  : isNegotiation || isReassignment
                                    ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/5"
                                    : isForceCommit
                                      ? "border-purple-500 bg-purple-50/20 dark:bg-purple-950/5"
                                      : "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/5"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1 w-full">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="size-5 shrink-0">
                                  {item.user?.avatarUrl && (
                                    <AvatarImage src={item.user.avatarUrl} alt={item.user.name || "System"} className="object-cover" />
                                  )}
                                  <AvatarFallback className="text-[7px] font-bold bg-muted">
                                    {getInitials(item.user?.name || "System")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-foreground/80 truncate">{item.user?.name || "System"}</span>
                                    {isConcern && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 px-1.5 rounded-xs shrink-0">
                                        Concern
                                      </Badge>
                                    )}
                                    {isAcceptance && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 rounded-xs shrink-0">
                                        Accepted
                                      </Badge>
                                    )}
                                    {isNegotiation && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border-rose-200 px-1.5 rounded-xs shrink-0">
                                        Negotiation
                                      </Badge>
                                    )}
                                    {isReassignment && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border-rose-200 px-1.5 rounded-xs shrink-0">
                                        Reassignment
                                      </Badge>
                                    )}
                                    {isDiscussion && item.commentType === "DISCUSSION" && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-indigo-50 text-indigo-700 border-indigo-200 px-1.5 rounded-xs shrink-0">
                                        Discussion
                                      </Badge>
                                    )}
                                    {item.type === "comment" && (item as any).isPinned && (
                                      <Badge variant="outline" className="h-3.5 text-[8px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 border-amber-300 px-1.5 rounded-xs shrink-0 flex items-center gap-0.5">
                                        <Pin className="size-2.5 fill-current" /> Pinned
                                      </Badge>
                                    )}
                                  </div>
                                  {/* Date time on mobile (below username) */}
                                  <span className="block sm:hidden text-[8px] font-semibold text-muted-foreground/60 tabular-nums">{format(item.date, "MMM d, h:mm a")}</span>
                                </div>
                              </div>
                              {/* Actions & Date time on desktop (at the end) */}
                              <div className="flex items-center gap-2">
                                {item.type === "comment" && hasAuthority && (
                                  <button
                                    onClick={() => handlePinToggle((item as any).id.replace("comment-", ""))}
                                    className="hidden sm:flex text-muted-foreground/40 hover:text-amber-600 transition-colors"
                                    title={(item as any).isPinned ? "Unpin message" : "Pin message"}
                                  >
                                    {(item as any).isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                                  </button>
                                )}
                                {item.type === "comment" && (item.user?.id === session?.user?.id || hasAuthority) && (
                                  <button
                                    onClick={() => setDeleteCommentId((item as any).id.replace("comment-", ""))}
                                    className="flex text-muted-foreground/40 hover:text-rose-600 transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                )}
                                <span className="hidden sm:inline text-[8px] font-semibold text-muted-foreground/60 tabular-nums pr-2">{format(item.date, "MMM d, h:mm a")}</span>
                              </div>
                            </div>
                            <RichTextViewer
                              content={item.content
                                ?.replace('<strong>Reason:</strong> OVERLOADED', '<strong>Reason:</strong> Currently Overloaded / Multi-tasked')
                                ?.replace('<strong>Reason:</strong> NO_ACCESS', '<strong>Reason:</strong> Dependency or Access Missing')
                                ?.replace('<strong>Reason:</strong> SKILL_MISMATCH', '<strong>Reason:</strong> Skill Mismatch / Experience Gap')
                                ?.replace('<strong>Reason:</strong> LEAVE_PLANNED', '<strong>Reason:</strong> Planned Leave / Out of Office')}
                              className="text-xs"
                            />

                            {item.type === "comment" && (item as any).proposedEnd && (() => {
                              const isSuperseded = item.id !== lastProposalId;
                              const isStriked = isRejected || isSuperseded;
                              return (
                                <div className={cn("mt-2 text-[11px] p-2 rounded-sm border flex items-center justify-between gap-1.5 font-medium", isStriked ? "text-muted-foreground bg-muted/50 border-border/50" : "text-amber-700 bg-amber-50/50 border-amber-100")}>
                                  <div className="flex items-center gap-1.5">
                                    <CalendarIcon className="size-3" />
                                    <span className={cn(isStriked && "line-through opacity-60")}>Proposed deadline: <strong>{format(new Date((item as any).proposedEnd), "dd/MM/yyyy")}</strong></span>
                                    {isRejected && <span className="text-[9px] uppercase tracking-widest font-bold text-rose-600 ml-2">Rejected</span>}
                                    {isSuperseded && !isRejected && <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground ml-2">Superseded</span>}
                                  </div>
                                  {!isRejected && !isSuperseded && (isAdmin || (isTL && !isAssigneeTL)) && item.user?.id === task.assignedToId && task.lifecycleStatus === "NEGOTIATING" && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 py-0 border-amber-300 text-amber-700 hover:bg-amber-100/50 bg-white"
                                        onClick={() => setAcceptDeadlineCommentId((item as any).id.replace("comment-", ""))}
                                        disabled={isSubmittingResponse}
                                      >
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 py-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100/50 bg-white"
                                        onClick={() => {
                                          setRevisedEnd(new Date((item as any).proposedEnd))
                                          const editor = document.querySelector('.ProseMirror') as HTMLElement
                                          if (editor) {
                                            editor.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                            editor.focus()
                                          }
                                          toast.info("Select a new deadline below and send a counter-proposal.")
                                        }}
                                        disabled={isSubmittingResponse}
                                      >
                                        Counter-Propose
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {item.type === "comment" && ((item as any).attachmentUrl || ((item as any).attachments && ((item as any).attachments as any[]).length > 0)) && (
                              <div className="mt-2 flex flex-col gap-2">
                                {(item as any).attachmentUrl && (
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`${(item as any).attachmentUrl}${(item as any).attachmentUrl.includes('?') ? '&' : '?'}download=1`}
                                      rel="noopener noreferrer"
                                      download
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-background border border-border/50 hover:bg-muted transition-colors"
                                    >
                                      <FileText className="size-3.5 text-primary" />
                                      <span className="text-[10px] font-bold text-foreground truncate max-w-50">{(item as any).attachmentName}</span>
                                      <span className="text-[9px] font-medium text-muted-foreground/60">
                                        {formatFileSize((item as any).attachmentSize)}
                                      </span>
                                    </a>
                                    {(hasAuthority || (item as any).userId === session?.user?.id) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                        onClick={() => setDeleteAttachmentData({ isComment: true, commentId: (item.id as string).replace("comment-", ""), url: (item as any).attachmentUrl })}
                                        disabled={removingCommentAttachmentId === (item.id as string).replace("comment-", "")}
                                        title="Remove attachment"
                                      >
                                        {removingCommentAttachmentId === (item.id as string).replace("comment-", "") ? <Spinner className="size-3" /> : <X className="size-3" />}
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {(item as any).attachments && ((item as any).attachments as any[]).map((att: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <a
                                      href={`${att.url}${att.url.includes('?') ? '&' : '?'}download=1`}
                                      rel="noreferrer"
                                      download
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-background border border-border/50 hover:bg-muted transition-colors"
                                    >
                                      <FileText className="size-3.5 text-primary" />
                                      <span className="text-[10px] font-bold text-foreground truncate max-w-50">{att.name}</span>
                                      <span className="text-[9px] font-medium text-muted-foreground/60">
                                        {formatFileSize(att.size)}
                                      </span>
                                    </a>
                                    {(hasAuthority || (item as any).userId === session?.user?.id) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                        onClick={() => setDeleteAttachmentData({ isComment: true, commentId: (item.id as string).replace("comment-", ""), url: att.url })}
                                        disabled={removingCommentAttachmentId === (item.id as string).replace("comment-", "")}
                                        title="Remove attachment"
                                      >
                                        {removingCommentAttachmentId === (item.id as string).replace("comment-", "") ? <Spinner className="size-3" /> : <X className="size-3" />}
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </ScrollArea>

                {/* Composer thread text box */}
                <div className="p-4 sm:p-6 pt-2 pb-4 sm:pb-6 border-t border-border/40 bg-white dark:bg-card shrink-0 flex flex-col gap-2">

                  {/* Attachments & Mentions Previews */}
                  {(attachments.length > 0 || mentionedUsers.length > 0) && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 rounded-sm px-2 py-1 text-[10px] font-medium max-w-50">
                          <FileText className="size-3 text-primary shrink-0" />
                          <span className="truncate">{att.name}</span>
                          <button onClick={() => handleRemovePreviewAttachment(idx, att.url)} className="text-muted-foreground hover:text-rose-500 ml-1">
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      {mentionedUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-sm px-2 py-1 text-[10px] font-bold">
                          @{u.name ? u.name.split(' ')[0] : 'User'}
                          <button type="button" onClick={() => setMentionedUsers(prev => prev.filter(m => m.id !== u.id))} className="hover:text-rose-500 ml-0.5">
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2 relative min-w-0 max-w-full">
                    <div className="flex-1 min-w-0 flex flex-col border border-border rounded-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all bg-white relative">

                      {/* Inline Mention Dropdown */}
                      {mentionQuery !== null && (
                        <div className="absolute bottom-[calc(100%+8px)] left-0 w-72 bg-popover text-popover-foreground border border-border rounded-md shadow-2xl overflow-hidden z-100 animate-in fade-in slide-in-from-bottom-2">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between">
                            <span>Select Member</span>
                            {mentionQuery && <span className="text-[9px] lowercase font-normal">matching &quot;{mentionQuery}&quot;</span>}
                          </div>
                          <ScrollArea className="max-h-45">
                            <div className="flex flex-col">
                              {(() => {
                                const q = (mentionQuery || "").toLowerCase()
                                const filtered = mentionableUsers.filter(m =>
                                  (m.name && m.name.toLowerCase().includes(q)) ||
                                  (m.email && m.email.toLowerCase().includes(q))
                                )
                                if (filtered.length === 0) return <div className="p-3 text-center text-[10px] text-muted-foreground">No matching members</div>
                                return filtered.map(member => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => {
                                      const name = member.name?.trim() || "User"
                                      const firstName = name.split(' ')[0]
                                      const mentionText = `@${firstName} `

                                      setMentionedUsers(prev => prev.some(u => u.id === member.id) ? prev : [...prev, { id: member.id, name }])

                                      const queryStr = mentionQuery || ""
                                      const targetPattern = `@${queryStr}`
                                      const lastTargetIdx = threadComment.lastIndexOf(targetPattern)

                                      if (lastTargetIdx !== -1) {
                                        const before = threadComment.substring(0, lastTargetIdx)
                                        const after = threadComment.substring(lastTargetIdx + targetPattern.length)
                                        setThreadComment(before + mentionText + after)
                                      } else {
                                        const lastAt = threadComment.lastIndexOf("@")
                                        if (lastAt !== -1) {
                                          const before = threadComment.substring(0, lastAt)
                                          const after = threadComment.substring(lastAt + 1 + queryStr.length)
                                          setThreadComment(before + mentionText + after)
                                        } else {
                                          setThreadComment(prev => prev ? prev.replace(/<\/p>$/, ` ${mentionText}</p>`) : `<p>${mentionText}</p>`)
                                        }
                                      }
                                      setMentionQuery(null)
                                    }}
                                    className="flex items-center gap-2 p-2 hover:bg-muted/50 text-left transition-colors cursor-pointer"
                                  >
                                    <Avatar className="size-5 shrink-0">
                                      <AvatarImage src={member.avatarUrl} />
                                      <AvatarFallback className="text-[7px]">{getInitials(member.name || "")}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className="text-[11px] font-semibold truncate text-foreground">{member.name}</span>
                                      {member.email && <span className="text-[9px] text-muted-foreground truncate">{member.email}</span>}
                                    </div>
                                  </button>
                                ))
                              })()}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Inline Task Mention Dropdown */}
                      {taskMentionQuery !== null && (
                        <div className="absolute bottom-[calc(100%+8px)] left-0 w-80 bg-popover text-popover-foreground border border-border rounded-md shadow-2xl overflow-hidden z-100 animate-in fade-in slide-in-from-bottom-2">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 bg-muted/40 border-b border-border/60">Select Task to Reference</div>
                          <ScrollArea className="max-h-45">
                            <div className="flex flex-col">
                              {(() => {
                                const filtered = projectTasks.filter(t =>
                                  (t.name && t.name.toLowerCase().includes(taskMentionQuery.toLowerCase())) ||
                                  (t.taskNumber && t.taskNumber.toString().includes(taskMentionQuery))
                                )
                                if (filtered.length === 0) return <div className="p-3 text-center text-[10px] text-muted-foreground">No matches</div>
                                return filtered.map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      const mentionText = `#${t.taskNumber} `
                                      const queryStr = taskMentionQuery || ""
                                      const targetPattern = `#${queryStr}`
                                      const lastTargetIdx = threadComment.lastIndexOf(targetPattern)

                                      if (lastTargetIdx !== -1) {
                                        const before = threadComment.substring(0, lastTargetIdx)
                                        const after = threadComment.substring(lastTargetIdx + targetPattern.length)
                                        setThreadComment(before + mentionText + after)
                                      } else {
                                        const lastHash = threadComment.lastIndexOf("#")
                                        if (lastHash !== -1) {
                                          const before = threadComment.substring(0, lastHash)
                                          const after = threadComment.substring(lastHash + 1 + queryStr.length)
                                          setThreadComment(before + mentionText + after)
                                        } else {
                                          setThreadComment(prev => prev ? prev.replace(/<\/p>$/, ` ${mentionText}</p>`) : `<p>${mentionText}</p>`)
                                        }
                                      }
                                      setTaskMentionQuery(null)
                                    }}
                                    className="flex flex-col items-start gap-0.5 p-2 hover:bg-muted/50 text-left transition-colors border-b border-border/40 last:border-0 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded-sm">#{t.taskNumber}</span>
                                      <span className="text-[11px] font-semibold truncate max-w-50">{t.name}</span>
                                    </div>
                                  </button>
                                ))
                              })()}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      <RichTextEditor
                        placeholder="Discuss task scope... (Type @ to mention or # for tasks)"
                        value={threadComment}
                        onChange={(html, text) => {
                          setThreadComment(html)

                          // Mentions require plain text to accurately find the triggers
                          // Strip any trailing newlines that TipTap automatically appends to block elements
                          const cleanText = (text !== undefined ? text : (html || "").replace(/<[^>]+>/g, " ")).replace(/[\r\n]+$/, "")
                          const lastAt = cleanText.lastIndexOf("@")
                          const lastHash = cleanText.lastIndexOf("#")

                          if (lastHash !== -1 && lastHash >= lastAt) {
                            const isHashTrigger = lastHash === 0 || /\s/.test(cleanText[lastHash - 1])
                            const afterHash = cleanText.substring(lastHash + 1)
                            if (isHashTrigger && !/\s/.test(afterHash)) {
                              setTaskMentionQuery(afterHash)
                              setMentionQuery(null)
                            } else {
                              setTaskMentionQuery(null)
                            }
                          } else if (lastAt !== -1) {
                            const isAtTrigger = lastAt === 0 || /\s/.test(cleanText[lastAt - 1])
                            const afterAt = cleanText.substring(lastAt + 1)
                            if (isAtTrigger && !/\s/.test(afterAt)) {
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
                        minHeight="150px"
                        maxHeight="200px"
                        className="h-22.5 max-h-30 text-xs border-0 focus-within:ring-0 rounded-none px-0 py-0 overflow-hidden"
                      />

                      <div className="flex items-center justify-between px-2 py-1.5 bg-muted/20 border-t border-border/40">
                        <div className="flex items-center gap-1">
                          {/* File Upload */}
                          <div className="relative">
                            {!isUploadingAttachment ? (
                              <>
                                <input
                                  type="file"
                                  multiple
                                  id="thread-attachment"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                  onChange={handleAttachmentUpload}
                                />
                                <Button variant="ghost" size="icon" className="size-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 relative pointer-events-none" title="Attach file">
                                  <Paperclip className="size-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={handleCancelAttachmentUpload} className="size-7 rounded-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50" title="Cancel Upload">
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </div>

                          {Object.keys(uploadProgresses).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 ml-2">

                              {Object.entries(uploadProgresses).map(([fileId, progress]) => (
                                <div key={fileId} className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-2 py-1 rounded-sm text-[10px] min-w-30 relative overflow-hidden group">
                                  <div className="absolute inset-y-0 left-0 bg-blue-100/50 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                                  <span className="font-medium truncate max-w-25 text-blue-700 relative z-10">{fileId.split('-')[0]}</span>
                                  <span className="text-blue-600 font-bold ml-auto relative z-10">{progress}%</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelSingleAttachmentUpload(fileId)}
                                    className="text-blue-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm relative z-10 p-0.5 ml-1 transition-colors"
                                    title="Cancel this upload"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(isAdmin || (isTL && !isAssigneeTL)) && task.lifecycleStatus === "NEGOTIATING" && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("h-7 text-[10px] gap-1 px-2 rounded-sm", revisedEnd ? "bg-amber-50 border-amber-200 text-amber-700 font-bold" : "text-muted-foreground border-border/50")}>
                                  <CalendarIcon className="size-3" />
                                  {revisedEnd ? format(revisedEnd, "MMM d, yyyy") : "Propose Deadline"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={revisedEnd}
                                  onSelect={setRevisedEnd}
                                  disabled={(date) => {
                                    if (task.plannedEnd) {
                                      return date <= new Date(new Date(task.plannedEnd).setHours(0, 0, 0, 0))
                                    }
                                    return date < new Date(new Date().setHours(0, 0, 0, 0))
                                  }}
                                  initialFocus
                                />
                                {revisedEnd && (
                                  <div className="p-2 border-t flex justify-end">
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setRevisedEnd(undefined)}>Clear</Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>

                        <Button
                          disabled={threadComment.trim().length < 5 || isSubmittingResponse || isUploadingAttachment}
                          onClick={async () => {
                            setIsSubmittingResponse(true)
                            const result = await replyToThread(task.id, threadComment, {
                              revisedEnd,
                              attachments,
                              mentionedUserIds: mentionedUsers.map(u => u.id)
                            })
                            setIsSubmittingResponse(false)
                            if (result.success) {
                              setThreadComment("")
                              setRevisedEnd(undefined)
                              setAttachments([])
                              setMentionedUsers([])

                              // Reload task data in the background for smooth instant updates
                              const latestTaskRes = await getLatestTask(task.id)
                              if (latestTaskRes.success && latestTaskRes.data) {
                                setTask(latestTaskRes.data)
                              }

                              router.refresh()
                            } else {
                              toast.error(result.error || "Failed to post message")
                            }
                          }}
                          className="bg-primary text-white rounded-sm h-7 px-3 flex items-center justify-center"
                        >
                          {isSubmittingResponse ? <Spinner className="animate-spin size-3.5 mr-1" /> : <Send className="size-3.5 mr-1" />}
                          <span className="text-[10px] font-bold">Send</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Sidebar Pane */}
            <aside className="hidden md:block w-70 min-w-70 max-w-70 bg-muted/5 shrink-0 overflow-y-auto h-full border-l border-border/40">
              <SidebarContent />
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!acceptDeadlineCommentId} onOpenChange={(open) => !open && setAcceptDeadlineCommentId(null)}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-105">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will officially accept the proposed deadline and commit this task.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setAcceptDeadlineCommentId(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                if (acceptDeadlineCommentId) {
                  handleAcceptDeadline(acceptDeadlineCommentId)
                  setAcceptDeadlineCommentId(null)
                }
              }}
              disabled={isSubmittingResponse}
            >
              {isSubmittingResponse ? "Processing..." : "Accept Deadline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectDeadlineCommentId} onOpenChange={(open) => !open && setRejectDeadlineCommentId(null)}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-105">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Reject Proposed Deadline?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will strike out the proposed deadline. You can then use the reply box to propose a different timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setRejectDeadlineCommentId(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                if (rejectDeadlineCommentId) {
                  handleRejectDeadline(rejectDeadlineCommentId)
                  setRejectDeadlineCommentId(null)
                }
              }}
              disabled={isSubmittingResponse}
            >
              {isSubmittingResponse ? "Processing..." : "Reject Deadline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCommentId} onOpenChange={(open) => !open && setDeleteCommentId(null)}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-105">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete this message. Any attached files will also be permanently removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setDeleteCommentId(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                if (deleteCommentId) {
                  handleDeleteComment(deleteCommentId)
                  setDeleteCommentId(null)
                }
              }}
            >
              {isDeletingComment ? "Deleting..." : "Delete Message"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAttachmentData} onOpenChange={(open) => !open && setDeleteAttachmentData(null)}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-105">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete this attachment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setDeleteAttachmentData(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                if (deleteAttachmentData) {
                  if (deleteAttachmentData.isComment && deleteAttachmentData.commentId) {
                    handleRemoveCommentAttachment(deleteAttachmentData.commentId, deleteAttachmentData.url)
                  } else {
                    handleRemoveAttachment(deleteAttachmentData.url)
                  }
                  setDeleteAttachmentData(null)
                }
              }}
              disabled={isRemovingAttachment || !!removingCommentAttachmentId}
            >
              {(isRemovingAttachment || !!removingCommentAttachmentId) ? "Deleting..." : "Delete Attachment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-105">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">Unsaved Attachments</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              You have attachments that are uploading or haven't been saved yet.
              If you close this dialog now, these attachments will be orphaned and discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setShowCloseWarning(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={() => {
                // Delete orphaned attachments
                attachments.forEach(att => removeOrphanedAttachment(att.url).catch(console.error));
                setShowCloseWarning(false);
                onOpenChange(false);
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
