import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function usePagination<T>(items: T[], itemsPerPage: number = 10, urlParamName?: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const totalItems = items?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Determine current page from URL parameter if provided, otherwise internal state
  const pageFromUrl = urlParamName && searchParams ? Number(searchParams.get(urlParamName)) || 1 : 1;
  const [internalPage, setInternalPage] = useState(pageFromUrl);

  const currentPage = urlParamName && searchParams ? pageFromUrl : internalPage;

  useEffect(() => {
    if (urlParamName && searchParams) {
      const p = Number(searchParams.get(urlParamName)) || 1;
      setInternalPage(p);
    }
  }, [searchParams, urlParamName]);

  const handlePageChange = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setInternalPage(validPage);

      if (urlParamName && searchParams) {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set(urlParamName, String(validPage));
        const search = current.toString();
        const query = search ? `?${search}` : "";
        router.push(`${pathname}${query}`, { scroll: false });
      }
    },
    [totalPages, urlParamName, searchParams, pathname, router]
  );

  // If items change and currentPage is out of bounds, adjust
  useEffect(() => {
    if (totalItems > 0 && currentPage > totalPages) {
      handlePageChange(totalPages);
    }
  }, [totalItems, totalPages, currentPage, handlePageChange]);

  const paginatedItems =
    items?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

  return {
    currentPage,
    setCurrentPage: handlePageChange,
    totalPages,
    paginatedItems,
    totalItems,
    itemsPerPage,
  };
}
