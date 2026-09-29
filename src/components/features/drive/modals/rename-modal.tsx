"use client";

import React, { useState, useEffect } from "react";
import { Edit2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriveItemWithDetails } from "@/actions/drive";

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DriveItemWithDetails | null;
  onSubmit: (id: string, newName: string) => Promise<void>;
}

export function RenameModal({ isOpen, onClose, item, onSubmit }: RenameModalProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(item.id, name.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Edit2 className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Rename {item?.type === "FOLDER" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>
              Enter a new name for &quot;{item?.name}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="h-10 rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-xl gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
