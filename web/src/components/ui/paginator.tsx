import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface PaginatorProps {
  pageSize: number;
  offset: number;
  total?: number;
  hasMore: boolean;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  labels: {
    showing: string;
    page: string;
    of: string;
    perPage: string;
  };
}

const PAGE_SIZES = [10, 20, 50];

export function Paginator({
  pageSize,
  offset,
  total,
  hasMore,
  onPageSizeChange,
  onPrev,
  onNext,
  labels,
}: PaginatorProps) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = total ? Math.ceil(total / pageSize) : null;
  const start = offset + 1;
  const end = total ? Math.min(offset + pageSize, total) : offset + pageSize;

  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {labels.showing} {total ? `${start}–${end}` : start}+
        </span>
        {total != null && <span>{labels.of} {total}</span>}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{labels.perPage}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-[65px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={offset === 0}
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center text-xs">
            {labels.page} {currentPage}
            {totalPages != null && ` ${labels.of} ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!hasMore}
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
