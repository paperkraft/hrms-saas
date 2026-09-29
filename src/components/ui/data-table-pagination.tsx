import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showOnlyNavigationOnMobile?: boolean;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  showOnlyNavigationOnMobile = false,
}: DataTablePaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-muted/5 gap-4">
      <div className={cn(
        "flex-1 text-[11px] font-semibold text-muted-foreground order-2 sm:order-1",
        showOnlyNavigationOnMobile && "hidden sm:block"
      )}>
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
      </div>
      
      <div className={cn(
        "flex items-center space-x-2 lg:space-x-8 order-1 sm:order-2 w-full sm:w-auto",
        showOnlyNavigationOnMobile
          ? (onPageSizeChange ? "justify-between" : "justify-center")
          : "justify-between",
        "sm:justify-end"
      )}>
        {onPageSizeChange && (
          <div className="flex items-center space-x-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Rows</p>
            <Select
              value={`${itemsPerPage}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value))
              }}
            >
              <SelectTrigger className="h-7 w-[60px] text-[10px] font-bold uppercase rounded-sm border-border/40">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent side="top" className="min-w-[60px] border-border/40">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`} className="text-[10px] font-bold uppercase">
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <div className={cn(
            "flex items-center justify-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest",
            showOnlyNavigationOnMobile && "hidden sm:flex"
          )}>
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              className="hidden h-7 w-7 p-0 lg:flex rounded-sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              className="h-7 w-7 p-0 rounded-sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              className="h-7 w-7 p-0 rounded-sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-7 w-7 p-0 lg:flex rounded-sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
