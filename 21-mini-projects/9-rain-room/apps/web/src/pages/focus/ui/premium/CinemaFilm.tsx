import { useId } from 'react'

/** A self-contained silent film: the fixed aperture also clips extracted native motion. */
export default function CinemaFilm() {
  const clipId = `cinema-film-${useId().replace(/:/g, '')}`
  return (
    <g data-cinema-film="moonlit-valley" pointerEvents="none">
      <defs>
        <clipPath id={clipId}>
          <path d="M470 260h260v190H470z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d="M470 260h260v190H470z" fill="#354f59" />
        <circle cx="672" cy="297" r="17" fill="#e0d8ad" />
        <circle cx="680" cy="290" r="16" fill="#354f59" />
        <path d="M492 285h3v3h-3zm92-9h2v2h-2zm48 30h3v3h-3zm72 18h2v2h-2z" fill="#c6cfb4" />
        <g className="cinema-film-cloud">
          <path
            d="M480 307h65q7-8-4-11-2-12-17-9-10-8-18 3-17-4-17 8-15 0-9 9z"
            fill="#9eb4ad"
            opacity=".55"
          />
          <path
            d="M621 321h78q7-7-7-10-6-13-20-6-12-10-24 4-19-1-17 7-15-1-10 5z"
            fill="#aebfb3"
            opacity=".35"
          />
        </g>
        <path d="M450 379 512 318 554 361 603 305 670 375 707 335 751 376v74H450z" fill="#648578" />
        <path d="m581 331 22-26 29 31-23-9-11 9-4-9z" fill="#c5cdb4" />
        <path d="M450 401q55-60 113-16t107-7 81 11v61H450z" fill="#466e65" />
        <path d="M613 389q-34 12-19 28t-30 33h74q27-20-7-34t-1-28z" fill="#8cae9c" />
        <g className="cinema-film-water" fill="#c0cdb0" opacity=".5">
          <path d="M603 405h16v2h-16zm-6 25h25v2h-25zm-10 12h15v2h-15z" />
        </g>
        <path d="M466 384h269v6H466z" fill="#b5b89a" />
        <path
          d="M485 390v38m52-38v29m52-29v35m52-35v33m52-33v40"
          fill="none"
          stroke="#9fa98b"
          strokeWidth="5"
        />
        <g className="cinema-film-train">
          <path d="M319 368h72q10 0 14 11l2 5h-88z" fill="#d0bd89" />
          <path d="M320 365h69v4h-69z" fill="#596a58" />
          <path
            d="M325 371h10v7h-10zm16 0h10v7h-10zm16 0h10v7h-10zm17 0h13v7h-13z"
            fill="#f0d7a0"
          />
          <path d="M352 369v15m20-15v15" fill="none" stroke="#8a886b" strokeWidth="2" />
          <circle cx="333" cy="383" r="3" fill="#344d46" />
          <circle cx="382" cy="383" r="3" fill="#344d46" />
          <circle cx="400" cy="379" r="2" fill="#f3d9a1" />
        </g>
        <path d="M450 442q41-25 80-12l20 20H450zm222 8 23-33 15 18 12-26 29 41z" fill="#2d514b" />
        <g className="cinema-film-shimmer" fill="#ede1b2" opacity=".035">
          <path d="M470 260h260v190H470z" />
        </g>
        <path d="M470 260h260v9H470zm0 181h260v9H470z" fill="#223e43" />
      </g>
    </g>
  )
}
