import { Brand, Card, Badge } from '@/shared/ui'
import { Button } from '@/shared/ui'
import { useState } from 'react'
import './design-system.css'
const palette = [
  ['Background', '--color-background'],
  ['Surface', '--color-surface'],
  ['Elevated', '--color-surface-elevated'],
  ['Text', '--color-text'],
  ['Secondary', '--color-text-secondary'],
  ['Status', '--color-status'],
  ['Play action', '--color-action-accent'],
  ['On play action', '--color-action-on-accent'],
  ['Glass panel', '--color-glass'],
  ['Glass border', '--color-glass-border'],
  ['On glass secondary', '--color-glass-secondary'],
  ['Status background', '--color-status-background'],
  ['Scene accent', '--color-scene-marker'],
]
export default function DesignSystem() {
  const [preset, setPreset] = useState(35)
  const [volume, setVolume] = useState(65)
  const [pressed, setPressed] = useState(false)
  return (
    <div className="page design-system-page">
      <header>
        <Brand />
        <a className="gallery-back" href="/">
          앱으로 돌아가기 ↗
        </a>
      </header>
      <main className="gallery-main">
        <section className="gallery-intro">
          <p className="ticket-label">RAIN ROOM / DESIGN SYSTEM</p>
          <h1>조용하고, 명료하게.</h1>
          <p className="intro">
            FocusFlight의 어두운 화면을 참고한 공통 디자인 시스템입니다. 아래는 앱이 실제 사용하는
            토큰과 컴포넌트입니다.
          </p>
          <p className="gallery-note">
            색상과 수치는 이 제품에 맞춰 선택한 구현값이며, 원본 앱에서 측정한 값은 아닙니다. 이
            화면의 조작은 컴포넌트 예시이며 실제 타이머·음악 설정에 영향을 주지 않습니다.
          </p>
        </section>
        <section className="gallery-section" aria-labelledby="palette-title">
          <h2 id="palette-title">01. 색상</h2>
          <div className="palette-grid">
            {palette.map(([label, token]) => (
              <div className="swatch" key={token}>
                <div className="swatch-color" style={{ background: `var(${token})` }} />
                <strong>{label}</strong>
                <code>{token}</code>
              </div>
            ))}
          </div>
        </section>
        <section className="gallery-section" aria-labelledby="type-title">
          <h2 id="type-title">02. 타이포그래피</h2>
          <Card appearance="existing" className="surface-card type-specimen">
            <p className="ticket-label">SYSTEM SANS / TABULAR NUMERALS</p>
            <h1>나만의 집중 공간</h1>
            <p className="type-body">비 내리는 카페에서, 온전히 몰입하세요.</p>
            <p className="ticket-subtitle">보조 정보는 조용하게, 행동은 명료하게.</p>
            <div className="timer" aria-label="숫자 서체 예시 35분">
              35<span>:</span>00
            </div>
            <p className="gallery-note">제목 28px · 본문 16px · 라벨 12–13px · 타이머 80px / 300</p>
          </Card>
        </section>
        <section className="gallery-section" aria-labelledby="components-title">
          <h2 id="components-title">03. 공통 컴포넌트</h2>
          <div className="gallery-components">
            <Card appearance="existing" className="surface-card">
              <div className="phase-line">
                <span className="ticket-label">STATUS & ACTION</span>
                <Badge appearance="existing" className="status-pill">
                  준비 완료
                </Badge>
              </div>
              <p className="sheet-description">
                중성 차콜 카드, 녹색 상태 표시와 재생 버튼. 저장·필터 등 일반 행동은 흰색을
                사용해요.
              </p>
              <div className="timer-actions">
                <Button
                  variant="accent"
                  size="lg"
                  className="min-w-0 flex-1"
                  aria-pressed={pressed}
                  onClick={() => setPressed((p) => !p)}
                >
                  {pressed ? '재생 일시정지' : '음악 재생'}
                </Button>
                <Button
                  variant="existing"
                  className="reset"
                  aria-label="예시 버튼 초기화"
                  onClick={() => setPressed(false)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
                  </svg>
                </Button>
              </div>
            </Card>
            <Card appearance="existing" className="surface-card">
              <fieldset>
                <legend>시간 선택 예시</legend>
                <div className="presets">
                  {[15, 25, 35, 50].map((n) => (
                    <Button
                      variant="existing"
                      key={n}
                      className={preset === n ? 'selected' : ''}
                      aria-pressed={preset === n}
                      onClick={() => setPreset(n)}
                    >
                      {n}분
                    </Button>
                  ))}
                </div>
              </fieldset>
              <label className="volume">
                <span>
                  음량 예시<span>{volume}%</span>
                </span>
                <input
                  aria-label="디자인 시스템 음량 예시"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
            </Card>
          </div>
        </section>
        <section className="gallery-section">
          <h2>04. 형태와 접근성</h2>
          <Card appearance="existing" className="surface-card">
            <p className="type-body">카드 24px · 주 버튼 56px · 최소 조작 영역 44px</p>
            <p className="sheet-description">
              색상과 함께 상태를 글자로 표시합니다. 키보드 포커스를 지원하며, 움직임 감소 설정에서는
              카페의 비와 증기 애니메이션을 멈춥니다.
            </p>
            <p className="gallery-note">
              전체화면 플레이어는 중앙 타이머와 작은 곡 정보, 민트색 재생·일시정지 버튼을
              사용합니다. 모드·다음 곡·닫기는 중성색 보조 버튼이며, 패널은 검정 글라스로 표현합니다.
              영수증과 쿠폰의 종이·잉크, 공간 등급 테두리는 각 의미에 맞는 색을 유지합니다.
            </p>
            <a className="primary button-primary" href="/">
              집중 공간으로 돌아가기
            </a>
          </Card>
        </section>
      </main>
      <footer>
        <span>Rain Room Design System</span>
        <span>Reference-informed · Dark</span>
      </footer>
    </div>
  )
}
