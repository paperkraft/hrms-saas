"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Trash2, Plus, Loader2, CheckCircle2, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { addTodo, toggleTodo, deleteTodo, clearCompletedTodos } from "@/actions/todo";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

interface TodoListProps {
  initialTodos: Todo[];
}

export function TodoList({ initialTodos }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const tempTodo: Todo = {
      id: tempId,
      title: newTitle.trim(),
      completed: false,
      createdAt: new Date(),
    };

    setTodos((prev) => [tempTodo, ...prev]);
    const titleToSubmit = newTitle.trim();
    setNewTitle("");

    startTransition(async () => {
      const res = await addTodo(titleToSubmit);
      if (res.success && res.data) {
        setTodos((prev) => prev.map((t) => (t.id === tempId ? (res.data as Todo) : t)));
      } else {
        setTodos((prev) => prev.filter((t) => t.id !== tempId));
        toast.error(res.error || "Failed to add task");
      }
    });
  };

  const handleToggleTodo = async (id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

    startTransition(async () => {
      const res = await toggleTodo(id);
      if (!res.success) {
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
        toast.error(res.error || "Failed to update task");
      }
    });
  };

  const handleDeleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);
    if (!todoToDelete) return;

    setTodos((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const res = await deleteTodo(id);
      if (!res.success) {
        setTodos((prev) => [...prev, todoToDelete].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        toast.error(res.error || "Failed to delete task");
      }
    });
  };

  const handleClearCompleted = async () => {
    const completedTodos = todos.filter((t) => t.completed);
    if (completedTodos.length === 0) return;

    setTodos((prev) => prev.filter((t) => !t.completed));

    startTransition(async () => {
      const res = await clearCompletedTodos();
      if (!res.success) {
        setTodos((prev) => [...prev, ...completedTodos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        toast.error(res.error || "Failed to clear completed tasks");
      } else {
        toast.success("Completed tasks cleared");
      }
    });
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs">
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ListTodo className="size-3.5 text-emerald-500 shrink-0" /> To-Do Workspace
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              {todos.length - completedCount} Active · {completedCount} Done
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
            Personal agenda, daily reminders, and fast-track action items.
          </p>
        </div>
      </div>

      <div className="p-3.5 border-b border-border/70 bg-card">
        <form onSubmit={handleAddTodo} className="flex gap-2">
          <Input
            placeholder="Add new task or action item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={isPending}
            className="h-8.5 text-xs bg-background/80 border-border/70 focus:bg-background rounded-md"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !newTitle.trim()}
            className="h-8.5 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shrink-0 cursor-pointer shadow-xs"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          </Button>
        </form>
      </div>

      <div className="divide-y divide-border/40 flex-1 overflow-y-auto">
        {todos.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
            <CheckCircle2 className="size-8 opacity-40" />
            <p className="text-xs font-semibold">All tasks completed! Have a productive day.</p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                "px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors group",
                todo.completed && "opacity-60 bg-muted/10"
              )}
            >
              <div
                onClick={() => handleToggleTodo(todo.id)}
                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
              >
                <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  {todo.completed ? (
                    <CheckSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="size-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium text-foreground truncate transition-all",
                    todo.completed && "line-through text-muted-foreground"
                  )}
                >
                  {todo.title}
                </span>
              </div>

              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded-md transition-all cursor-pointer"
                title="Delete task"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {completedCount > 0 && (
        <div className="px-4 py-2.5 border-t border-border/70 bg-muted/10 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-muted-foreground font-medium">{completedCount} tasks completed</span>
          <button
            onClick={handleClearCompleted}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Clear Completed
          </button>
        </div>
      )}
    </div>
  );
}
