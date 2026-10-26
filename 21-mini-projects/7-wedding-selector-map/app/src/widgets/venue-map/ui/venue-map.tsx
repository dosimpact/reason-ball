"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Minus, Plus, ArrowUpRight } from "lucide-react";
import type * as Leaflet from "leaflet";
import type { Vendor } from "@/entities/vendor";
import { formatMoney } from "@/entities/vendor";
import { getVendorCoordinate, groupMapPoints } from "../model/map-points";
import "leaflet/dist/leaflet.css";
import "./venue-map.css";

export interface VenueMapProps {
  vendors: Vendor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
  region?: string;
  className?: string;
}

type LeafletLibrary = typeof import("leaflet");
interface MapRuntime {
  library: LeafletLibrary;
  map: Leaflet.Map;
  markers: Leaflet.LayerGroup;
}

function markerPrice(vendor: Vendor): string {
  const amount =
    vendor.kind === "venue"
      ? vendor.mealMin
      : (vendor.packageMin ?? vendor.serviceMin);
  return amount == null
    ? "가격 확인"
    : `${formatMoney(amount)}${vendor.kind === "venue" ? " /인" : "원~"}`;
}

function markerDistrict(vendor: Vendor): string | null {
  // A city name such as 대구 is not a district. Do not infer districts from region groups.
  const districts = [
    ...(vendor.address ?? "").matchAll(/(?:^|\s)([가-힣]+구)(?=\s|[,()]|$)/g),
  ];
  return districts.find((match) => match[1] !== "대구")?.[1] ?? null;
}

const LABEL_SIZE: [number, number] = [160, 54];

function markerLabel(vendor: Vendor, className: string) {
  const content = document.createElement("span");
  content.className = className;
  const name = document.createElement("strong");
  name.className = "atlas-marker-name";
  name.textContent = vendor.name;
  const price = document.createElement("small");
  price.className = "atlas-marker-price";
  price.textContent = markerPrice(vendor);
  const meta = document.createElement("span");
  meta.className = "atlas-marker-meta";
  meta.append(price);
  const district = markerDistrict(vendor);
  if (district) {
    const badge = document.createElement("span");
    badge.className = "atlas-marker-district";
    badge.textContent = district;
    meta.append(badge);
  }
  content.append(name, meta);
  return content;
}

function priceIcon(
  library: LeafletLibrary,
  vendor: Vendor,
  selected: boolean,
  compact = false,
) {
  const content = compact
    ? document.createElement("span")
    : markerLabel(
        vendor,
        `atlas-price-marker ${selected ? "atlas-price-marker-selected" : ""} ${vendor.kind === "planning" ? "atlas-price-marker-planning" : ""}`,
      );
  if (compact) content.className = "atlas-location-dot";
  return library.divIcon({
    html: content,
    className: "atlas-marker-shell",
    iconSize: compact ? [14, 14] : LABEL_SIZE,
    iconAnchor: compact ? [7, 7] : [LABEL_SIZE[0] / 2, LABEL_SIZE[1] + 6],
  });
}

/** Insets are supplied by the host layout so results stay clear of floating panels. */
function visibleMapPadding(runtime: MapRuntime) {
  const style = getComputedStyle(runtime.map.getContainer());
  const left = parseFloat(style.getPropertyValue("--map-safe-left")) || 0;
  const top = parseFloat(style.getPropertyValue("--map-safe-top")) || 0;
  return {
    paddingTopLeft: runtime.library.point(left + 50, top + 70),
    paddingBottomRight: runtime.library.point(70, 100),
  };
}

function fitResults(runtime: MapRuntime, vendors: Vendor[]) {
  const { exact, regions } = groupMapPoints(vendors);
  const coordinates = [
    ...exact.map((point) => point.coordinate),
    ...regions.map((point) => point.coordinate),
  ];
  if (!coordinates.length) return;
  const bounds = runtime.library.latLngBounds(
    coordinates.map((point) => [point.latitude, point.longitude]),
  );
  runtime.map.fitBounds(bounds, {
    ...visibleMapPadding(runtime),
    maxZoom: 13,
    animate: false,
  });
}

function addVendorMarkers(
  runtime: MapRuntime,
  vendors: Vendor[],
  selectedId: string | null,
  onSelect: (id: string) => void,
) {
  const { library, markers } = runtime;
  const { exact, regions } = groupMapPoints(vendors);
  markers.clearLayers();

  const ordered = [...exact].sort(
    (a, b) =>
      Number(b.vendor.id === selectedId) - Number(a.vendor.id === selectedId),
  );
  const occupied: { x: number; y: number }[] = [];
  ordered.forEach(({ vendor, coordinate }) => {
    const pixel = runtime.map.latLngToContainerPoint([
      coordinate.latitude,
      coordinate.longitude,
    ]);
    const compact =
      vendor.id !== selectedId &&
      occupied.some(
        (point) =>
          Math.abs(point.x - pixel.x) < LABEL_SIZE[0] + 12 &&
          Math.abs(point.y - pixel.y) < LABEL_SIZE[1] + 16,
      );
    if (!compact) occupied.push(pixel);
    const marker = library.marker([coordinate.latitude, coordinate.longitude], {
      icon: priceIcon(library, vendor, vendor.id === selectedId, compact),
      title: `${vendor.name}${markerDistrict(vendor) ? ` · ${markerDistrict(vendor)}` : ""} · ${markerPrice(vendor)}`,
      alt: vendor.name,
      zIndexOffset: vendor.id === selectedId ? 1000 : 0,
      keyboard: true,
    });
    const tooltip = markerLabel(vendor, "atlas-marker-tooltip-content");
    marker.bindTooltip(tooltip, {
      direction: "top",
      offset: [0, compact ? -10 : -(LABEL_SIZE[1] + 8)],
      className: "atlas-map-tooltip",
    });
    marker.on("click", () => onSelect(vendor.id));
    marker.addTo(markers);
    marker
      .getElement()
      ?.setAttribute(
        "aria-label",
        `${vendor.name}${markerDistrict(vendor) ? ` · ${markerDistrict(vendor)}` : ""} · ${markerPrice(vendor)} · 상세 보기`,
      );
  });
  regions.forEach(({ region, vendors: regionVendors, coordinate }) => {
    const label = document.createElement("span");
    label.className = "atlas-region-marker";
    label.textContent = `${region.replace("서울(강남외)", "서울 기타")} · ${regionVendors.length}`;
    const marker = library.marker([coordinate.latitude, coordinate.longitude], {
      icon: library.divIcon({
        html: label,
        className: "atlas-marker-shell",
        iconSize: [116, 37],
        iconAnchor: [58, 18],
      }),
      title: `${region} ${regionVendors.length}곳 · 정확 위치 미확인 · 지역 대표점`,
      keyboard: true,
    });
    const popup = document.createElement("div");
    popup.className = "atlas-region-popup";
    const title = document.createElement("strong");
    title.textContent = `${region} · ${regionVendors.length}곳`;
    const note = document.createElement("p");
    note.textContent =
      "지역 대표점입니다. 정확한 위치는 업체 상세의 지도 링크에서 확인하세요.";
    popup.append(title, note);
    regionVendors.slice(0, 8).forEach((vendor) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${vendor.name} ↗`;
      button.onclick = () => {
        onSelect(vendor.id);
        runtime.map.closePopup();
      };
      popup.append(button);
    });
    marker.bindPopup(popup, { minWidth: 220, maxWidth: 280 });
    marker.addTo(markers);
  });
}

export default function VenueMap({
  vendors,
  selectedId,
  onSelect,
  onVisibleIdsChange,
  className = "",
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MapRuntime | null>(null);
  const vendorsRef = useRef(vendors);
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const points = useMemo(() => groupMapPoints(vendors), [vendors]);
  const selected = vendors.find((vendor) => vendor.id === selectedId);

  useEffect(() => {
    vendorsRef.current = vendors;
    selectRef.current = onSelect;
  }, [vendors, onSelect]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then((library) => {
      if (disposed || !containerRef.current) return;
      const map = library.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: true,
        minZoom: 5,
        maxZoom: 18,
      });
      const markers = library.layerGroup().addTo(map);
      const runtime = { library, map, markers };
      runtimeRef.current = runtime;
      map.setView([37.5177, 127.0473], 12);
      let tileFailures = 0;
      let fallbackActive = false;
      const cartoKey = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY;
      const tileUrl = cartoKey
        ? `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      const layer = library
        .tileLayer(tileUrl, {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' +
            (cartoKey
              ? ' &copy; <a href="https://carto.com/attribution/" target="_blank" rel="noreferrer">CARTO</a>'
              : ""),
          maxZoom: 19,
        })
        .addTo(map);
      layer.on("tileload", () => {
        if (!disposed) setTilesUnavailable(false);
      });
      layer.on("tileerror", () => {
        tileFailures += 1;
        if (tileFailures >= 3 && !fallbackActive) {
          fallbackActive = true;
          layer.setUrl("https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png");
          map.attributionControl.addAttribution(
            'Tiles style &copy; <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">HOT</a>, hosted by <a href="https://www.openstreetmap.fr/" target="_blank" rel="noreferrer">OSM France</a>',
          );
        } else if (fallbackActive && tileFailures >= 8 && !disposed)
          setTilesUnavailable(true);
      });
      fitResults(runtime, vendorsRef.current);
      observer = new ResizeObserver(() => {
        map.invalidateSize();
        fitResults(runtime, vendorsRef.current);
      });
      observer.observe(containerRef.current);
      if (!disposed) setReady(true);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      runtimeRef.current?.map.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !runtimeRef.current) return;
    const runtime = runtimeRef.current;
    const redraw = () =>
      addVendorMarkers(runtime, vendors, selectedId, (id) =>
        selectRef.current(id),
      );
    redraw();
    runtime.map.on("zoomend", redraw);
    return () => {
      runtime.map.off("zoomend", redraw);
    };
  }, [ready, vendors, selectedId]);

  useEffect(() => {
    if (!ready || !runtimeRef.current || !onVisibleIdsChange) return;
    const map = runtimeRef.current.map;
    const report = () => {
      const bounds = map.getBounds();
      onVisibleIdsChange(
        groupMapPoints(vendors)
          .exact.filter(({ coordinate }) =>
            bounds.contains([coordinate.latitude, coordinate.longitude]),
          )
          .map(({ vendor }) => vendor.id),
      );
    };
    report();
    map.on("moveend resize", report);
    return () => {
      map.off("moveend resize", report);
    };
  }, [ready, vendors, onVisibleIdsChange]);

  useEffect(() => {
    if (ready && runtimeRef.current) fitResults(runtimeRef.current, vendors);
  }, [ready, vendors]);

  useEffect(() => {
    if (!ready || !runtimeRef.current || !selected) return;
    const point = getVendorCoordinate(selected);
    if (point)
      runtimeRef.current.map.flyToBounds(
        [
          [point.latitude, point.longitude],
          [point.latitude, point.longitude],
        ],
        {
          ...visibleMapPadding(runtimeRef.current),
          maxZoom: Math.max(runtimeRef.current.map.getZoom(), 14),
          duration: 0.65,
        },
      );
  }, [ready, selected]);

  return (
    <section
      className={`atlas-venue-map ${className}`}
      aria-label="웨딩 업체 지도"
    >
      <div
        className="atlas-map-canvas"
        ref={containerRef}
        data-testid="venue-map-canvas"
      />
      {!ready && (
        <div className="atlas-map-loading">
          <MapPin size={24} />
          <span>우리의 시작을 지도에 담는 중</span>
        </div>
      )}
      <div className="atlas-map-caption">
        <span className="atlas-map-live-dot" />
        <span>공시로 찾는 우리만의 공간</span>
      </div>
      <div className="atlas-map-tools" aria-label="지도 조작">
        <button
          type="button"
          aria-label="지도 확대"
          onClick={() => runtimeRef.current?.map.zoomIn()}
        >
          <Plus size={19} />
        </button>
        <button
          type="button"
          aria-label="지도 축소"
          onClick={() => runtimeRef.current?.map.zoomOut()}
        >
          <Minus size={19} />
        </button>
        <button
          type="button"
          aria-label="현재 검색 결과에 지도 맞추기"
          title="현재 결과에 맞추기"
          onClick={() =>
            runtimeRef.current && fitResults(runtimeRef.current, vendors)
          }
        >
          <LocateFixed size={18} />
        </button>
      </div>
      {tilesUnavailable && (
        <div className="atlas-map-network-note" role="status">
          배경 지도를 불러오지 못했어요. 업체 목록과 가격 비교는 계속 사용할 수
          있어요.
        </div>
      )}
      <div className="atlas-map-legend">
        <span>
          <i className="atlas-legend-price" />
          주소 검색 좌표 {points.exact.length}곳
        </span>
        {points.unresolved > 0 && (
          <span>
            <i className="atlas-legend-region" />
            지역 대표점 · 정확 위치 미확인 {points.unresolved}곳
          </span>
        )}
      </div>
      {selected && (
        <a
          className="atlas-map-external"
          href={`https://map.naver.com/p/search/${encodeURIComponent(selected.name)}`}
          target="_blank"
          rel="noreferrer"
        >
          네이버 지도에서 확인
          <ArrowUpRight size={14} />
        </a>
      )}
    </section>
  );
}
