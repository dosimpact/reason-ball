import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel';

const meta = {
  title: 'UI/Carousel',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectCards: Story = {
  render: () => (
    <Carousel className="mx-12 w-[min(65vw,480px)]">
      <CarouselContent>
        {['Discover', 'Design', 'Develop', 'Deliver'].map((title, i) => (
          <CarouselItem key={title}>
            <div className="flex aspect-video flex-col justify-end rounded-xl border bg-muted p-6">
              <p className="text-sm text-muted-foreground">STEP 0{i + 1}</p>
              <h3 className="text-2xl font-semibold">{title}</h3>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
export const MultipleVisible: Story = {
  render: () => (
    <Carousel opts={{ align: 'start' }} className="mx-12 w-[min(65vw,600px)]">
      <CarouselContent>
        {[1, 2, 3, 4, 5].map((n) => (
          <CarouselItem key={n} className="basis-1/2 md:basis-1/3">
            <div className="grid aspect-square place-items-center rounded-lg border bg-muted text-3xl">
              {n}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const Interaction: Story = {
  ...ProjectCards,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole('button', { name: 'Next slide' });
    await expect(
      canvas.getByRole('button', { name: 'Previous slide' }),
    ).toBeDisabled();
    await userEvent.click(next);
    await expect(
      canvas.getByRole('button', { name: 'Previous slide' }),
    ).toBeEnabled();
  },
};
