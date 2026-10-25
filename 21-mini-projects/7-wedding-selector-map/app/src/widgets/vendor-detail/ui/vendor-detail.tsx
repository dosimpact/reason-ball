"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Vendor } from "@/entities/vendor";
import { estimatedVenueCost, formatMoney } from "@/entities/vendor";
import { Button } from "@/shared/ui/button";
import {
  GuestCostTrend,
  PlanningPriceChart,
  PriceDistribution,
  VenueCostSplit,
} from "./detail-charts";
import "./detail.css";

interface VendorDetailProps {
  vendor: Vendor;
  vendors: Vendor[];
  guests: number;
  isFavorite: boolean;
  isCompared: boolean;
  onFavorite: () => void;
  onCompare: () => void;
  onClose: () => void;
}

function MoneyRange({ min, max }: { min: number | null; max: number | null }) {
  if (min == null) return <span className="vd-muted">상담 시 확인</span>;
  if (min === 0 && (max == null || max === 0)) return <>무료</>;
  return (
    <>
      {min === 0 ? "0" : formatMoney(min)}
      {max != null && max !== min ? ` ~ ${formatMoney(max)}` : ""}
      <small>원</small>
    </>
  );
}

function VenueOffers({ vendor }: { vendor: Vendor }) {
  const offers = vendor.offers.filter((offer) => !offer.additional);
  if (offers.length === 0)
    return (
      <p className="vd-note">
        아직 비교 가능한 기본 가격이 확인되지 않았어요. 원하는 날짜·인원과 함께
        상담해보세요.
      </p>
    );
  return (
    <div className="vd-offers">
      {offers.map((offer, index) => (
        <details className="vd-offer" key={index} open={index === 0}>
          <summary>
            <div>
              <span className="vd-offer-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{offer.hall || "공시 상품"}</strong>
            </div>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <dl className="vd-cost-table">
            <div>
              <dt>성인 1인 식대</dt>
              <dd>
                <MoneyRange
                  min={offer.meal?.min ?? null}
                  max={offer.meal?.max ?? null}
                />
              </dd>
            </div>
            <div>
              <dt>
                {offer.rentalKind === "combined" ? "대관·장식 합계" : "대관료"}
              </dt>
              <dd>
                <MoneyRange
                  min={offer.rental?.min ?? null}
                  max={offer.rental?.max ?? null}
                />
              </dd>
            </div>
            {offer.decoration && (
              <div>
                <dt>장식비</dt>
                <dd>
                  <MoneyRange
                    min={offer.decoration.min}
                    max={offer.decoration.max}
                  />
                </dd>
              </div>
            )}
            <div>
              <dt>최소 보증 인원</dt>
              <dd>
                {offer.guests == null
                  ? "상담 시 확인"
                  : `${offer.guests.toLocaleString("ko-KR")}명`}
              </dd>
            </div>
          </dl>
          {offer.condition && <p className="vd-condition">{offer.condition}</p>}
        </details>
      ))}
    </div>
  );
}

const categoryLabels: Record<string, string> = {
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  package: "패키지",
  other: "기타",
  meal: "식대",
  rental: "대관",
  decoration: "장식",
};
const stateLabels: Record<string, string> = {
  known: "",
  free: "무료",
  included: "포함",
  not_disclosed: "미공개",
  on_request: "문의",
  not_applicable: "해당 없음",
};

function PlanningOffers({ vendor }: { vendor: Vendor }) {
  const terms = vendor.priceTerms.filter((term) => term.role !== "discount");
  return (
    <div className="vd-planning-offers">
      <p className="vd-note">
        기본상품과 추가 옵션을 구분해 살펴보세요. 서로 다른 상품의 최저가를 더해
        패키지로 계산하지 않습니다.
      </p>
      {terms.length === 0 && (
        <p className="vd-empty">
          자동으로 분류한 상품 가격이 없습니다. 상담 시 상품 구성을
          확인해주세요.
        </p>
      )}
      {terms.map((term) => (
        <details className="vd-planning-term" key={term.id}>
          <summary>
            <div>
              <span className="vd-service-category">
                {categoryLabels[term.category] ?? term.category}
              </span>
              <strong>{term.label || term.subject}</strong>
            </div>
            <span>
              {term.min != null
                ? term.min === 0
                  ? "무료"
                  : `${formatMoney(term.min)}원~`
                : stateLabels[term.state] || "상담 시 확인"}
              <ChevronDown size={13} aria-hidden="true" />
            </span>
          </summary>
          <div className="vd-term-body">
            <p>{term.raw}</p>
            {term.condition && <p className="vd-condition">{term.condition}</p>}
            <span className="vd-term-meta">
              {term.role === "surcharge" ? "추가 옵션" : "기본상품"} ·{" "}
              {term.basis === "person"
                ? "1인 기준"
                : term.basis === "package"
                  ? "패키지 기준"
                  : "상품 기준"}{" "}
              · 적용 조건 확인
            </span>
          </div>
        </details>
      ))}
    </div>
  );
}

function useDetailFocus() {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  function trapMobileTab(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !window.matchMedia("(max-width: 680px)").matches)
      return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (element) =>
        element.tabIndex >= 0 &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }
  return { panelRef, closeRef, trapMobileTab };
}

export function VendorDetail({
  vendor,
  vendors,
  guests,
  isFavorite,
  isCompared,
  onFavorite,
  onCompare,
  onClose,
}: VendorDetailProps) {
  const { panelRef, closeRef, trapMobileTab } = useDetailFocus();
  const estimate = estimatedVenueCost(vendor, guests);
  const isVenue = vendor.kind === "venue";
  const priceNotes = vendor.warnings
    .filter((note) =>
      /개별 기본상품|성별·1인|군 회원|무료 공시|이전 공시|가격 비교에서 제외/.test(
        note,
      ),
    )
    .map((note) =>
      note
        .replace(/원문을 확인해주세요\./g, "상담 시 적용 조건을 확인해주세요.")
        .replace(
          "원문과 무료 표시는 아래 상품별 정보에 보존합니다.",
          "무료 적용 조건은 상담 시 확인해주세요.",
        ),
    );
  const mapQuery = encodeURIComponent(vendor.name);
  return (
    <aside
      className="vendor-detail"
      aria-label={`${vendor.name} 상세 정보`}
      ref={panelRef}
      onKeyDown={trapMobileTab}
    >
      <div className="vd-topbar">
        <span>
          <ShieldCheck size={14} />
          가격과 조건 한눈에
        </span>
        <button
          type="button"
          onClick={onClose}
          className="vd-icon-button"
          ref={closeRef}
          aria-label="상세 닫기"
        >
          <X size={20} />
        </button>
      </div>
      <div className="vd-content">
        <div className="vd-eyebrow">
          {isVenue ? "THE WEDDING VENUE" : "YOUR WEDDING PARTNER"}
        </div>
        <div className="vd-title-row">
          <h2>{vendor.name}</h2>
          <button
            type="button"
            className={`vd-save ${isFavorite ? "is-active" : ""}`}
            onClick={onFavorite}
            aria-label={isFavorite ? "관심 업체 해제" : "관심 업체 저장"}
            aria-pressed={isFavorite}
          >
            <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="vd-badges">
          <span>{vendor.region}</span>
          <span>{isVenue ? "웨딩홀" : "결혼준비대행"}</span>
          {vendor.archived && <span className="vd-archived">이전 공시</span>}
          {vendor.priceYear && <span>{vendor.priceYear}년 적용</span>}
        </div>
        <div className="vd-contact">
          <p>
            <MapPin size={15} />
            <span>{vendor.address || "주소 미공개"}</span>
          </p>
          {vendor.phone && (
            <a href={`tel:${vendor.phone.replace(/[^0-9+]/g, "")}`}>
              <Phone size={15} />
              {vendor.phone}
            </a>
          )}
          <a
            href={`https://map.naver.com/p/search/${mapQuery}`}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowUpRight size={15} />
            네이버 지도에서 보기
          </a>
        </div>
        <section className="vd-price-summary">
          <div className="vd-price-top">
            <span>
              {isVenue
                ? "공시 식대·대관 기준 참고액"
                : vendor.packageMin != null
                  ? "공시 패키지 가격"
                  : "개별 기본상품 최저 공시가"}
            </span>
            <span>
              {isVenue
                ? `${guests.toLocaleString("ko-KR")}명 기준`
                : "상품별 상이"}
            </span>
          </div>
          <div className="vd-price-value">
            <MoneyRange
              min={
                isVenue
                  ? (estimate?.min ?? null)
                  : (vendor.packageMin ?? vendor.serviceMin)
              }
              max={
                isVenue
                  ? (estimate?.max ?? null)
                  : (vendor.packageMax ?? vendor.serviceMax)
              }
            />
          </div>
          {isVenue && <VenueCostSplit vendor={vendor} guests={guests} />}
          {estimate && (
            <p className="vd-note">
              {estimate.billableGuests > guests
                ? `보증 인원 ${estimate.billableGuests}명 적용 · `
                : ""}
              {estimate.notes[0]}
            </p>
          )}
          <p className="vd-price-disclaimer">
            {isVenue
              ? "추가 옵션과 미확인 비용은 포함되지 않았어요."
              : vendor.packageMin != null
                ? "패키지 구성·업체별 적용 조건이 다릅니다."
                : "스드메 합계가 아닌 개별 상품 가격입니다."}
          </p>
        </section>
        {isVenue ? (
          <>
            <GuestCostTrend vendor={vendor} guests={guests} />
            <PriceDistribution vendor={vendor} vendors={vendors} />
          </>
        ) : (
          <PlanningPriceChart vendor={vendor} />
        )}
        <section className="vd-section">
          <div className="vd-section-heading">
            <h3>{isVenue ? "홀별 가격과 조건" : "상품별 공시 가격"}</h3>
            <span>
              {isVenue
                ? `${vendor.offers.filter((offer) => !offer.additional).length}개 조건`
                : `${vendor.priceTerms.length}개 항목`}
            </span>
          </div>
          {isVenue ? (
            <VenueOffers vendor={vendor} />
          ) : (
            <PlanningOffers vendor={vendor} />
          )}
        </section>
        {priceNotes.length > 0 && (
          <section className="vd-warnings">
            <h3>가격 확인 메모</h3>
            {priceNotes.map((warning, index) => (
              <p key={index}>{warning}</p>
            ))}
          </section>
        )}
        <p className="vd-note vd-pricing-date">
          가격 정보 수집 기준 2026.10.25 · 실제 예약일과 상품 구성에 따라 최종
          견적이 달라질 수 있어요.
        </p>
      </div>
      <div className="vd-bottom">
        <Button
          variant={isCompared ? "outline" : "default"}
          onClick={onCompare}
          className="vd-compare-button"
        >
          {isCompared ? <Check size={16} /> : <Scale size={16} />}
          {isCompared ? "비교함에 담았어요" : "비교함에 담기"}
        </Button>
        {vendor.phone ? (
          <a
            className="vd-call-button"
            href={`tel:${vendor.phone.replace(/[^0-9+]/g, "")}`}
          >
            <Phone size={16} />
            상담 전화
          </a>
        ) : null}
      </div>
    </aside>
  );
}
