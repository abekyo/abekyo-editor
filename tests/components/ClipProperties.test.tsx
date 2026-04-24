// @vitest-environment jsdom
//
// Smoke test for the Properties panel that the user opens to fine-tune a
// single clip. We mount with a sample clip, then verify two of the most
// important edit affordances (duration, scene name) propagate via onUpdate.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { ClipProperties } from '@/components/editor/ClipProperties';
import type { VideoClip } from '@/src/types';

function sampleClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    plotName: 'Scene 1',
    text: '',
    imageUrl: '/uploads/image/test.png',
    audioUrl: '',
    duration: 3,
    index: 0,
    totalClips: 1,
    ...overrides,
  };
}

describe('<ClipProperties />', () => {
  it('mounts with a clip and surfaces the core edit fields', () => {
    const onUpdate = vi.fn();
    render(<ClipProperties clip={sampleClip()} onUpdate={onUpdate} />);

    // Image preview shown when imageUrl is set.
    expect(screen.getByRole('img', { name: 'Scene 1' })).toBeInTheDocument();

    // Multiple number inputs exist (duration, scale, X/Y position…); the
    // duration input is the first one and is pre-filled with clip.duration.
    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs.length).toBeGreaterThan(0);
    expect(numberInputs[0]).toHaveValue(3);

    // Scene name text field placeholder is rendered.
    expect(screen.getByPlaceholderText(/scene name|シーン名/i)).toBeInTheDocument();
  });

  it('editing the duration input fires onUpdate with a duration field', async () => {
    const onUpdate = vi.fn();
    render(<ClipProperties clip={sampleClip()} onUpdate={onUpdate} />);
    const user = userEvent.setup();

    // Type into the duration input. Because the parent test does not
    // re-render the component when onUpdate fires, we assert on shape (the
    // change wires through to onUpdate) rather than on a specific number —
    // controlled-input echo is fragile in jsdom without a real reducer.
    const durationInput = screen.getAllByRole('spinbutton')[0];
    await user.type(durationInput, '5');

    expect(onUpdate).toHaveBeenCalled();
    const calledWithDuration = onUpdate.mock.calls.some(
      (call) => typeof call[0]?.duration === 'number',
    );
    expect(calledWithDuration).toBe(true);
  });

  it('clicking "+0.5" extends the duration', async () => {
    const onUpdate = vi.fn();
    render(<ClipProperties clip={sampleClip({ duration: 3 })} onUpdate={onUpdate} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+0.5' }));
    expect(onUpdate).toHaveBeenCalledWith({ duration: 3.5 });
  });
});
