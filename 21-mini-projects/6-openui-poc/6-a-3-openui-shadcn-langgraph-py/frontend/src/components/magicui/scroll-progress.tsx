// Upstream: https://magicui.design/r/scroll-progress.json (MIT). See provenance.json.
"use client"

import { motion, useScroll, type MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

interface ScrollProgressProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  keyof MotionProps
> {
  containerRef?: React.RefObject<HTMLElement | null>
  ref?: React.Ref<HTMLDivElement>
}

export function ScrollProgress({
  className,
  containerRef,
  ref,
  ...props
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll({container:containerRef})

  return (
    <motion.div
      ref={ref}
      className={cn(
        "sticky inset-x-0 top-0 z-50 h-px origin-left bg-linear-to-r from-[#A97CF8] via-[#F38CB8] to-[#FDCC92]",
        className
      )}
      style={{
        scaleX: scrollYProgress,
      }}
      {...props}
    />
  )
}
