import {
  ArrowUpRight,
  Check,
  Heart,
  MapPin,
  Plus,
  Users,
  Building2,
  Flower2,
} from "lucide-react";
import type { Vendor } from "../model/types";
import { estimatedVenueCost } from "../model/pricing";
import { getPlanningPriceCaption } from "../model/planning-prices";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
interface Props {
  vendor: Vendor;
  guests: number;
  selected: boolean;
  favorite: boolean;
  compared: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onCompare: () => void;
  index: number;
}
export function VendorCard({
  vendor,
  guests,
  selected,
  favorite,
  compared,
  onSelect,
  onFavorite,
  onCompare,
  index,
}: Props) {
  const estimate = estimatedVenueCost(vendor, guests);
  const price =
    vendor.kind === "venue"
      ? vendor.mealMin
      : (vendor.packageMin ?? vendor.serviceMin);
  const category =
    vendor.kind === "venue" ? "WEDDING VENUE" : "WEDDING PLANNING";
  const Icon = vendor.kind === "venue" ? Building2 : Flower2;
  return (
    <article
      className={cn("vendor-card", selected && "is-selected")}
      data-vendor-id={vendor.id}
    >
      <button
        className="vendor-card-main"
        onClick={onSelect}
        aria-label={`${vendor.name} 상세 보기`}
        aria-pressed={selected}
      >
        <div className="card-topline">
          <span className="card-category">{category}</span>
          <span className="card-source">
            {vendor.archived ? "이전 공시" : "참가격 공시"}
          </span>
        </div>
        <div className="card-identity">
          <div className={cn("venue-mark", `tone-${index % 3}`)}>
            <Icon size={25} strokeWidth={1.25} />
            <span />
          </div>
          <div>
            <h3>{vendor.name}</h3>
            <p>
              <MapPin size={12} />
              {vendor.region}
              {vendor.address
                ?.match(/(?:[가-힣]+[시군구])\s/g)
                ?.slice(-1)
                .join("")
                .trim()
                ? ` · ${vendor.address
                    .match(/(?:[가-힣]+[시군구])\s/g)
                    ?.slice(-1)
                    .join("")
                    .trim()}`
                : ""}
            </p>
          </div>
          <ArrowUpRight className="card-arrow" size={17} />
        </div>
        <div className="card-price-row">
          <div>
            <span className="price-caption">
              {vendor.kind === "venue"
                ? "1인 식대"
                : getPlanningPriceCaption(vendor)}
            </span>
            <strong>
              {money(price)}
              {price != null && <small>부터</small>}
            </strong>
          </div>
          {vendor.kind === "venue" ? (
            <div className="card-estimate">
              <span>{estimate?.billableGuests ?? guests}명 공개비용</span>
              <b>{estimate ? money(estimate.min) : "가격 정보 없음"}</b>
            </div>
          ) : (
            <div className="card-estimate">
              <span>공시 기본가 기준</span>
              <b>구성 확인 필요</b>
            </div>
          )}
        </div>
        <div className="card-tags">
          {vendor.guestsMin != null && (
            <span>
              <Users size={12} />
              보증 {vendor.guestsMin}명
            </span>
          )}
          <span>
            {vendor.priceYear
              ? `${vendor.priceYear}년 적용`
              : "적용기간 확인 필요"}
          </span>
          {vendor.kind === "planning" && <span>스드메 · 준비대행</span>}
        </div>
      </button>
      <div className="card-actions">
        <button
          onClick={onFavorite}
          className={cn("save-button", favorite && "is-saved")}
          aria-label={`${vendor.name} ${favorite ? "저장 해제" : "저장"}`}
          aria-pressed={favorite}
        >
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
          <span>{favorite ? "저장됨" : "저장"}</span>
        </button>
        <button
          className={cn("add-compare", compared && "is-compared")}
          onClick={onCompare}
          aria-pressed={compared}
          aria-label={`${vendor.name} ${compared ? "비교 해제" : "비교 추가"}`}
        >
          {compared ? <Check size={14} /> : <Plus size={14} />}{" "}
          {compared ? "비교에 담김" : "비교하기"}
        </button>
      </div>
    </article>
  );
}
