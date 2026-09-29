"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { format } from "date-fns"
import {
  CheckCircle2,
  Circle,
  Calendar,
  MoreVertical,
  Trash2,
  Trophy,
  AlertCircle,
  Pencil,
  GripVertical
} from "lucide-react"
import { EditMilestoneDialog } from "./edit-milestone-dialog"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar as CalendarUI,
  DropdownMenuItem
} from "@/components/ui"
import { updateMilestone, deleteMilestone, reorderMilestones } from "@/actions/projects/milestones"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Milestone {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  actualDate: Date | null
  status: "PENDING" | "COMPLETED"
}

interface MilestoneListProps {
  projectId: string
  milestones: Milestone[]
  isTLorAdmin: boolean
}

export function MilestoneList({ projectId, milestones, isTLorAdmin }: MilestoneListProps) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [items, setItems] = useState(milestones)

  useEffect(() => {
    setItems(milestones)
  }, [milestones])

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    if (!isTLorAdmin) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index

    if (sourceIndex === destinationIndex) return

    const newItems = Array.from(items)
    const [reorderedItem] = newItems.splice(sourceIndex, 1)
    newItems.splice(destinationIndex, 0, reorderedItem)

    setItems(newItems)

    const orderedIds = newItems.map(item => item.id)
    const res = await reorderMilestones(projectId, orderedIds)
    if (!res.success) {
      toast.error(res.error || "Failed to reorder milestones")
      setItems(milestones) // Revert on failure
    } else {
      router.refresh()
    }
  }

  const handleToggleStatus = async (milestone: Milestone, actualDate?: Date) => {
    if (!isTLorAdmin) return

    setUpdating(milestone.id)
    const newStatus = milestone.status === "PENDING" ? "COMPLETED" : "PENDING"

    const updateData: any = { status: newStatus }
    if (newStatus === "COMPLETED" && actualDate) {
      updateData.actualDate = actualDate
    }

    const result = await updateMilestone(milestone.id, updateData)

    if (result.success) {
      toast.success(`Milestone marked as ${newStatus.toLowerCase()}`)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update milestone")
    }
    setUpdating(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this milestone?")) return

    const result = await deleteMilestone(id)
    if (result.success) {
      toast.success("Milestone deleted")
      router.refresh()
    } else {
      toast.error(result.error || "Failed to delete milestone")
    }
  }

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border/60 rounded-sm bg-muted/5">
        <div className="size-10 rounded-full bg-muted/20 flex items-center justify-center mb-3">
          <Trophy className="size-5 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-bold text-foreground/80">No milestones defined</h3>
        <p className="text-[11px] text-muted-foreground mt-1 text-center max-w-[200px]">
          Define key targets to track project completion phases.
        </p>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="milestones">
        {(provided) => (
          <div
            className="space-y-3"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {items.map((milestone, index) => (
              <Draggable
                key={milestone.id}
                draggableId={milestone.id}
                index={index}
                isDragDisabled={!isTLorAdmin}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      "group relative flex items-start gap-3 p-4 rounded-sm border transition-all",
                      milestone.status === "COMPLETED"
                        ? "bg-emerald-50/20 border-emerald-100/50"
                        : "bg-white border-border/60 hover:border-primary/20",
                      snapshot.isDragging && "shadow-xl border-primary/50 ring-1 ring-primary/20 z-50 bg-white"
                    )}
                  >
                    {isTLorAdmin && (
                      <div
                        {...provided.dragHandleProps}
                        className="mt-0.5 text-muted-foreground/30 hover:text-foreground/60 transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="size-5" />
                      </div>
                    )}

                    {milestone.status === "PENDING" && isTLorAdmin ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            disabled={updating === milestone.id}
                            className="mt-0.5 transition-colors text-muted-foreground/30 hover:text-primary/60 cursor-pointer"
                          >
                            <Circle className="size-5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 rounded-sm border-border" align="start">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Completion Date</p>
                            <CalendarUI
                              mode="single"
                              selected={new Date()}
                              onSelect={(date) => {
                                if (date) {
                                  handleToggleStatus(milestone, date)
                                }
                              }}
                              initialFocus
                              captionLayout="dropdown"
                              fromYear={1990}
                              toYear={new Date().getFullYear() + 10}
                            />
                            <div className="flex justify-between items-center pt-2 border-t border-border/40">
                              <Button variant="ghost" size="sm" className="w-full text-xs font-bold" onClick={() => handleToggleStatus(milestone, new Date())}>Complete Today</Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <button
                        disabled={!isTLorAdmin || updating === milestone.id}
                        onClick={() => milestone.status === "COMPLETED" ? handleToggleStatus(milestone) : null}
                        className={cn(
                          "mt-0.5 transition-colors",
                          milestone.status === "COMPLETED" ? "text-emerald-500" : "text-muted-foreground/30 hover:text-primary/60",
                          !isTLorAdmin && "cursor-default"
                        )}
                      >
                        {milestone.status === "COMPLETED" ? (
                          <CheckCircle2 className="size-5" />
                        ) : (
                          <Circle className="size-5" />
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className={cn(
                            "text-sm font-bold tracking-tight",
                            milestone.status === "COMPLETED" ? "text-emerald-900/80 line-through decoration-emerald-500/30" : "text-foreground/90"
                          )}>
                            {milestone.title}
                          </h4>
                          {milestone.description && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {milestone.description}
                            </p>
                          )}
                        </div>

                        {isTLorAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 -mr-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-sm border-border">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingMilestone(milestone)
                                  setShowEditDialog(true)
                                }}
                                className="text-primary focus:text-primary focus:bg-primary/5 text-[11px] font-bold uppercase tracking-widest gap-2"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(milestone.id)}
                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 text-[11px] font-bold uppercase tracking-widest gap-2"
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <div className="flex flex-wrap items-start sm:items-center gap-2 sm:gap-4 pt-2 border-t border-border/10">
                        {milestone.dueDate && (
                          <div className="flex items-start sm:items-center gap-1.5 text-muted-foreground">
                            <Calendar className="size-3 opacity-60 mt-0.5 sm:mt-0 shrink-0" />
                            <span className="text-[10px] font-bold tabular-nums flex flex-col sm:flex-row sm:gap-1">
                              <span>Target:</span>
                              <span>{format(new Date(milestone.dueDate), "MMM dd, yyyy")}</span>
                            </span>
                          </div>
                        )}

                        {milestone.actualDate && milestone.status === "COMPLETED" && (
                          <div className="flex items-start sm:items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="size-3 opacity-60 mt-0.5 sm:mt-0 shrink-0" />
                            <span className="text-[10px] font-bold tabular-nums flex flex-col sm:flex-row sm:gap-1">
                              <span>Reached on:</span>
                              <span>{format(new Date(milestone.actualDate), "MMM dd, yyyy")}</span>
                            </span>
                          </div>
                        )}

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 h-4 rounded-none mt-0.5 sm:mt-0",
                            milestone.status === "COMPLETED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          )}
                        >
                          {milestone.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <EditMilestoneDialog
        milestone={editingMilestone}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </DragDropContext>
  )
}
