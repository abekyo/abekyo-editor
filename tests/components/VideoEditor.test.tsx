// @vitest-environment jsdom
//
// Phase 3.0 safety net for the upcoming panel-split refactor.
//
// Goal: catch the regressions that pure-JSX moves are most likely to
// introduce — the editor failing to mount, toolbar buttons becoming
// disconnected from their handlers, or panel toggles mutating wrong state.
//
// Heavy collaborators are mocked so jsdom does not have to bring up a real
// Remotion player or Next.js router. We are not testing those — we are
// testing that VideoEditor's *own* glue still works.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { useEditorStore } from '@/lib/editorStore';
import { useAppStore } from '@/lib/store';
import type { VideoClip, Subtitle } from '@/src/types';

// VideoEditor has a useEffect that depends on `initialSubtitles` and calls
// setSubtitles inside it. If the prop is recreated each render (e.g. via the
// default `= []` parameter), it loops indefinitely. Production avoids this
// because the parent passes a stable useState-backed array. We mirror that
// here by hoisting a single shared empty array outside renders.
const STABLE_EMPTY_SUBTITLES: Subtitle[] = [];

// ----- Mock the heavy collaborators ----------------------------------------

vi.mock('@remotion/player', () => ({
  Player: vi.fn(() => <div data-testid="mock-player" />),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// `useUrlConverter` is a lightweight pass-through hook; the real one already
// works in jsdom. No mock needed.

// Now import VideoEditor — must come after vi.mock declarations so the mocks
// are in place.
import { VideoEditor } from '@/components/VideoEditor';

function sampleClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    plotName: 'Scene 1',
    text: 'Hello',
    imageUrl: '/uploads/image/test.png',
    audioUrl: '',
    duration: 3,
    index: 0,
    totalClips: 1,
    ...overrides,
  };
}

const REQUIRED_PROPS = {
  productName: 'Test Project',
  videoResolution: '1080p' as const,
  videoAspectRatio: '16:9' as const,
  videoTempo: 1.0,
  audioEnabled: false,
  onClipsChange: vi.fn(),
  onExport: vi.fn(),
  initialSubtitles: STABLE_EMPTY_SUBTITLES,
};

beforeEach(() => {
  // Both stores carry session state; reset before each test so order has no
  // bearing on outcome.
  useEditorStore.getState().reset();
  useAppStore.setState({ clips: [], productData: null, scenario: null });
  vi.clearAllMocks();
  if (typeof window !== 'undefined') {
    // Suppress the onboarding tour so it doesn't intercept clicks.
    window.localStorage.setItem('video-editor-onboarding-completed', 'true');
  }
});

describe('<VideoEditor /> mount', () => {
  it('mounts with a single clip without throwing and renders core scaffold', () => {
    render(<VideoEditor clips={[sampleClip()]} {...REQUIRED_PROPS} />);

    // The preview / Remotion Player area mounts asynchronously via the
    // url-converter hook, so we don't assert on the mock player here. What
    // we DO assert: the editor's static scaffold (toolbar IDs) is present.
    // If any of these are missing, sub-component extraction in Phase 3 has
    // dropped a button or broken its `id` plumbing.
    expect(document.getElementById('export-button')).toBeInTheDocument();
    expect(document.getElementById('subtitle-tool-button')).toBeInTheDocument();
    expect(document.getElementById('properties-tool-button')).toBeInTheDocument();
    expect(document.getElementById('bgm-tool-button')).toBeInTheDocument();
  });

  it('seeds the editor store with the initial clips (history index 0)', () => {
    render(<VideoEditor clips={[sampleClip(), sampleClip({ plotName: 'Scene 2', index: 1 })]} {...REQUIRED_PROPS} />);
    // useEffect in VideoEditor calls initHistory(clips) on mount.
    const s = useEditorStore.getState();
    expect(s.history.length).toBe(1);
    expect(s.history[0].length).toBe(2);
    expect(s.historyIndex).toBe(0);
  });
});

describe('<VideoEditor /> toolbar interactions', () => {
  it('clicking the Export button opens the export dialog', async () => {
    render(<VideoEditor clips={[sampleClip()]} {...REQUIRED_PROPS} />);
    const user = userEvent.setup();

    // Initially no dialog.
    expect(useEditorStore.getState().showExportDialog).toBe(false);

    await user.click(document.getElementById('export-button')!);
    expect(useEditorStore.getState().showExportDialog).toBe(true);
  });
});

describe('<VideoEditor /> side panel toggles (mutually exclusive via activePanel)', () => {
  it('clicking the Properties tool button activates the properties panel', async () => {
    render(<VideoEditor clips={[sampleClip()]} {...REQUIRED_PROPS} />);
    const user = userEvent.setup();

    expect(useEditorStore.getState().activePanel).toBe('none');
    await user.click(document.getElementById('properties-tool-button')!);
    expect(useEditorStore.getState().activePanel).toBe('properties');
  });

  it('opening the BGM panel automatically closes the Properties panel', async () => {
    render(<VideoEditor clips={[sampleClip()]} {...REQUIRED_PROPS} />);
    const user = userEvent.setup();

    await user.click(document.getElementById('properties-tool-button')!);
    expect(useEditorStore.getState().activePanel).toBe('properties');

    await user.click(document.getElementById('bgm-tool-button')!);
    expect(useEditorStore.getState().activePanel).toBe('bgm');
  });

  it('clicking the same panel button twice closes it (toggle off)', async () => {
    render(<VideoEditor clips={[sampleClip()]} {...REQUIRED_PROPS} />);
    const user = userEvent.setup();

    const propertiesBtn = document.getElementById('properties-tool-button')!;
    await user.click(propertiesBtn);
    expect(useEditorStore.getState().activePanel).toBe('properties');
    await user.click(propertiesBtn);
    expect(useEditorStore.getState().activePanel).toBe('none');
  });
});
