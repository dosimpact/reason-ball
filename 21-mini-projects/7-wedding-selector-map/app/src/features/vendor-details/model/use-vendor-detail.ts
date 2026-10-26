"use client";
import { useEffect, useRef, useState } from "react";
import type { Vendor } from "@/entities/vendor";

function requestVendorDetail(id: string, signal: AbortSignal): Promise<Vendor> {
  return fetch(`/api/vendors/${encodeURIComponent(id)}`, { signal }).then(
    (response) => {
      if (!response.ok) throw new Error("detail");
      return response.json() as Promise<Vendor>;
    },
  );
}

/** Load rich disclosure details only after a vendor is selected. */
export function useVendorDetail(selectedId: string | null) {
  const [loadedVendor, setLoadedVendor] = useState<Vendor | null>(null);
  const [detailError, setDetailError] = useState(false);
  const detailCache = useRef(new Map<string, Vendor>());

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const cached = detailCache.current.get(selectedId);
    Promise.resolve(
      cached ?? requestVendorDetail(selectedId, controller.signal),
    )
      .then((vendor) => {
        if (!controller.signal.aborted) {
          detailCache.current.set(vendor.id, vendor);
          setLoadedVendor(vendor);
          setDetailError(false);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailError(true);
      });
    return () => controller.abort();
  }, [selectedId]);

  return { loadedVendor, detailError };
}
