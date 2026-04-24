// @vitest-environment jsdom
//
// Smoke test for the first-visit onboarding tour. The tour:
//   - auto-shows on the very first mount (no completion flag in localStorage)
//   - is suppressed on subsequent mounts (flag is set after Skip / Finish)
//   - re-shows when the parent bumps `replayKey`

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { Onboarding } from '@/components/Onboarding';

const COMPLETION_KEY = 'video-editor-onboarding-completed';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(COMPLETION_KEY);
  }
});

describe('<Onboarding />', () => {
  it('auto-shows the first step on a fresh visit', async () => {
    render(<Onboarding />);
    // The first step is "preview"; its localized title comes from
    // onboarding.steps.preview.title in messages/en.json.
    expect(await screen.findByRole('button', { name: /next|finish/i })).toBeInTheDocument();
  });

  it('does NOT auto-show when the completion flag is already set', () => {
    window.localStorage.setItem(COMPLETION_KEY, 'true');
    render(<Onboarding />);
    expect(screen.queryByRole('button', { name: /next|finish/i })).toBeNull();
  });

  it('clicking Skip persists the completion flag and hides the tour', async () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    const user = userEvent.setup();

    // Skip is the X button labelled by the onboarding.skipAria translation.
    const skip = await screen.findByRole('button', { name: /skip|スキップ/i });
    await user.click(skip);

    expect(window.localStorage.getItem(COMPLETION_KEY)).toBe('true');
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Tour is gone — Next/Finish button no longer in the document.
    expect(screen.queryByRole('button', { name: /next|finish/i })).toBeNull();
  });
});
