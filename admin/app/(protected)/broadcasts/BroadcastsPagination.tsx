"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Pagination } from "../../../components/ui/Pagination";

export function BroadcastsPagination({ page, pageSize, totalItems }: { page: number; pageSize: number; totalItems: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; pageSize?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  return (
    <Pagination
      page={page}
      pageCount={Math.max(1, Math.ceil(totalItems / pageSize))}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={(p) => navigate({ page: p })}
      onPageSizeChange={(size) => navigate({ pageSize: size })}
    />
  );
}
