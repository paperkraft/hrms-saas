import { useState, useRef } from "react";
import { UploadCloud, FileText, X, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

import { formatFileSize } from "@/lib/utils";

interface FileShareUploadDialogProps {
  users: any[];
  departments: any[];
  onSuccess: () => void;
}

/**
 * Dialog component for uploading and sharing files.
 */
export function FileShareUploadDialog({ users, departments, onSuccess }: FileShareUploadDialogProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [expiration, setExpiration] = useState("7");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({});
  const uploadAbortedRef = useRef(false);

  /**
   * Handles the file input change event to add selected files.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(file => {
        if (file.size > 500 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 500MB limit`);
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    e.target.value = "";
  };

  /**
   * Toggles user selection.
   */
  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  /**
   * Toggles department selection.
   */
  const toggleDept = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  /**
   * Initiates the parallel file upload process.
   */
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);

      const initialProgress: Record<string, number> = {};
      selectedFiles.forEach(f => initialProgress[f.name] = 0);
      setUploadProgress(initialProgress);

      setUploadComplete(false);
      uploadAbortedRef.current = false;

      const uploadPromises = selectedFiles.map((file, fileIndex) => {
        return new Promise<{ success: boolean; name: string }>(async (resolve) => {
          try {
            if (uploadAbortedRef.current) return resolve({ success: false, name: file.name });

            // 1. Get Presigned URL
            const presignedRes = await fetch(`/api/file-share/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`);
            const presignedData = await presignedRes.json();

            if (!presignedRes.ok || !presignedData.success) {
              toast.error(presignedData.error || `Failed to get upload URL for ${file.name}`);
              setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
              return resolve({ success: false, name: file.name });
            }

            const { presignedUrl, objectName, bucket } = presignedData;

            if (uploadAbortedRef.current) return resolve({ success: false, name: file.name });

            // 2. Upload directly to MinIO using XMLHttpRequest to track progress
            const xhr = new XMLHttpRequest();
            xhrRefs.current[file.name] = xhr;

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: percentComplete }));
              }
            };

            xhr.onload = async () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  let expiresAtParam = null;
                  if (expiration !== "never") {
                    const expiresDate = new Date();
                    expiresDate.setDate(expiresDate.getDate() + parseInt(expiration));
                    expiresAtParam = expiresDate.toISOString();
                  }

                  // 3. Confirm upload with our server to create DB record
                  const confirmRes = await fetch("/api/file-share/confirm-upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      filename: file.name,
                      objectName,
                      bucket,
                      size: file.size,
                      type: file.type || "application/octet-stream",
                      expiresAtParam,
                      sharedWithIds: selectedUserIds,
                      sharedWithDeptIds: selectedDeptIds,
                      sendNotification: fileIndex === 0,
                      batchCount: selectedFiles.length.toString()
                    })
                  });

                  const confirmData = await confirmRes.json();
                  if (!confirmRes.ok || !confirmData.success) {
                    toast.error(confirmData.error || `Failed to confirm upload for ${file.name}`);
                    setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
                    resolve({ success: false, name: file.name });
                  } else {
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                    resolve({ success: true, name: file.name });
                  }
                } catch (e) {
                  toast.error(`Failed to finalize upload for ${file.name}`);
                  setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
                  resolve({ success: false, name: file.name });
                }
              } else {
                toast.error(`Upload failed for ${file.name} with status ${xhr.status}`);
                setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
                resolve({ success: false, name: file.name });
              }
            };

            xhr.onerror = () => {
              toast.error(`Network error occurred during upload for ${file.name}`);
              setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
              resolve({ success: false, name: file.name });
            };
            xhr.onabort = () => {
              setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
              resolve({ success: false, name: file.name });
            };

            xhr.open("PUT", presignedUrl, true);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.send(file);
          } catch (error: any) {
            toast.error(`Failed to upload ${file.name}: ${error.message}`);
            setUploadProgress(prev => { const n = { ...prev }; delete n[file.name]; return n; });
            resolve({ success: false, name: file.name });
          }
        });
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;

      if (uploadAbortedRef.current) {
        return;
      }

      if (successCount === selectedFiles.length) {
        toast.success("All files shared successfully");
      } else if (successCount > 0) {
        toast.success(`${successCount} files shared successfully`);
      }

      setUploadComplete(true);
      onSuccess();
    } catch (error: any) {
      if (error.message !== "Upload cancelled") {
        toast.error(error.message || "Failed to upload files");
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Aborts all ongoing uploads and clears state.
   */
  const handleCancelUpload = () => {
    uploadAbortedRef.current = true;
    Object.values(xhrRefs.current).forEach(xhr => xhr.abort());
    xhrRefs.current = {};
    setIsUploadOpen(false);
    setSelectedFiles([]);
    setExpiration("7");
    setSelectedUserIds([]);
    setSelectedDeptIds([]);
    setUploadComplete(false);
    setUploadProgress({});
    toast.info("Upload cancelled");
  };

  /**
   * Cancels a single file upload mid-stream.
   */
  const handleCancelSingleUpload = (fileName: string) => {
    if (xhrRefs.current[fileName]) {
      xhrRefs.current[fileName].abort();
      delete xhrRefs.current[fileName];
    }
  };

  return (
    <Dialog
      open={isUploadOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (uploading) {
            handleCancelUpload();
          } else {
            setIsUploadOpen(false);
            setSelectedFiles([]);
            setExpiration("7");
            setSelectedUserIds([]);
            setSelectedDeptIds([]);
            setUploadComplete(false);
            setUploadProgress({});
          }
        } else {
          setIsUploadOpen(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs cursor-pointer gap-2">
          <UploadCloud className="size-4" /> Share File
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto gap-0 rounded-md border border-border shadow-xl p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-5 border-b border-border/70 bg-muted/20">
          <DialogTitle className="text-base font-bold tracking-tight text-foreground">Share Internal File</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium mt-0.5">
            Upload and distribute files up to 500MB with users or departments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-6">
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer overflow-hidden ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const newFiles = Array.from(e.dataTransfer.files);
                const validFiles = newFiles.filter(file => {
                  if (file.size > 500 * 1024 * 1024) {
                    toast.error(`File ${file.name} exceeds 500MB limit`);
                    return false;
                  }
                  return true;
                });
                setSelectedFiles(prev => [...prev, ...validFiles]);
              }
            }}
            onClick={() => document.getElementById("file-share-upload")?.click()}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Drag and drop files here</p>
            <p className="text-xs text-muted-foreground mb-3">or click to browse</p>
            <input
              id="file-share-upload"
              type="file"
              className="hidden"
              multiple
              onChange={handleFileChange}
              disabled={uploading || uploadComplete}
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-2 text-left max-h-[250px] overflow-y-auto overflow-x-hidden w-full pr-2 custom-scrollbar">
                {selectedFiles.map((f, i) => {
                  const prog = uploadProgress[f.name];
                  const isComplete = prog === 100;
                  return (
                    <div key={`${f.name}-${i}`} className="flex flex-col p-2 border rounded-md bg-card space-y-2 w-full overflow-hidden">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="grid flex-1">
                            <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                              <span>{formatFileSize(f.size)}</span>
                              {uploading && prog !== undefined && !isComplete && <span>• Uploading... {Math.round(prog)}%</span>}
                              {isComplete && <span className="text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Done</span>}
                            </p>
                          </div>
                        </div>
                        {!isComplete && (
                          <Button variant="ghost" size="icon" type="button" onClick={(e) => {
                            e.stopPropagation();
                            if (uploading && prog !== undefined && !isComplete) {
                              handleCancelSingleUpload(f.name);
                            } else {
                              setSelectedFiles(prev => prev.filter((_, index) => index !== i));
                            }
                          }} className="shrink-0 text-muted-foreground hover:text-destructive">
                            {uploading && prog !== undefined && !isComplete ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                      {uploading && prog !== undefined && (
                        <Progress value={prog} className="h-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <p className="text-sm font-medium">Expiration:</p>
            <div>
              <Select value={expiration} onValueChange={setExpiration} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="7">7 Days (Default)</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[9px] text-muted-foreground pl-1">Auto-delete after expiration</span>
            </div>
          </div>

          <div className="grid gap-1">
            <p className="text-sm font-medium">Share With (Optional)</p>
            <p className="text-xs text-muted-foreground mb-2">Select users or departments who will see this in their "Shared With Me" tab.</p>
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="w-full grid grid-cols-2 mb-2">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="departments">Departments</TabsTrigger>
              </TabsList>
              <TabsContent value="users" className="m-0">
                <ScrollArea className="h-[150px] rounded-md border p-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                        disabled={uploading}
                      />
                      <label htmlFor={`user-${user.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {user.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="departments" className="m-0">
                <ScrollArea className="h-[150px] rounded-md border p-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={selectedDeptIds.includes(dept.id)}
                        onCheckedChange={() => toggleDept(dept.id)}
                        disabled={uploading}
                      />
                      <label htmlFor={`dept-${dept.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {dept.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

        </div>
        <DialogFooter>
          {uploadComplete ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setIsUploadOpen(false);
                setSelectedFiles([]);
                setExpiration("7");
                setSelectedUserIds([]);
                setSelectedDeptIds([]);
                setUploadComplete(false);
                setUploadProgress({});
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => uploading ? handleCancelUpload() : setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
                {uploading ? "Uploading..." : "Upload & Share"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
