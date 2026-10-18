import type { StudyComponentArtifact } from "@/study/renderers/component-registry";

export const sampleArtifacts: StudyComponentArtifact[] = [
  {
    component: "Graph",
    props: {
      title: "Monthly Revenue",
      size: "sm",
      data: {
        type: "bar",
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
          {
            label: "Revenue",
            data: [42000, 51000, 47000, 62000, 69000, 76000],
            color: "hsl(220, 100%, 62%)",
          },
        ],
      },
    },
  },
  {
    component: "Graph",
    props: {
      title: "Active Users",
      size: "sm",
      data: {
        type: "line",
        labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
        datasets: [
          {
            label: "Users",
            data: [1200, 1450, 1380, 1720, 1900],
            color: "hsl(160, 82%, 47%)",
          },
        ],
      },
    },
  },
  {
    component: "Graph",
    props: {
      title: "Revenue Mix",
      size: "sm",
      data: {
        type: "pie",
        labels: ["Enterprise", "Team", "Starter", "Trial"],
        datasets: [
          {
            label: "Share",
            data: [48, 28, 18, 6],
          },
        ],
      },
    },
  },
  {
    component: "Markdown",
    props: {
      title: "Executive Summary",
      variant: "bordered",
      content:
        "### Q2 operating notes\n\n- Revenue is tracking above plan.\n- Active users recovered after the Week 3 dip.\n- Enterprise mix remains the largest contributor.\n\n> Keep this note next to the revenue chart when reviewing the dashboard.",
    },
  },
  {
    component: "Markdown",
    props: {
      title: "Follow-up Actions",
      variant: "callout",
      content:
        "1. Review West region pipeline health.\n2. Compare trial conversion by acquisition channel.\n3. Add retention cohort chart after data refresh.",
    },
  },
];
