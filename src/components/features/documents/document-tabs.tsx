"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransition, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function DocumentTabs({ activeTab }: { activeTab: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) setPendingTab(null);
  }, [isPending]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        setPendingTab(value);
        startTransition(() => {
          router.push(`/dashboard/documents?tab=${value}`);
        });
      }}
      className="w-full mt-4"
    >
      <TabsList className="mb-0 ml-8">
        <TabsTrigger value="library" disabled={isPending}>
          {isPending && pendingTab === "library" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Library
        </TabsTrigger>
        <TabsTrigger value="project" disabled={isPending}>
          {isPending && pendingTab === "project" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Project
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
