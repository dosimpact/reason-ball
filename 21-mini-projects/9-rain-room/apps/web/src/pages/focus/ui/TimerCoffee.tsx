import { memo, useEffect, useState } from 'react'
import './timer-coffee.css'
function TimerCoffee({ running }: { running: boolean }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!running) return
    const sync = () => setHidden(document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [running])
  return (
    <svg
      className="timer-coffee"
      data-steaming={running}
      data-hidden={hidden}
      viewBox="0 0 64 68"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="29" cy="60" rx="25" ry="4" fill="#bfa77d" opacity=".12" />
      <path d="M46 34c17-6 18 16 1 18" fill="none" stroke="#b7a88d" strokeWidth="5" />
      <path d="M9 32h39l-4 21q-15 10-31 0Z" fill="#d9cdb5" />
      <path d="M14 37l2 14q9 6 18 5" fill="none" stroke="#eee4cf" strokeWidth="2" opacity=".5" />
      <ellipse cx="28.5" cy="32" rx="19.5" ry="4.5" fill="#eee1c7" />
      <ellipse cx="28.5" cy="32" rx="16" ry="2.8" fill="#594638" />
      <path
        d="M7 59q22 6 44 0"
        fill="none"
        stroke="#c3b798"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {running && (
        <g
          className="timer-coffee-steam"
          fill="none"
          stroke="#d8ceb8"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M19 24q-5-5 0-10t0-9" />
          <path d="M29 22q5-5 0-10t0-9" />
          <path d="M39 25q-4-5 0-10t0-8" />
        </g>
      )}
    </svg>
  )
}
export default memo(TimerCoffee)
