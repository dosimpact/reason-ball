import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from './chart';
import { Bar, BarChart, CartesianGrid, XAxis, Area, AreaChart } from 'recharts';

const meta = {
  title: 'UI/Chart',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const config = {
  desktop: { label: '데스크톱', color: 'var(--chart-1)' },
  mobile: { label: '모바일', color: 'var(--chart-2)' },
};
const data = [
  { day: '월', desktop: 180, mobile: 120 },
  { day: '화', desktop: 220, mobile: 160 },
  { day: '수', desktop: 195, mobile: 190 },
  { day: '목', desktop: 280, mobile: 215 },
  { day: '금', desktop: 250, mobile: 240 },
  { day: '토', desktop: 165, mobile: 290 },
  { day: '일', desktop: 190, mobile: 320 },
];
export const WeeklyTraffic: Story = {
  render: () => (
    <div className="w-[min(85vw,640px)] space-y-4">
      <h3 className="font-semibold">주간 방문자</h3>
      <ChartContainer config={config} className="h-72 w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
          <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  ),
};
export const Growth: Story = {
  render: () => (
    <div className="w-[min(85vw,640px)] space-y-4">
      <h3 className="font-semibold">모바일 방문 추이</h3>
      <ChartContainer config={config} className="h-72 w-full">
        <AreaChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="mobile"
            stroke="var(--color-mobile)"
            fill="var(--color-mobile)"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  ),
};
