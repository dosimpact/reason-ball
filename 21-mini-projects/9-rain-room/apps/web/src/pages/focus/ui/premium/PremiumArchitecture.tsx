export default function PremiumArchitecture({ spaceId }: { spaceId: string }) {
  const id = spaceId.replace('premium-', '')
  return (
    <g data-premium-architecture={id} fill="none" stroke="#b9aa84" strokeWidth="4">
      {id === 'orient-express' && (
        <>
          <path d="M20 80q380 140 760 0M20 100q380 140 760 0" stroke="#bca67c" strokeWidth="9" />
          {[80, 240, 400, 560, 720].map((x) => (
            <path key={x} d={`M${x} 115v28m-30-30v-30h60v30`} />
          ))}
          <path d="M35 585h210v90H35zM530 585h230v90H530z" fill="#5f4a4b" stroke="#a08d6a" />
          <path
            d="M40 585v-75q0-35 30-35h145q30 0 30 35v75m285 0V510q0-35 30-35h170q30 0 30 35v75"
            fill="#6e5354"
            stroke="#a08d6a"
          />
        </>
      )}
      {id === 'dragon-study' && (
        <>
          <path
            d="M20 610V225Q40 105 155 100M780 610V225Q760 105 645 100"
            stroke="#666755"
            strokeWidth="35"
          />
          <path
            d="M115 780V535q0-80 95-80h90q95 0 95 80v245"
            fill="#4c5548"
            stroke="#a49b71"
            strokeWidth="9"
          />
          <path d="M140 530q100-105 230 0m-210 30 25 150m160-150-25 150" stroke="#8a865e" />
        </>
      )}
      {id === 'underwater-library' && (
        <>
          <path
            d="M18 225h100v370H18zM685 225h98v370h-98z"
            fill="#365b5e"
            stroke="#92b4aa"
            strokeWidth="8"
          />
          {[255, 330, 405, 480, 555].map((y) => (
            <path key={y} d={`M20 ${y}h95M690 ${y}h90`} stroke="#8ba6a0" strokeWidth="9" />
          ))}
          <path
            d="M105 585v-48q0-38 38-38h64v86m390 0v-48q0-38 38-38h64v86"
            stroke="#9caca0"
            strokeWidth="9"
          />
        </>
      )}
      {id === 'observatory' && (
        <>
          <path d="M35 600V100Q400-95 765 100v500" stroke="#8b9491" strokeWidth="23" />
          <path d="M75 100Q400-45 725 100M98 120Q400 0 702 120" stroke="#596d72" strokeWidth="9" />
          <path d="M80 780q320-100 640 0M100 800q300-95 600 0" stroke="#8d9d94" strokeWidth="6" />
        </>
      )}
      {id === 'moon-base' && (
        <>
          <path d="M20 580V80h130M780 580V80H650" stroke="#9bb1a6" strokeWidth="18" />
          <path d="M45 90v430m710-430v430" stroke="#ccdbbe" strokeWidth="5" />
          <path
            d="M75 710h180l30 105H50zM575 710h160l30 105H550z"
            fill="#4e7677"
            stroke="#94aea5"
          />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${88 + i * 42} 735h25v38h-25z`} fill="#a4b5a0" />
          ))}
        </>
      )}
      {id === 'memory-house' && (
        <>
          <path
            d="M15 600V120q75-85 150 0v480M635 600V120q75-85 150 0v480"
            stroke="#81795c"
            strokeWidth="13"
          />
          <path
            d="M30 320h120M30 485h120M650 320h120M650 485h120"
            stroke="#b0a07b"
            strokeWidth="7"
          />
          <path
            d="M80 730q320-110 640 0l-65 90H145z"
            fill="#655c59"
            stroke="#b0a07b"
            strokeWidth="3"
          />
          <path d="M200 760q200-55 400 0m-350 30q150-45 300 0" stroke="#9c8177" />
        </>
      )}
      {id === 'treetop-house' && (
        <path
          d="M42 820q80-185 25-420-45-190 85-350m-74 300 80-150"
          stroke="#665b3c"
          strokeWidth="45"
        />
      )}
      {id === 'neon-loft' && (
        <>
          <path
            d="M35 710 190 220m-140 440h170M65 610h155M80 560h140M95 510h125M110 460h110M125 410h95M140 360h80M155 310h65"
            stroke="#7f8c89"
            strokeWidth="7"
          />
          <path d="M28 650 170 190M220 220v490" stroke="#556d72" strokeWidth="9" />
        </>
      )}
      {id === 'midnight-jazz' && (
        <>
          <path
            d="M0 0h85v590q-15-80-28 0V0M800 0h-85v590q15-80 28 0V0"
            fill="#574149"
            stroke="#74605f"
          />
          <path d="M45 770h710v50H45z" fill="#4e4540" stroke="#918062" />
        </>
      )}
      {id === 'storm-lighthouse' && (
        <g data-lighthouse-stair="wall-strip">
          <path
            d="M18 610q55-18 62-70L19 520q55-20 62-70L20 430"
            stroke="#a3a78b"
            strokeWidth="10"
          />
          <path d="m27 585 42-16m-42-6 44-16m-41-55 40-16m-42-5 43-16" strokeWidth="3" />
        </g>
      )}
      {id === 'cloud-airship' && (
        <>
          <path
            d="M15 145Q400-90 785 145M30 170Q400-50 770 170"
            stroke="#9caa96"
            strokeWidth="12"
          />
          <path
            d="M65 600q335-140 670 0l-25 85H90z"
            fill="#57716d"
            stroke="#9caa96"
            strokeWidth="7"
          />
        </>
      )}
    </g>
  )
}
