import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerGuideProps = ExplorerSectionProps<"guideOpen" | "setGuideOpen">;
export function ExplorerGuide({ guideOpen, setGuideOpen }: ExplorerGuideProps) {
  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="guide-dialog">
        <DialogHeader>
          <p className="eyebrow">A LITTLE GUIDE FOR YOUR BIG DAY</p>
          <DialogTitle>좋은 비교가, 좋은 선택으로.</DialogTitle>
          <DialogDescription>
            오롯의 공시자료와 가격 비교 기준을 안내해 드려요.
          </DialogDescription>
        </DialogHeader>
        <div className="guide-grid">
          <div>
            <span>01</span>
            <h3>같은 인원으로 비교해요</h3>
            <p>
              웨딩홀 공개비용은 선택한 하객 수와 홀별 최소 보증인원 중 큰 값에
              식대를 곱하고, 확인된 대관료를 더합니다. 장식·필수 옵션이 포함되지
              않은 참고 금액이에요.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>구성과 시점을 살펴봐요</h3>
            <p>
              스드메 개별상품과 패키지는 다른 항목입니다. 공시 기본 구성, 적용
              연도·요일·시즌과 추가비용을 확인하세요. 공시 미확인 가격은 0원으로
              취급하지 않습니다.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>그래프를 함께 읽어봐요</h3>
            <p>
              가격 분포의 중앙값은 업체를 가격순으로 세웠을 때 가운데 금액이고,
              평균은 모든 금액을 더해 나눈 값이에요. 비용 구성 막대는 같은 홀의
              식대와 대관료를 보여줍니다. 최종 견적은 업체에 확인해주세요.
            </p>
          </div>
          <div>
            <span>04</span>
            <h3>위치 정보도 구분해요</h3>
            <p>
              주소 검색으로 확인한 지도 좌표와 지역 대표점은 다르게 표시합니다.
              방문 전 상세의 지도 검색 링크로 정확한 위치를 확인하세요. 지도 ©
              OpenStreetMap contributors · OSM France (대체 타일).
            </p>
          </div>
        </div>
        <p className="guide-note">
          <ShieldCheck size={16} />
          광고 순위 없이 공개자료를 기준으로 보여드립니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
