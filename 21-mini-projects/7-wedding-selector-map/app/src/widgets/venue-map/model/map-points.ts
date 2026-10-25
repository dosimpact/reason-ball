import type { Vendor } from "@/entities/vendor";
import { geocodeData as cachedGeocodes } from "@/entities/vendor";

export interface MapCoordinate {
  latitude: number;
  longitude: number;
  precision: "address" | "region";
  displayName?: string;
}
export interface VendorMapPoint {
  vendor: Vendor;
  coordinate: MapCoordinate;
}
export interface RegionMapPoint {
  region: string;
  vendors: Vendor[];
  coordinate: MapCoordinate;
}

const geocodes = cachedGeocodes as unknown as {
  venues: Record<string, MapCoordinate | null>;
  regions: Record<string, MapCoordinate>;
};

export function getVendorCoordinate(vendor: Vendor): MapCoordinate | null {
  if (vendor.latitude != null && vendor.longitude != null) {
    return {
      latitude: vendor.latitude,
      longitude: vendor.longitude,
      precision: "address",
    };
  }
  return geocodes.venues[vendor.id] ?? null;
}

function getRegionCoordinate(region: string): MapCoordinate | null {
  if (geocodes.regions[region]) return geocodes.regions[region];
  if (region.startsWith("서울"))
    return geocodes.regions["서울(강남외)"] ?? null;
  return (
    Object.entries(geocodes.regions).find(([key]) =>
      region.includes(key.replace(/도$/, "")),
    )?.[1] ?? null
  );
}

export function groupMapPoints(vendors: Vendor[]): {
  exact: VendorMapPoint[];
  regions: RegionMapPoint[];
  unresolved: number;
} {
  const exact: VendorMapPoint[] = [];
  const grouped = new Map<string, Vendor[]>();
  let unresolved = 0;
  for (const vendor of vendors) {
    const coordinate = getVendorCoordinate(vendor);
    if (coordinate) exact.push({ vendor, coordinate });
    else {
      unresolved += 1;
      grouped.set(vendor.region, [
        ...(grouped.get(vendor.region) ?? []),
        vendor,
      ]);
    }
  }
  const regions = [...grouped].flatMap(([region, groupedVendors]) => {
    const coordinate = getRegionCoordinate(region);
    return coordinate ? [{ region, vendors: groupedVendors, coordinate }] : [];
  });
  return { exact, regions, unresolved };
}
