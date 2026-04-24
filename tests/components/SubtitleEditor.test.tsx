// @vitest-environment jsdom
//
// Smoke test for the subtitle Properties panel. Subtitles are the most
// detailed editing surface in the app — typography presets, timing, color,
// shadow, border. We focus on the high-traffic paths: text edit, delete,
// and seeking by clicking the timestamp.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { SubtitleEditor } from '@/components/editor/SubtitleEditor';
import type { Subtitle } from '@/src/types';

function sampleSubtitle(overrides: Partial<Subtitle> = {}): Subtitle {
  return {
    id: 'sub-1',
    text: 'Hello world',
    startTime: 1.5,
    endTime: 4.0,
    position: 'bottom',
    fontSize: 5,
    color: '#ffffff',
    align: 'center',
    ...overrides,
  };
}

describe('<SubtitleEditor />', () => {
  it('mounts with a subtitle and shows its text + timing in the panel', () => {
    render(
      <SubtitleEditor
        subtitle={sampleSubtitle()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        totalDuration={10}
        currentTime={0}
        onTimeSeek={vi.fn()}
      />,
    );

    // Text field is pre-filled.
    expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();

    // Start/end timestamps are shown as buttons (clicking them seeks).
    // Format: m:ss.SSS — for 1.5s that's "0:01.500".
    expect(screen.getByRole('button', { name: '0:01.500' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0:04.000' })).toBeInTheDocument();
  });

  it('calls onDelete when the delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(
      <SubtitleEditor
        subtitle={sampleSubtitle()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        totalDuration={10}
        currentTime={0}
        onTimeSeek={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    // Delete button text comes from the editor.subtitleEditor.deleteSubtitle
    // translation key.
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('clicking the start timestamp seeks playback to that time', async () => {
    const onTimeSeek = vi.fn();
    render(
      <SubtitleEditor
        subtitle={sampleSubtitle({ startTime: 2.25 })}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        totalDuration={10}
        currentTime={0}
        onTimeSeek={onTimeSeek}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '0:02.250' }));
    expect(onTimeSeek).toHaveBeenCalledWith(2.25);
  });
});
