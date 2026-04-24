'use client';

// Container for the three mutually-exclusive slide-in side panels:
//   - Properties (per-clip)
//   - Subtitle editor (per-subtitle)
//   - BGM settings (global)
//
// Subscribes directly to the editor store for `activePanel` + selection
// state + close actions, so the parent VideoEditor no longer threads
// `showProperties` / `showSubtitleEditor` / `bgmEnabled` props through.
// Mutual exclusion is enforced structurally by the activePanel field.

import { useTranslations } from 'next-intl';
import type { VideoClip, Subtitle } from '@/src/types';
import { useEditorStore } from '@/lib/editorStore';
import { ClipProperties } from './ClipProperties';
import { SubtitleEditor } from './SubtitleEditor';
import { BgmSettings } from './BgmSettings';

export interface SidePanelsContainerProps {
  // --- Properties panel ---
  clips: VideoClip[];
  onClipEdit: (index: number, updates: Partial<VideoClip>) => void;

  // --- Subtitle panel ---
  subtitles: Subtitle[];
  onSubtitleEdit: (id: string, updates: Partial<Subtitle>) => void;
  onSubtitleDelete: (id: string) => void;
  totalDuration: number;
  onTimeSeek: (time: number) => void;

  // --- BGM panel ---
  bgmUrl: string | null;
  bgmVolume: number;
  bgmStartTime: number;
  bgmEndTime: number | null;
  subtitleAudioEnabled: boolean;
  subtitleAudioVolume: number;
  onBgmUrlChange: (url: string | null) => void;
  onBgmVolumeChange: (volume: number) => void;
  onBgmStartTimeChange: (time: number) => void;
  onBgmEndTimeChange: (time: number | null) => void;
  onSubtitleAudioEnabledChange: (enabled: boolean) => void;
  onSubtitleAudioVolumeChange: (volume: number) => void;
}

export function SidePanelsContainer(props: SidePanelsContainerProps) {
  const activePanel = useEditorStore((s) => s.activePanel);
  if (activePanel === 'none') return null;
  if (activePanel === 'properties') return <PropertiesPanel {...props} />;
  if (activePanel === 'subtitle') return <SubtitlePanel {...props} />;
  if (activePanel === 'bgm') return <BgmPanel {...props} />;
  return null;
}

// Shared shell: dark slide-in card pinned to the right edge with a title
// and a close (✕) button. All three panels share this exact chrome — the
// only thing that varies is the body and what "close" means.
function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-[rgba(0,0,0,0.95)] backdrop-blur-xl border-l border-[rgba(255,255,255,0.1)] z-30 shadow-2xl">
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Properties ------------------------------------------------------------

function PropertiesPanel({ clips, onClipEdit }: SidePanelsContainerProps) {
  const t = useTranslations('editor');
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);

  // Properties only makes sense for a single-clip selection.
  if (selectedClipIndices.length !== 1) return null;
  const idx = selectedClipIndices[0];
  const clip = clips[idx];
  if (!clip) return null;

  return (
    <PanelShell title={t('panels.editTitle')} onClose={() => setActivePanel('none')}>
      <ClipProperties clip={clip} onUpdate={(updates) => onClipEdit(idx, updates)} />
    </PanelShell>
  );
}

// --- Subtitle --------------------------------------------------------------

function SubtitlePanel({
  subtitles,
  onSubtitleEdit,
  onSubtitleDelete,
  totalDuration,
  onTimeSeek,
}: SidePanelsContainerProps) {
  const t = useTranslations('editor');
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const selectedSubtitleIds = useEditorStore((s) => s.selectedSubtitleIds);
  const setSelectedSubtitleIds = useEditorStore((s) => s.setSelectedSubtitleIds);
  const currentTime = useEditorStore((s) => s.currentTime);

  if (selectedSubtitleIds.length !== 1) return null;
  const id = selectedSubtitleIds[0];
  const subtitle = subtitles.find((s) => s.id === id);
  if (!subtitle) return null;

  // Closing the subtitle panel also clears the selection so the user
  // returns to a clean state (matches legacy behaviour).
  const close = () => {
    setActivePanel('none');
    setSelectedSubtitleIds([]);
  };

  return (
    <PanelShell title={t('panels.subtitleEditTitle')} onClose={close}>
      <SubtitleEditor
        subtitle={subtitle}
        onUpdate={(updates) => onSubtitleEdit(id, updates)}
        onDelete={() => {
          onSubtitleDelete(id);
          close();
        }}
        totalDuration={totalDuration}
        currentTime={currentTime}
        onTimeSeek={onTimeSeek}
      />
    </PanelShell>
  );
}

// --- BGM -------------------------------------------------------------------

function BgmPanel({
  bgmUrl,
  bgmVolume,
  bgmStartTime,
  bgmEndTime,
  subtitleAudioEnabled,
  subtitleAudioVolume,
  onBgmUrlChange,
  onBgmVolumeChange,
  onBgmStartTimeChange,
  onBgmEndTimeChange,
  onSubtitleAudioEnabledChange,
  onSubtitleAudioVolumeChange,
}: SidePanelsContainerProps) {
  const t = useTranslations('editor');
  const setActivePanel = useEditorStore((s) => s.setActivePanel);

  // BgmSettings still takes a `bgmEnabled` prop for legacy reasons but
  // ignores it internally. While the panel is rendered it is by definition
  // the active panel, so pass `true`.
  return (
    <PanelShell title={t('panels.bgmSettingsTitle')} onClose={() => setActivePanel('none')}>
      <BgmSettings
        bgmUrl={bgmUrl}
        bgmVolume={bgmVolume}
        bgmStartTime={bgmStartTime}
        bgmEndTime={bgmEndTime}
        bgmEnabled
        subtitleAudioEnabled={subtitleAudioEnabled}
        subtitleAudioVolume={subtitleAudioVolume}
        onBgmUrlChange={onBgmUrlChange}
        onVolumeChange={onBgmVolumeChange}
        onBgmStartTimeChange={onBgmStartTimeChange}
        onBgmEndTimeChange={onBgmEndTimeChange}
        onEnabledChange={(enabled) => {
          // Closing BGM via the BgmSettings internal "delete" button etc.
          // collapses to the "no active panel" state.
          if (!enabled) setActivePanel('none');
        }}
        onSubtitleAudioEnabledChange={onSubtitleAudioEnabledChange}
        onSubtitleAudioVolumeChange={onSubtitleAudioVolumeChange}
      />
    </PanelShell>
  );
}
