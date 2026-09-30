import { expect, test } from '@playwright/test';
import { installCleanAppState } from './test-setup';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=';
const file = (name: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });

test('REF-14 pastes an image, preserves input on invalid paste, and removes its preview', async ({ page }) => {
  await installCleanAppState(page);
  await page.goto('/chat/mia-hotelier');
  await expect(page.getByLabel('선택 모델 기능')).toContainText('이미지: 지원');
  const input = page.getByRole('textbox', { name: '영어 메시지', exact: true });
  await input.fill('Please check my booking.');
  // Dispatch a real DOM clipboard event; this does not test OS clipboard permissions.
  async function paste(names: string[], type = 'image/png') {
    await input.evaluate((element, payload) => {
      const data = new DataTransfer();
      for (const name of payload.names) data.items.add(new File([Uint8Array.from(atob(payload.png), (c) => c.charCodeAt(0))], name, { type: payload.type }));
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, { names, type, png });
  }
  await paste(['booking.png']);
  await expect(page.getByTestId('attachment-preview')).toContainText('booking.png');
  await expect.poll(() => page.getByRole('img', { name: '첨부 미리보기' }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await paste(['invalid.svg'], 'image/svg+xml');
  await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPEG' })).toBeVisible();
  await expect(page.getByTestId('attachment-preview')).toContainText('booking.png');
  await paste(['one.png', 'two.png']);
  await expect(page.getByRole('alert').filter({ hasText: '파일 하나만' })).toBeVisible();
  await expect(input).toHaveValue('Please check my booking.');
  await page.getByRole('button', { name: '첨부 제거', exact: true }).click();
  await expect(page.getByTestId('attachment-preview')).toHaveCount(0);
  const prevented = await input.evaluate((element) => {
    const data = new DataTransfer(); data.setData('text/plain', 'ordinary text');
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    element.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('REF-14 retries the same file after read failure and ignores cancelled late reads', async ({ page }) => {
  await installCleanAppState(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((png) => {
    const native = window.FileReader;
    let failed = false;
    class ControlledReader extends native {
      readAsDataURL(blob: Blob) {
        const name = (blob as File).name;
        if (name === 'retry.png' && !failed) {
          failed = true;
          queueMicrotask(() => this.dispatchEvent(new ProgressEvent('error')));
        } else if (name === 'slow.png') {
          const callback = this.onload;
          Object.assign(window, { releaseAttachmentRead: () => {
            Object.defineProperty(this, 'result', { value: `data:image/png;base64,${png}` });
            callback?.call(this, new ProgressEvent('load') as ProgressEvent<FileReader>);
          } });
        } else super.readAsDataURL(blob);
      }
    }
    window.FileReader = ControlledReader;
  }, png);
  await page.goto('/chat/mia-hotelier');
  await expect(page.getByLabel('선택 모델 기능')).toContainText('이미지: 지원');
  const input = page.getByRole('textbox', { name: '영어 메시지', exact: true });
  const picker = page.getByLabel('파일 첨부', { exact: true });
  const preview = page.getByTestId('attachment-preview');
  await input.fill('Keep this draft.');
  await picker.setInputFiles(file('original.png'));
  await expect(preview).toContainText('original.png');
  await picker.setInputFiles(file('retry.png'));
  await expect(page.getByRole('alert').filter({ hasText: '파일을 읽지 못했어요' })).toBeVisible();
  await expect(preview).toContainText('original.png');
  await picker.setInputFiles(file('retry.png'));
  await expect(preview).toContainText('retry.png');
  await picker.setInputFiles(file('slow.png'));
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '파일 읽기 취소' }).click();
  await page.evaluate(() => (window as typeof window & { releaseAttachmentRead: () => void }).releaseAttachmentRead());
  await expect(preview).toContainText('retry.png');
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeEnabled();
  await picker.setInputFiles(file('slow.png'));
  await picker.setInputFiles(file('replacement.png'));
  await expect(preview).toContainText('replacement.png');
  await page.evaluate(() => (window as typeof window & { releaseAttachmentRead: () => void }).releaseAttachmentRead());
  await expect(preview).toContainText('replacement.png');
  await expect(input).toHaveValue('Keep this draft.');
  expect(errors).toEqual([]);
});
