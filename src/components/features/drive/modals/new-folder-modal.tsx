"use client";

import React, { useState } from "react";
import { Folder, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color?: string) => Promise<void>;
}

export function NewFolderModal({ isOpen, onClose, onSubmit }: NewFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(folderName.trim());
      setFolderName("");
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
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder to organize your files.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
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
              disabled={!folderName.trim() || isSubmitting}
              className="rounded-xl gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
