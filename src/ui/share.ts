/**
 * Share (TECH_SPEC §17): the Web Share API where available (mostly mobile), otherwise copy the
 * URL to the clipboard and toast "Link copied". The caller flushes the URL state first.
 */
import { toast } from '@/ui/toast';

export const SHARE_TITLE = 'Wind Turbine Lab: The 59 % Limit';

export async function share(url: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: SHARE_TITLE, url });
      return;
    } catch (err) {
      // the user closed the share sheet: nothing to do
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied', 'ok');
  } catch {
    toast('Copy the address bar to share this view');
  }
}
