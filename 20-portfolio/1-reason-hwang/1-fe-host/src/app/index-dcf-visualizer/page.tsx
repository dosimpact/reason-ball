import type { Metadata } from "next";

import { IndexDcfVisualizer } from "@/widget/index-dcf/IndexDcfVisualizer";

export const metadata: Metadata = {
  title: "Index DCF Visualizer | Reason Hwang",
  description:
    "Explore how index earnings, shareholder payouts, and discount rates combine into an illustrative fair index value.",
};

export default function IndexDcfVisualizerPage() {
  return <IndexDcfVisualizer />;
}
