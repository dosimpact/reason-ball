import type { ReactNode } from 'react'
const paths: Record<string, ReactNode> = {
  boat: (
    <>
      <path d="M3 14h18l-4 6H7ZM12 3v11M12 3l7 8h-7M2 23q3-2 6 0t6 0 8 0" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="2" width="14" height="17" rx="4" />
      <path d="M5 10h14M12 2v8M8 19l-3 4m11-4 3 4M8 15h1m6 0h1" />
    </>
  ),
  rain: (
    <>
      <path d="M5 12a4 4 0 0 1 1-7 6 6 0 0 1 11 1 3.5 3.5 0 0 1 1 7" />
      <path d="m8 14-2 4m7-4-2 4m7-4-2 4" />
    </>
  ),
  crickets: (
    <>
      <path d="M10 8 7 3m7 5 3-5M9 12l-6-3m6 7-6 3m12-7 6-3m-6 7 6 3" />
      <ellipse cx="12" cy="14" rx="4" ry="7" />
      <path d="M12 10v10" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 9h12v7a5 5 0 0 1-10 0V9m10 1h2a3 3 0 0 1 0 6h-2M3 22h17M8 2v3m5-3v3" />
    </>
  ),
  fire: (
    <path d="M12 2c2 5-3 6 1 9 1-2 3-3 3-5 5 5 7 9 3 14-3 4-11 3-13-1-3-6 3-9 6-17Zm0 13c-4 4-1 8 2 6 2-2-1-3-2-6Z" />
  ),
  waves: (
    <>
      <path d="M2 8q3-4 6 0t6 0 8 0M2 13q3-4 6 0t6 0 8 0M2 18q3-4 6 0t6 0 8 0" />
    </>
  ),
  stream: (
    <>
      <path d="M9 2q-7 6 0 9t0 11m6-20q-7 6 0 9t0 11M2 7h2m16 10h2" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 17h5a2 2 0 1 1-2 2" />
    </>
  ),
  birds: (
    <>
      <path d="M3 15q1-8 9-5 3-8 7-4l3 2-4 1q1 9-10 10l-5 3 2-5-3-2Zm10-5-4 5" />
      <circle cx="17" cy="7" r=".6" />
    </>
  ),
  집중: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m10 7h-3m-7 10v-3M2 12h3" />
    </>
  ),
  작업: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V4h8v3M3 12q9 5 18 0m-9 0v4" />
    </>
  ),
  몰입: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 6 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" />
    </>
  ),
  사색: (
    <>
      <path d="M8 17a7 7 0 1 1 8 0l-1 3H9Zm1 6h6M9 10q3-4 6 0m-3 0v6" />
    </>
  ),
  독서: (
    <>
      <path d="M12 6q-5-3-10-1v15q5-2 10 1 5-3 10-1V5q-5-2-10 1Zm0 0v15" />
    </>
  ),
  기록: (
    <>
      <path d="m5 16 12-12 3 3L8 19l-4 1ZM14 7l3 3M4 3h7M3 7v16h18V13" />
    </>
  ),
  오후: (
    <>
      <path d="M2 19h20M4 15a8 8 0 0 1 16 0M12 1v3M3 5l2 2m16-2-2 2M1 12h2m18 0h2" />
    </>
  ),
  밤: <path d="M21 14A9 9 0 0 1 10 3 9 9 0 1 0 21 14Z" />,
  창가: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18M3 12h18M7 6l-1 3m11 6-1 3" />
    </>
  ),
}
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}
export function AmbientIcon({ id }: { id: string }) {
  return <Icon>{paths[id] ?? paths.rain}</Icon>
}
export function TagIcon({ tag }: { tag: string }) {
  return (
    <Icon>
      {tag === '카페' ? paths.cafe : (paths[tag] ?? <path d="M3 3h8l10 10-8 8L3 11Zm4 4h.01" />)}
    </Icon>
  )
}
