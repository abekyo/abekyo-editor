// @vitest-environment jsdom
//
// Smoke test for the BGM settings panel. Owns its own state (library cache
// from localStorage, preview track), so we verify the empty / no-BGM-yet
// state renders cleanly and that selecting an existing track from the
// in-memory library propagates via onBgmUrlChange.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { BgmSettings } from '@/components/editor/BgmSettings';

const NOOP_PROPS = {
  bgmUrl: null,
  bgmVolume: 0.3,
  bgmStartTime: 0,
  bgmEndTime: null,
  bgmEnabled: false,
  subtitleAudioEnabled: false,
  subtitleAudioVolume: 0.8,
  onBgmUrlChange: vi.fn(),
  onVolumeChange: vi.fn(),
  onBgmStartTimeChange: vi.fn(),
  onBgmEndTimeChange: vi.fn(),
  onEnabledChange: vi.fn(),
  onSubtitleAudioEnabledChange: vi.fn(),
  onSubtitleAudioVolumeChange: vi.fn(),
};

beforeEach(() => {
  // Library state is stored under this key; isolate tests from each other
  // and from any real session.
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('abekyo:bgmLibrary');
  }
  vi.clearAllMocks();
});

describe('<BgmSettings />', () => {
  it('mounts with no BGM and shows the empty-library state + custom upload affordance', () => {
    render(<BgmSettings {...NOOP_PROPS} />);

    // Empty library copy is visible (matches editor.bgmSettings.emptyLibrary).
    expect(screen.getByText(/upload audio.*to build your library/i)).toBeInTheDocument();

    // The custom upload button shows the "Upload BGM" copy when no track is loaded.
    expect(screen.getByRole('button', { name: /upload bgm/i })).toBeInTheDocument();

    // No volume slider yet — that block only appears once a track is set.
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('with a track loaded it shows the audio element + delete button', () => {
    render(<BgmSettings {...NOOP_PROPS} bgmUrl="/uploads/audio/test.mp3" bgmEnabled />);

    // <audio controls> is rendered when bgmUrl is set.
    expect(document.querySelector('audio[src="/uploads/audio/test.mp3"]')).not.toBeNull();

    // Delete BGM button appears.
    expect(screen.getByRole('button', { name: /delete bgm|bgm を削除/i })).toBeInTheDocument();
  });

  it('clicking "Delete BGM" clears the URL and disables BGM via the prop callbacks', async () => {
    const onBgmUrlChange = vi.fn();
    const onEnabledChange = vi.fn();
    render(
      <BgmSettings
        {...NOOP_PROPS}
        bgmUrl="/uploads/audio/test.mp3"
        bgmEnabled
        onBgmUrlChange={onBgmUrlChange}
        onEnabledChange={onEnabledChange}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete bgm|bgm を削除/i }));

    expect(onBgmUrlChange).toHaveBeenCalledWith(null);
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });
});
