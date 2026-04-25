'use client';

import { debug, info, warn, logError } from '@/lib/utils/logger.client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Player, PlayerRef } from '@remotion/player';
import { VideoClip, Subtitle, TransitionType } from '@/src/types';
import { ProductVideo } from '@/src/ProductVideo';
import { RESOLUTIONS, VideoResolution, VideoAspectRatio } from '@/src/types';
import { useAppStore } from '@/lib/store';
import { useEditorStore } from '@/lib/editorStore';
import { SUBTITLE_PRESETS, AVAILABLE_FONTS, applyPresetToSubtitle } from '@/lib/subtitlePresets';
import { BGM_LIBRARY, getBgmByGenre, getGenres, BgmTrack } from '@/lib/bgmLibrary';
import { useUrlConverter } from '@/lib/hooks/useUrlConverter';
import { TOUR_TARGETS } from '@/lib/onboardingTargets';
import { Onboarding } from './Onboarding';
import { ToolButton } from './editor/ToolButton';
import { MediaUploadButton } from './editor/MediaUploadButton';
import { ModernTimeline } from './editor/ModernTimeline';
import { SidePanelsContainer } from './editor/SidePanelsContainer';
import { useKeyboardShortcuts } from './editor/hooks/useKeyboardShortcuts';
import { useClipHandlers } from './editor/hooks/useClipHandlers';
import { useSubtitleHandlers } from './editor/hooks/useSubtitleHandlers';
import { EditorToolbar } from './editor/EditorToolbar';
import { ShortcutsOverlay } from './editor/dialogs/ShortcutsOverlay';
import { ExportDialog } from './editor/dialogs/ExportDialog';
import { ExitConfirmDialog } from './editor/dialogs/ExitConfirmDialog';

interface VideoEditorProps {
  clips: VideoClip[];
  productName?: string;
  videoResolution: VideoResolution;
  videoAspectRatio: VideoAspectRatio;
  videoTempo: number;
  audioEnabled: boolean;
  onClipsChange: (clips: VideoClip[] | ((prevClips: VideoClip[]) => VideoClip[])) => void;
  onExport: (exportResolution: VideoResolution) => void;
  onSaveDraft?: (subtitles: Subtitle[]) => Promise<void>; // 字幕データを渡すように変更
  isSavingDraft?: boolean;
  videoUrl?: string | null; // 完成した動画のURL（オプション）
  initialSubtitles?: Subtitle[]; // 初期字幕データ（完成動画から読み込む場合）
  bgmUrl?: string | null; // BGMのURL（外部から受け取る）
  bgmVolume?: number; // BGMの音量（外部から受け取る）
  onBgmUrlChange?: (url: string | null) => void; // BGM URLの変更ハンドラ
  onBgmVolumeChange?: (volume: number) => void; // BGM音量の変更ハンドラ
  onBgmStartTimeChange?: (time: number) => void; // BGM開始位置の変更ハンドラ
  onBgmEndTimeChange?: (time: number | null) => void; // BGM終了位置の変更ハンドラ
}

export function VideoEditor({
  clips,
  productName,
  videoResolution,
  videoAspectRatio,
  videoTempo,
  audioEnabled,
  onClipsChange,
  onExport,
  onSaveDraft,
  isSavingDraft = false,
  videoUrl = null,
  initialSubtitles = [],
  bgmUrl: externalBgmUrl = null, // 外部から受け取ったBGM URL
  bgmVolume: externalBgmVolume = 0.3, // 外部から受け取ったBGM音量
  onBgmUrlChange,
  onBgmVolumeChange,
  onBgmStartTimeChange,
  onBgmEndTimeChange,
}: VideoEditorProps) {
  const t = useTranslations('editor');
  const playerRef = useRef<PlayerRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // 完成動画用のref
  const bgmAudioRef = useRef<HTMLAudioElement>(null); // BGM用のHTML5 Audio要素
  // --- State lifted to useEditorStore (Phase 2 refactor) ---
  // The selectors below preserve the local-state API that the body of this
  // component already uses (`currentTime`, `setCurrentTime`, etc.), so the
  // 4,000+ existing references don't need to change. Sub-panels can now
  // subscribe to these directly via useEditorStore in future phases.
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const currentTimeRef = useRef(0); // currentTimeの最新値を参照するためのref
  const isSeekingRef = useRef(false); // シーク中かどうかを追跡
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null); // setTimeoutのIDを保存
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null); // シーク完了待ちのsetTimeoutのIDを保存
  const bgmSyncIntervalRef = useRef<NodeJS.Timeout | null>(null); // BGM同期用のインターバル
  
  // playerKeyの変化を検出用のref（useEffectはplayerKeyの定義後に配置）
  const prevPlayerKeyRef = useRef<string | null>(null);
  // Player再マウント中フラグ（同期useEffectでピンが0秒に戻る問題を防ぐ）
  const isPlayerRemountingRef = useRef(false);
  
  // Selection (lifted)
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);
  const setSelectedClipIndices = useEditorStore((s) => s.setSelectedClipIndices);
  // Playback toggle (lifted)
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const playbackRate = useEditorStore((s) => s.playbackRate);

  // BGM playback config — still local; mirrored from useAppStore via props,
  // tied to BgmSettings sub-component. Deferred to Phase 3.
  const [bgmUrl, setBgmUrl] = useState<string | null>(externalBgmUrl);
  const [bgmVolume, setBgmVolume] = useState(externalBgmVolume);
  const [bgmStartTime, setBgmStartTime] = useState(0);
  const [bgmEndTime, setBgmEndTime] = useState<number | null>(null);
  const [subtitleAudioEnabled, setSubtitleAudioEnabled] = useState(audioEnabled);
  const [subtitleAudioVolume, setSubtitleAudioVolume] = useState(0.8);
  const [exportResolution, setExportResolution] = useState<VideoResolution>(videoResolution);
  const [rippleEditMode, setRippleEditMode] = useState(false); // リップル編集モード（常にOFF）

  // Dialogs / zoom / onboarding (lifted)
  const showExportDialog = useEditorStore((s) => s.showExportDialog);
  const setShowExportDialog = useEditorStore((s) => s.setShowExportDialog);
  const showShortcuts = useEditorStore((s) => s.showShortcuts);
  const setShowShortcuts = useEditorStore((s) => s.setShowShortcuts);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const onboardingReplayKey = useEditorStore((s) => s.onboardingReplayKey);
  const bumpOnboardingReplay = useEditorStore((s) => s.bumpOnboardingReplay);

  // Mutually-exclusive side panel — encoded as a single `activePanel` field
  // in the store. Boolean wrappers below preserve the old API
  // (showProperties / showSubtitleEditor / bgmEnabled).
  //
  // Important semantic: `setShowX(false)` must be a no-op when X is *not*
  // currently the active panel. The legacy code peppered `setShowProperties(false);
  // setBgmEnabled(false); setShowSubtitleEditor(false);` everywhere as a
  // manual "close every other panel" workaround. With activePanel enforcing
  // mutual exclusion automatically, those calls are redundant — but they
  // would be actively harmful if they reset activePanel back to 'none' after
  // we just opened a different panel. Hence the `current === target` guard.
  const activePanel = useEditorStore((s) => s.activePanel);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const showProperties = activePanel === 'properties';
  const showSubtitleEditor = activePanel === 'subtitle';
  const bgmEnabled = activePanel === 'bgm';
  const makePanelSetter = useCallback(
    (target: 'properties' | 'subtitle' | 'bgm') =>
      (val: boolean | ((prev: boolean) => boolean)) => {
        const current = useEditorStore.getState().activePanel;
        const isOpen = current === target;
        const next = typeof val === 'function' ? val(isOpen) : val;
        if (next) {
          setActivePanel(target); // open target — store enforces exclusion
        } else if (isOpen) {
          setActivePanel('none'); // only close if it was the open one
        }
        // else: target wasn't open, nothing to do — preserve current panel.
      },
    [setActivePanel],
  );
  const setShowProperties = useMemo(() => makePanelSetter('properties'), [makePanelSetter]);
  const setShowSubtitleEditor = useMemo(() => makePanelSetter('subtitle'), [makePanelSetter]);
  const setBgmEnabled = useMemo(() => makePanelSetter('bgm'), [makePanelSetter]);
  
  // URL変換フック（Remotion Player用に外部URLをpublicディレクトリ内のパスに変換）
  const imageUrls = clips.map(c => c.imageUrl);
  const audioUrls = clips.map(c => c.audioUrl);
  const {
    convertedImageUrls,
    convertedBgmUrl,
    convertedAudioUrls,
    isLoading: isUrlConverting
  } = useUrlConverter(imageUrls, bgmUrl, audioUrls);
  const [subtitles, setSubtitles] = useState<Subtitle[]>(initialSubtitles); // 字幕リスト（初期値として完成動画から読み込んだ字幕を使用）
  // Subtitle selection (lifted). showSubtitleEditor is now derived from
  // activePanel above; the wrapper setter is also defined there.
  const selectedSubtitleIds = useEditorStore((s) => s.selectedSubtitleIds);
  const setSelectedSubtitleIds = useEditorStore((s) => s.setSelectedSubtitleIds);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null); // プレビューエリアの高さ（null = 自動）
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);
  const [windowSize, setWindowSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1920, 
    height: typeof window !== 'undefined' ? window.innerHeight : 1080 
  });
  
  // 字幕のドラッグ編集用の状態
  const [draggingSubtitleInPreview, setDraggingSubtitleInPreview] = useState(false);
  const subtitleDragStartPos = useRef<{ x: number; y: number } | null>(null);
  const subtitleDragStartSubtitle = useRef<Subtitle | null>(null);
  const [editingSubtitleText, setEditingSubtitleText] = useState<string | null>(null);
  const subtitleTextInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  
  // トップに戻る機能
  const router = useRouter();
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  
  // Remotion Playerの強制再マウント用
  const [playerVisible, setPlayerVisible] = useState(true);
  const playerRemountRef = useRef<NodeJS.Timeout | null>(null);
  const initialClipsRef = useRef<VideoClip[]>(clips);
  const initialSubtitlesRef = useRef<Subtitle[]>(initialSubtitles);
  
  // プレビューとタイムラインの同期状態を追跡
  const [previewDuration, setPreviewDuration] = useState<number | null>(null); // プレビューの実際の長さ
  const [showSyncWarning, setShowSyncWarning] = useState(false); // 同期警告の表示

  // 初期状態の参照を設定
  useEffect(() => {
    initialClipsRef.current = JSON.parse(JSON.stringify(clips));
    initialSubtitlesRef.current = JSON.parse(JSON.stringify(initialSubtitles));
  }, []); // 初回のみ実行


  // clipsが変更された時の処理を統合（修正案2）
  useEffect(() => {
    debug('[VideoEditor] clips changed, updating state...');
    
    // 総時間を計算（プレビューとタイムラインの両方で使用）
    const total = clips.reduce((sum, c) => sum + (c.duration || 3), 0);
    const durationInFrames = Math.max(1, Math.ceil(total * 30));
    const calculatedDuration = durationInFrames / 30;
    
    // プレビューの長さを更新（clipsから直接計算、Playerから取得しない）
    setPreviewDuration(calculatedDuration);
    debug('[VideoEditor] プレビューの長さを更新（計算値）:', calculatedDuration, '秒');
    debug('[VideoEditor] タイムラインの長さ:', total, '秒');

    // 現在位置が範囲外の場合は調整
    if (currentTimeRef.current > total && total > 0) {
      const newTime = Math.max(0, total - 0.1);
      updateCurrentTime(newTime, true);
      debug('[VideoEditor] 現在位置を調整:', currentTimeRef.current, '秒 →', newTime, '秒');
    }
    
    // 選択中のクリップが無効になった場合は調整
    const validIndices = selectedClipIndices.filter(index => index < clips.length);
    if (validIndices.length !== selectedClipIndices.length) {
      if (validIndices.length > 0) {
        setSelectedClipIndices(validIndices);
        debug('[VideoEditor] 選択中のクリップを調整:', selectedClipIndices, '→', validIndices);
      } else if (clips.length > 0) {
        setSelectedClipIndices([clips.length - 1]);
        debug('[VideoEditor] 最後のクリップを選択');
      } else {
        setSelectedClipIndices([]);
        debug('[VideoEditor] クリップがなくなったため、選択をクリア');
      }
    }
  }, [clips]); // 依存配列を最小限に

  // initialSubtitlesが変更された場合（完成動画が読み込まれた場合）に字幕を更新
  useEffect(() => {
    // initialSubtitlesが変更された場合は、常に字幕を更新
    // 空の配列の場合はクリア、それ以外の場合は設定
    const newSubtitles = JSON.parse(JSON.stringify(initialSubtitles));
    
    // 前のプロジェクトの字幕が残らないように、必ず新しい配列で置き換える
    setSubtitles(newSubtitles);
    
    // 初期状態も更新
    initialSubtitlesRef.current = newSubtitles;
    
    // 選択状態もクリア（新しいプロジェクトに切り替わった場合）
    if (initialSubtitles.length === 0) {
      setSelectedSubtitleIds([]);
      setShowSubtitleEditor(false);
    }
    
    debug('[VideoEditor] initialSubtitlesが変更されました:', {
      count: initialSubtitles.length,
      isArray: Array.isArray(initialSubtitles),
      subtitles: initialSubtitles,
      previousCount: subtitles.length,
      hasVideoUrl: !!videoUrl,
    });
    
    // 字幕シーケンスが存在する場合は、自動的に字幕編集パネルを表示しない
    // （ユーザーが手動で選択する必要がある）
  }, [initialSubtitles, videoUrl]);

  // 外部から受け取ったBGM URLが変更されたときに内部状態を更新
  useEffect(() => {
    if (externalBgmUrl !== bgmUrl) {
      setBgmUrl(externalBgmUrl);
      if (externalBgmUrl) {
        setBgmEnabled(true); // BGM URLが設定されたら自動的に有効化
        setShowProperties(false); // 他のウィンドウを閉じる
        setShowSubtitleEditor(false); // 他のウィンドウを閉じる
        debug('[VideoEditor] BGM URL set, enabling BGM:', externalBgmUrl);
      } else {
        setBgmEnabled(false); // BGM URLが削除されたら無効化
        debug('[VideoEditor] BGM URL removed, disabling BGM');
      }
      debug('[VideoEditor] External BGM URL changed, updating internal state:', externalBgmUrl);
    }
  }, [externalBgmUrl]); // bgmUrlを依存配列から削除して無限ループを防ぐ

  // BGM URLが変更された時に親に通知
  useEffect(() => {
    if (onBgmUrlChange && bgmUrl !== externalBgmUrl) {
      onBgmUrlChange(bgmUrl);
      debug('[VideoEditor] BGM URL changed:', bgmUrl);
    }
  }, [bgmUrl, externalBgmUrl, onBgmUrlChange]); // 依存配列を追加

  // BGM音量が変更された時に親に通知
  useEffect(() => {
    if (onBgmVolumeChange && bgmVolume !== externalBgmVolume) {
      onBgmVolumeChange(bgmVolume);
      debug('[VideoEditor] BGM volume changed:', bgmVolume);
    }
  }, [bgmVolume, externalBgmVolume, onBgmVolumeChange]); // 依存配列を追加

  // BGM開始位置が変更された時に親に通知
  useEffect(() => {
    if (onBgmStartTimeChange) {
      onBgmStartTimeChange(bgmStartTime);
    }
  }, [bgmStartTime, onBgmStartTimeChange]);

  // BGM終了位置が変更された時に親に通知
  useEffect(() => {
    if (onBgmEndTimeChange) {
      onBgmEndTimeChange(bgmEndTime);
    }
  }, [bgmEndTime, onBgmEndTimeChange]);

  // currentTimeRefとcurrentTime stateの二重管理を削除
  // updateCurrentTime関数で既に同期しているため、このuseEffectは不要

  // コンポーネントのアンマウント時にすべてのイベントリスナーをクリーンアップ
  // 注意: このuseEffectはVideoEditorコンポーネント内で実行されるため、
  // ModernTimeline内のイベントリスナーはModernTimeline内でクリーンアップする必要がある
  useEffect(() => {
    return () => {
      // setTimeoutのクリーンアップ
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
    };
  }, []); // マウント時のみ実行

  // 選択状態のヘルパー関数（後方互換性のため）
  const selectedClipIndex = selectedClipIndices.length === 1 ? selectedClipIndices[0] : null;
  const selectedSubtitleId = selectedSubtitleIds.length === 1 ? selectedSubtitleIds[0] : null;

  // 字幕選択のヘルパー関数
  const handleSubtitleSelect = useCallback((id: string, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => {
    if (modifiers?.shift && selectedSubtitleIds.length > 0) {
      // Shift+クリック: 範囲選択（時間順で並んでいる字幕の場合）
      const lastId = selectedSubtitleIds[selectedSubtitleIds.length - 1];
      const lastIndex = subtitles.findIndex(s => s.id === lastId);
      const currentIndex = subtitles.findIndex(s => s.id === id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = subtitles.slice(start, end + 1).map(s => s.id);
        setSelectedSubtitleIds([...new Set([...selectedSubtitleIds, ...range])]);
      }
      setSelectedClipIndices([]); // クリップの選択を解除
    } else if (modifiers?.ctrl || modifiers?.meta) {
      // Cmd/Ctrl+クリック: 個別追加/削除
      if (selectedSubtitleIds.includes(id)) {
        setSelectedSubtitleIds(selectedSubtitleIds.filter(i => i !== id));
      } else {
        setSelectedSubtitleIds([...selectedSubtitleIds, id]);
      }
      setSelectedClipIndices([]); // クリップの選択を解除
    } else {
      // 通常のクリック: 単一選択
      setSelectedSubtitleIds([id]);
      setSelectedClipIndices([]); // クリップの選択を解除
      setShowProperties(false);
    }
  }, [selectedSubtitleIds, subtitles]);

  // リサイズ処理
  useEffect(() => {
    if (!isResizing) {
      // リサイズ中でない場合は、カーソルスタイルをリセット
      document.body.style.cursor = '';
      return;
    }

    // リサイズ中はカーソルを変更
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY.current;
      const newHeight = Math.max(200, Math.min(window.innerHeight - 400, resizeStartHeight.current + deltaY));
      setPreviewHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // ウィンドウサイズの監視
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 初期サイズを設定
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // プレビューサイズの計算（16:9のアスペクト比を保ちながら、ウィンドウサイズに収まる最大サイズ）
  const calculatePreviewSize = useMemo(() => {
    if (previewHeight !== null) {
      // 手動で高さが設定されている場合は、その高さに基づいて幅を計算
      const height = previewHeight - 120; // paddingとマージンを考慮
      const width = height * (16 / 9);
      return { width, height };
    }

    // クライアントサイドで実際のウィンドウサイズを直接取得（初期レンダリング時の問題を回避）
    let actualWidth: number;
    let actualHeight: number;
    
    if (typeof window !== 'undefined') {
      // クライアントサイド: 実際のウィンドウサイズを取得
      actualWidth = window.innerWidth;
      actualHeight = window.innerHeight;
    } else {
      // サーバーサイド: windowSizeの値を使用（フォールバック）
      actualWidth = windowSize.width;
      actualHeight = windowSize.height;
    }

    // ウィンドウサイズを考慮して16:9の最大サイズを計算
    // プレビューエリアのpadding: 48px (上下24px×2)
    // タイムラインの高さ: 320px (固定) + padding: 48px (上下24px×2) = 368px
    // ヘッダーの高さ: 約80px
    // リサイズハンドルの高さ: 8px
    // タイムラインの高さは固定値（320px）を使用
    const TIMELINE_HEIGHT = 320;
    const TIMELINE_PADDING = 48; // 上下24px×2
    const HEADER_HEIGHT = 80;
    const RESIZE_HANDLE_HEIGHT = 8;
    const availableHeight = actualHeight - TIMELINE_HEIGHT - TIMELINE_PADDING - HEADER_HEIGHT - RESIZE_HANDLE_HEIGHT; // 利用可能な高さ
    const availableWidth = actualWidth - 48; // 利用可能な幅（paddingを考慮）

    // 16:9のアスペクト比を保ちながら、利用可能な領域に収まる最大サイズを計算
    const heightByWidth = availableWidth * (9 / 16);
    const widthByHeight = availableHeight * (16 / 9);

    let width: number;
    let height: number;

    if (heightByWidth <= availableHeight) {
      // 幅に基づいて計算した高さが利用可能な高さ以内の場合
      width = availableWidth;
      height = heightByWidth;
    } else {
      // 高さに基づいて計算した幅が利用可能な幅以内の場合
      width = widthByHeight;
      height = availableHeight;
    }

    // 最小サイズを保証
    width = Math.max(320, width);
    height = Math.max(180, height);

    return { width, height };
  }, [windowSize, previewHeight]);

  // Undo/Redo履歴管理 (lifted to useEditorStore)
  const history = useEditorStore((s) => s.history);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const initHistoryStore = useEditorStore((s) => s.initHistory);
  const pushHistoryStore = useEditorStore((s) => s.pushHistory);
  const undoStore = useEditorStore((s) => s.undo);
  const redoStore = useEditorStore((s) => s.redo);
  const [copiedClip, setCopiedClip] = useState<VideoClip | null>(null);
  const [copiedSubtitle, setCopiedSubtitle] = useState<Subtitle | null>(null);
  
  // プレビューは16:9固定（現時点で縦動画や正方形の動画には対応していないため）
  const config = RESOLUTIONS[videoResolution]['16:9'];

  // 初期履歴を設定（初回のみ）— editor session 開始時に store もリセット
  const isInitialized = useRef(false);
  useEffect(() => {
    if (!isInitialized.current) {
      // Wipe any state left over from a previous /video-edit visit, then
      // seed the undo stack with the clips we received as props.
      useEditorStore.getState().reset();
      initHistoryStore(clips);
      isInitialized.current = true;
    }
  }, [clips, initHistoryStore]);

  // タイムラインの計算（clipsを使用）
  const { totalDuration, clipStartTimes } = useMemo(() => {
    const total = clips.reduce((sum, clip) => sum + (clip.duration || 3), 0);
    const startTimes: number[] = [];
    let accumulatedTime = 0;
    clips.forEach((clip) => {
      startTimes.push(accumulatedTime);
      accumulatedTime += clip.duration || 3;
    });
    
    debug('[VideoEditor] totalDuration calculated:', {
      total,
      clipsCount: clips.length,
      clipsDurations: clips.map(c => c.duration || 3),
    });
    
    return { totalDuration: total, clipStartTimes: startTimes };
  }, [clips]);

  // プレビューとタイムラインの同期を監視（Player再マウント完了後にチェック）
  useEffect(() => {
    if (previewDuration === null || totalDuration === 0) return;
    
    // Player再マウント完了を待ってから同期チェック（200ms遅延）
    const checkTimer = setTimeout(() => {
      // Player再マウント中はスキップ
      if (isPlayerRemountingRef.current) {
        debug('[VideoEditor] Player再マウント中のため、同期チェックをスキップ');
        return;
      }
      
      const difference = Math.abs(previewDuration - totalDuration);
      const threshold = 0.1; // より厳密に（0.5秒 → 0.1秒）
      
      if (difference > threshold) {
        logError('[VideoEditor] ⚠️ 同期エラー検出！');
        logError('[VideoEditor] タイムライン:', totalDuration, '秒');
        logError('[VideoEditor] プレビュー:', previewDuration, '秒');
        logError('[VideoEditor] 差:', difference, '秒');
        
        // プレビューの長さをタイムラインに合わせる（Playerから取得しない）
        debug('[VideoEditor] プレビューの長さをタイムラインに合わせます...');
        setPreviewDuration(totalDuration);
        
        // Player再マウントが必要な場合は実行
        if (playerRef.current && !isPlayerRemountingRef.current) {
          debug('[VideoEditor] Playerを強制的に再マウントします...');
          isPlayerRemountingRef.current = true;
          setPlayerVisible(false);
          
          setTimeout(() => {
            setPlayerVisible(true);
            
            // 位置を復元
            requestAnimationFrame(() => {
              if (playerRef.current && currentTimeRef.current > 0) {
                const frame = Math.floor(currentTimeRef.current * 30);
                playerRef.current.seekTo(frame);
              }
              
              setTimeout(() => {
                isPlayerRemountingRef.current = false;
                debug('[VideoEditor] 再同期完了');
              }, 100);
            });
          }, 100);
        }
        
        setShowSyncWarning(true);
      } else {
        setShowSyncWarning(false);
        if (difference > 0.01) { // 0.01秒以上の差がある場合はログ出力
          debug('[VideoEditor] ✅ プレビューとタイムラインの長さが一致しています（差:', difference.toFixed(3), '秒）');
      }
    }
    }, 200); // 200ms待機してPlayer再マウントを確実に完了させる
    
    return () => clearTimeout(checkTimer);
  }, [totalDuration, previewDuration]); // totalDurationとpreviewDurationの変化を監視

  // inputPropsを useMemo で管理（clips が変わった時だけ新しいオブジェクトを作成）
  // URL変換が完了するまで待つ（isUrlConvertingがfalseになるまで）
  const playerInputProps = useMemo(() => {
    debug('[VideoEditor] ========== playerInputProps 生成 ==========');
    debug('[VideoEditor] clips count:', clips.length);
    debug('[VideoEditor] subtitles count:', subtitles.length);
    debug('[VideoEditor] URL変換状態:', { 
      isUrlConverting, 
      convertedImageUrls: convertedImageUrls.length, 
      convertedBgmUrl: !!convertedBgmUrl,
      convertedAudioUrls: convertedAudioUrls.length,
    });

    // URL変換が完了していない場合でも、元のclipsを使用してプレビューを表示
    // 変換が完了していない場合は、元のURLを使用（変換後のURLが利用可能な場合はそれを使用）
    if (isUrlConverting && convertedImageUrls.length === 0 && clips.length > 0) {
      debug('[VideoEditor] URL変換中ですが、元のclipsを使用してプレビューを表示します');
      // URL変換中でも、元のclipsを使用してプレビューを表示
      // これにより、プレビューが空になることを防ぐ
    }

    const result = {
      _timestamp: Date.now(),
      _random: Math.random(),
      clips: clips.map((c, index) => {
        // 変換後のURLを使用（変換に失敗した場合、または変換中は元のURLを使用）
        // convertedImageUrlsが空の場合は、元のimageUrlを使用
        const convertedImageUrl = (convertedImageUrls.length > index && convertedImageUrls[index]) 
          ? convertedImageUrls[index] 
          : (c.imageUrl || null);
        const convertedAudioUrl = (convertedAudioUrls.length > index && convertedAudioUrls[index])
          ? convertedAudioUrls[index]
          : (c.audioUrl || '');
        
        const clipData = {
          plotName: c.plotName || '',
          text: c.text || '',
          imageUrl: convertedImageUrl,
          audioUrl: convertedAudioUrl,
          duration: c.duration || 3,
          index: c.index !== undefined ? c.index : index,
          scale: c.scale || 1.0,
          position: c.position ? { x: c.position.x || 0, y: c.position.y || 0 } : { x: 0, y: 0 },
          imageEffect: c.imageEffect || 'none',
          transitionType: c.transitionType || 'none',
          transitionDuration: c.transitionDuration || 0.5,
          audioStartTime: c.audioStartTime || 0,
          totalClips: clips.length,
        };
    
        // 画像URLのデバッグログ（変換前後の比較）
        if (index === 0 || !clipData.imageUrl) {
          debug(`[VideoEditor/playerInputProps] クリップ${index} 画像URL:`, {
            plotName: clipData.plotName,
            originalImageUrl: c.imageUrl,
            convertedImageUrl: convertedImageUrl,
            hasImageUrl: !!clipData.imageUrl,
            wasConverted: c.imageUrl !== convertedImageUrl,
          });
        }
        
        return clipData;
      }),
      productName: productName || '',
      resolution: videoResolution || '1080p',
      aspectRatio: '16:9' as VideoAspectRatio, // プレビューは16:9固定
      tempo: videoTempo || 1.0,
      audioEnabled: subtitleAudioEnabled,
      // 編集モードではRemotion Playerの字幕表示を無効化（字幕オーバーレイのみを表示）
      // これにより、字幕オーバーレイとRemotion Playerの字幕表示が重複することを防ぐ
      subtitles: [], // 編集モードでは空配列（字幕オーバーレイで表示）
      // プレビュー時は独自のHTML5 Audio要素でBGMを再生するため、Remotion PlayerにはBGMを渡さない
      bgmUrl: null, // プレビュー時はnull（独自のAudio要素で再生）
      bgmVolume: 0, // プレビュー時は0（独自のAudio要素で音量制御）
      bgmStartTime: 0,
      bgmEndTime: null,
      subtitleAudioVolume: subtitleAudioVolume || 1.0,
      videoUrl: videoUrl || '',
    };

    debug('[VideoEditor] Generated inputProps (with converted URLs):', {
      clipsCount: result.clips.length,
      convertedImages: result.clips.filter(c => c.imageUrl).length,
      hasBgm: !!result.bgmUrl,
      bgmUrl: result.bgmUrl,
      originalBgmUrl: bgmUrl,
      convertedBgmUrl: convertedBgmUrl,
      bgmVolume: result.bgmVolume,
      bgmStartTime: result.bgmStartTime,
      bgmEndTime: result.bgmEndTime,
    });
    debug('[VideoEditor] ===========================================');
    
    return result;
  }, [
    clips,
    subtitles,
    productName,
    videoResolution,
    videoAspectRatio,
    videoTempo,
    subtitleAudioEnabled,
    bgmUrl,
    bgmVolume,
    bgmStartTime,
    bgmEndTime,
    subtitleAudioVolume,
    videoUrl,
    isUrlConverting,
    convertedImageUrls,
    convertedBgmUrl,
    convertedAudioUrls,
  ]);

  // playerKey生成ロジック（完全版 - 修正案1）
  const playerKey = useMemo(() => {
    const clipsHash = clips
      .map(
        (c) =>
          `${c.plotName}-${c.duration}-${c.scale}-${c.imageEffect}-${JSON.stringify(
            c.position || { x: 0, y: 0 }
          )}-${c.audioStartTime ?? 0}`
      )
      .join('|');
    
    const subtitlesHash = subtitles
      .map((s) => `${s.id}-${s.text}-${s.startTime}-${s.endTime}`)
      .join('|');
    
    const key = `player-${Date.now()}-${clips.length}-${subtitles.length}-${Math.abs(
      (clipsHash + subtitlesHash).split('').reduce((acc, ch) => {
        const code = ch.charCodeAt(0);
        acc = (acc << 5) - acc + code;
        return acc | 0;
      }, 0)
    )}`;
    
    debug('[VideoEditor] ========== playerKey 生成 ==========');
    debug('[VideoEditor] New playerKey:', key);
    debug('[VideoEditor] Clips hash:', clipsHash.substring(0, 80), '...');
    debug('[VideoEditor] Subtitles hash:', subtitlesHash.substring(0, 80), '...');
    debug('[VideoEditor] ==========================================');

    return key;
  }, [clips, subtitles]);
  
  // clipsの内容が変更されたことを検出（デバッグ用）
  useEffect(() => {
    debug('[VideoEditor] ========== clips prop changed ==========');
    debug('[VideoEditor] New clips count:', clips.length);
    debug('[VideoEditor] Clips details:', clips.map((c, i) => ({
      index: i,
      plotName: c.plotName,
      text: c.text?.substring(0, 20) || '(no text)',
      duration: c.duration,
      imageUrl: c.imageUrl ? 'yes' : 'no',
      transitionType: c.transitionType || 'none',
    })));
    const total = clips.reduce((sum, c) => sum + (c.duration || 3), 0);
    debug('[VideoEditor] Total duration:', total, '秒');
    debug('[VideoEditor] ====================================');
  }, [clips]); // clipsが変わるたびに実行
    
  // playerKeyが変わった時の処理（診断用強制再マウント）
  useEffect(() => {
    if (prevPlayerKeyRef.current === playerKey) {
      return;
    }
    
    debug('[VideoEditor] ========== playerKey 変更検出 ==========');
      debug('[VideoEditor] Previous key:', prevPlayerKeyRef.current);
      debug('[VideoEditor] New key:', playerKey);
    debug('[VideoEditor] 現在のピン位置:', currentTimeRef.current, '秒');

    prevPlayerKeyRef.current = playerKey;
    isPlayerRemountingRef.current = true;
    const savedTime = currentTimeRef.current;
    setPlayerVisible(false);

    const timer = setTimeout(() => {
      setPlayerVisible(true);
      requestAnimationFrame(() => {
        if (playerRef.current && savedTime > 0) {
          const frame = Math.floor(savedTime * 30);
          try {
            playerRef.current.seekTo(frame);
            debug('[VideoEditor] 位置を復元:', savedTime, '秒 (フレーム:', frame, ')');
          } catch (err) {
            logError('[VideoEditor] シークエラー:', err);
          }
        }
        
        setTimeout(() => {
          isPlayerRemountingRef.current = false;
          debug('[VideoEditor] 再マウント完了');
        }, 200);
      });
    }, 100);
    
    return () => {
      clearTimeout(timer);
      isPlayerRemountingRef.current = false;
    };
  }, [playerKey]);

  // 再マウントが何らかの理由で完了しなかった場合のフォールバック
  useEffect(() => {
    if (playerVisible) return;
    const failSafe = setTimeout(() => {
      if (!playerVisible) {
        warn('[VideoEditor] ⚠️ Playerが更新中のままです。フォールバックで再表示します。');
        isPlayerRemountingRef.current = false;
        setPlayerVisible(true);
      }
    }, 1000);
    return () => clearTimeout(failSafe);
  }, [playerVisible]);
  
  // playerKeyが変更された時に同期チェックを実行（Player再マウント完了後）
  useEffect(() => {
    debug('[VideoEditor] playerKey changed, checking sync after remount...');
    
    // Player再マウント完了を待つ（300ms遅延）
    const checkTimer = setTimeout(() => {
      const timelineDuration = clips.reduce((sum, c) => sum + (c.duration || 3), 0);
      
      if (!playerRef.current) {
        debug('[VideoEditor] playerRef not available yet');
        return;
      }
      
      // Player再マウント中はスキップ
      if (isPlayerRemountingRef.current) {
        debug('[VideoEditor] Player再マウント中のため、同期チェックをスキップ');
        return;
      }
      
      // プレビューの長さはclipsから計算（Playerから取得しない）
      const calculatedPreviewDuration = timelineDuration;
      
      debug('[VideoEditor] 同期チェック実行:', {
        timeline: timelineDuration,
        preview: calculatedPreviewDuration,
        playerKey: playerKey,
      });
      
      // プレビューの長さを更新（clipsから計算した値を使用）
      setPreviewDuration(calculatedPreviewDuration);
      
      const diff = Math.abs(calculatedPreviewDuration - timelineDuration);
      if (diff > 0.1) {
        logError('[VideoEditor] ⚠️ 同期エラー検出！');
        logError('[VideoEditor] タイムライン:', timelineDuration, '秒');
        logError('[VideoEditor] プレビュー:', calculatedPreviewDuration, '秒');
        logError('[VideoEditor] 差:', diff, '秒');
        setShowSyncWarning(true);
      } else {
        debug('[VideoEditor] ✅ 同期OK');
        setShowSyncWarning(false);
      }
    }, 300); // 300ms待機（より確実）
    
    return () => clearTimeout(checkTimer);
  }, [playerKey, clips]); // playerKeyとclipsの両方を監視

  // Player再マウント完了を検出してシーク（playerVisibleの変化を監視）
  useEffect(() => {
    // playerVisibleがtrueになった = Player再マウント開始
    if (!playerVisible || videoUrl || !isPlayerRemountingRef.current) {
      return;
    }
    
    debug('[VideoEditor] ========== Player再マウント開始を検出 ==========');
    debug('[VideoEditor] playerVisibleがtrueになりました - playerRef.currentを待機中...');
    
    let attempt = 0;
    const maxAttempts = 20; // 最大1秒待つ（20 × 50ms）
    const timeouts: NodeJS.Timeout[] = [];
    
    // Playerが実際に利用可能になるまでポーリング
    const checkPlayerReady = () => {
      attempt++;
      
      if (playerRef.current) {
        debug('[VideoEditor] playerRef.current is now available ✅ (attempt:', attempt, ')');
        
        // 保存された位置にシーク
        const savedTime = currentTimeRef.current;
        const currentFrame = Math.floor(savedTime * 30);
        
        try {
          debug('[VideoEditor] シーク実行: フレーム', currentFrame, '（時間:', savedTime, '秒）');
          playerRef.current.seekTo(currentFrame);
          
          // プレビューの長さはclipsから計算済み（Playerから取得しない）
          // プレビューの長さは既にclips変更時に計算されているため、ここでは設定しない
          debug('[VideoEditor] Player再マウント完了、プレビューの長さ:', previewDuration, '秒（計算値）');
          
          // シーク処理が安定するまで少し待ってからフラグをクリア
          const finalTimeout = setTimeout(() => {
            isPlayerRemountingRef.current = false;
            debug('[VideoEditor] isPlayerRemountingRef.current = false （再マウント完全完了）');
            debug('[VideoEditor] ====================================================');
          }, 100);
          
          timeouts.push(finalTimeout);
          
        } catch (error) {
          logError('[VideoEditor] シークエラー:', error);
          isPlayerRemountingRef.current = false;
        }
      } else if (attempt < maxAttempts) {
        // まだ準備できていない場合、50ms後に再チェック
        debug('[VideoEditor] playerRef.currentがまだnull、50ms後に再チェック... (attempt:', attempt, '/', maxAttempts, ')');
        const timeout = setTimeout(checkPlayerReady, 50);
        timeouts.push(timeout);
      } else {
        // 最大試行回数に達した
        logError('[VideoEditor] playerRef.currentが利用可能になりませんでした（最大試行回数:', maxAttempts, '）');
        isPlayerRemountingRef.current = false;
      }
    };
    
    // 最初のチェックは50ms後に実行
    const initialTimeout = setTimeout(checkPlayerReady, 50);
    timeouts.push(initialTimeout);
    
    // クリーンアップ
    return () => {
      debug('[VideoEditor] Player再マウント監視のクリーンアップ（保留中のタイムアウト:', timeouts.length, '個）');
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [playerVisible, videoUrl, totalDuration]);
  // playerVisibleが変化した時（Player再マウント時）に実行される

  // currentTimeの更新を一元化する関数
  const updateCurrentTime = useCallback((time: number, shouldSeek: boolean = true) => {
    // timeが無効な値（undefined, null, NaN）の場合は処理をスキップ
    if (time === undefined || time === null || isNaN(time)) {
      warn('updateCurrentTime: 無効な時間値が渡されました', time);
      return;
    }
    
    // 時間を有効範囲内に制限
    const clampedTime = Math.max(0, Math.min(totalDuration, time));
    
    // currentTimeRefを常に最新の値に更新
    currentTimeRef.current = clampedTime;
    
    // stateを更新（UI再レンダリング用）
    setCurrentTime(clampedTime);
    
    if (shouldSeek) {
      // プレイヤー/動画をシークする場合
      if (videoUrl && videoRef.current) {
        // 完成動画の場合
        const video = videoRef.current;
        isSeekingRef.current = true; // シーク開始をマーク
        video.currentTime = clampedTime;
        
        // seekedイベントを待つ（シーク完了を確実に検出）
        const handleSeeked = () => {
          isSeekingRef.current = false;
          if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
            seekTimeoutRef.current = null;
          }
          video.removeEventListener('seeked', handleSeeked);
          debug('[VideoEditor] シーク完了（seekedイベント）:', video.currentTime, '秒');
        };
        
        video.addEventListener('seeked', handleSeeked, { once: true });
        
        // 既存のタイムアウトをクリーンアップ
        if (seekTimeoutRef.current) {
          clearTimeout(seekTimeoutRef.current);
        }
        // フォールバック: 500ms後に強制的にfalseに（seekedイベントが発火しない場合の対策）
        seekTimeoutRef.current = setTimeout(() => {
          if (isSeekingRef.current) {
            warn('[VideoEditor] シーク完了タイムアウト（500ms経過）');
          isSeekingRef.current = false;
          seekTimeoutRef.current = null;
            // イベントリスナーをクリーンアップ
            video.removeEventListener('seeked', handleSeeked);
          }
        }, 500);
      } else if (playerRef.current) {
        // Remotion Playerの場合
        const frame = Math.floor(clampedTime * 30);
        try {
          isSeekingRef.current = true; // シーク開始をマーク
          playerRef.current.seekTo(frame);
          
          // 既存のタイムアウトをクリーンアップ
          if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
          }
          // Remotion Playerの場合は、シークが即座に完了するため、短い遅延でOK
          seekTimeoutRef.current = setTimeout(() => {
            isSeekingRef.current = false;
            seekTimeoutRef.current = null;
            debug('[VideoEditor] Remotion Player シーク完了:', clampedTime, '秒');
          }, 100);
        } catch (error) {
          logError('[VideoEditor] Remotion Player シークエラー:', error);
          isSeekingRef.current = false;
          if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
            seekTimeoutRef.current = null;
          }
        }
      } else {
        // プレイヤーがまだ準備できていない場合
        // シークは実行しないが、状態は更新する
      }
    }
  }, [videoUrl, totalDuration]);

  // 完成動画の再生位置を同期（timeupdateイベント）
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    
    const video = videoRef.current;
    
    const handleTimeUpdate = () => {
      // シーク中は更新しない（シーク完了を待つ）
      if (isSeekingRef.current) {
        return;
      }
      
      if (video) {
        const videoTime = video.currentTime;
        // currentTimeRefを使用して最新の値を参照
        // 0.05秒以上の差がある場合のみ更新（より滑らかな更新のため）
        if (Math.abs(videoTime - currentTimeRef.current) > 0.05) {
          currentTimeRef.current = videoTime;
          setCurrentTime(videoTime);
        }
      }
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoUrl, isPlaying]);

  // Remotion Playerの現在位置を定期的にチェックして同期
  useEffect(() => {
    if (videoUrl) return; // 完成動画の場合は不要
    
    const interval = setInterval(() => {
      // Player再マウント中はスキップ（ピンが0秒に戻るのを防ぐ）
      if (isPlayerRemountingRef.current) {
        // debug('[VideoEditor] Player再マウント中のため、同期をスキップ');
        return;
      }
      
      // シーク中はスキップ（シーク完了を待つ）
      if (isSeekingRef.current) {
        return;
      }
      
      if (playerRef.current) {
        try {
          const currentFrame = playerRef.current.getCurrentFrame();
          const playerTime = currentFrame / 30;
          
          // 再生中・一時停止中に関わらず、シーク中でない場合のみ更新
            // 0.05秒以上の差がある場合のみ更新（より滑らかな更新のため）
            if (Math.abs(playerTime - currentTimeRef.current) > 0.05) {
              currentTimeRef.current = playerTime;
              setCurrentTime(playerTime);
          }
        } catch (error) {
          // エラーは無視（Playerが準備できていない場合など）
        }
      }
    }, 50); // 50msごとにチェック（より滑らかな更新のため）
    
    return () => clearInterval(interval);
  }, [videoUrl, isPlaying]); // isPlayingを依存配列に追加

  // BGMの再生をRemotion Playerと同期
  useEffect(() => {
    if (videoUrl) return; // 完成動画の場合は不要（完成動画にはBGMが埋め込まれている）
    if (!bgmUrl || !bgmAudioRef.current) return; // BGMが設定されていない場合はスキップ

    const bgmAudio = bgmAudioRef.current;
    const totalDurationValue = totalDuration;

    // BGMのURLを設定（変換後のURLを優先）
    const bgmUrlToUse = convertedBgmUrl || bgmUrl;
    if (bgmAudio.src !== bgmUrlToUse) {
      bgmAudio.src = bgmUrlToUse;
      bgmAudio.load();
    }

    // 音量を設定
    bgmAudio.volume = Math.max(0, Math.min(1, bgmVolume));

    // 再生状態の同期
    const syncBgm = () => {
      if (!bgmAudio || !playerRef.current) return;

      try {
        // オーディオの準備状態を確認（READY_STATE_HAVE_ENOUGH_DATA = 4）
        if (bgmAudio.readyState < 2) {
          // メタデータが読み込まれていない場合はスキップ
          return;
        }

        const currentFrame = playerRef.current.getCurrentFrame();
        const playerTime = currentFrame / 30; // フレームを秒に変換

        // BGMの開始位置に達していない場合は停止
        if (playerTime < bgmStartTime) {
          if (!bgmAudio.paused) {
            bgmAudio.pause();
          }
          if (bgmAudio.currentTime !== 0) {
            bgmAudio.currentTime = 0;
          }
          return;
        }

        // BGMの終了位置をチェック
        if (bgmEndTime !== null && playerTime >= bgmEndTime) {
          if (!bgmAudio.paused) {
            bgmAudio.pause();
          }
          // BGMファイル内の終了位置に設定
          const bgmFileEndTime = bgmEndTime - bgmStartTime;
          if (Math.abs(bgmAudio.currentTime - bgmFileEndTime) > 0.01) {
            bgmAudio.currentTime = bgmFileEndTime;
          }
          return;
        }

        // BGMファイル内の再生位置を計算（動画の再生位置からBGM開始位置を引く）
        const bgmFileTime = playerTime - bgmStartTime;
        const targetTime = Math.max(0, bgmFileTime);

        // 動画の再生位置に合わせてBGMを同期
        if (isPlaying) {
          if (bgmAudio.paused) {
            // 再生開始: 位置を設定してから再生
            // オーディオが十分に読み込まれていることを確認
            if (bgmAudio.readyState >= 2) {
              bgmAudio.currentTime = targetTime;
              bgmAudio.play().catch((error) => {
                warn('[VideoEditor] BGM再生エラー:', error);
              });
            }
          } else {
            // 再生中: 位置を同期（より大きな閾値で頻繁な更新を防ぐ）
            const timeDiff = Math.abs(bgmAudio.currentTime - targetTime);
            // 0.2秒以上の差がある場合のみ同期（途切れを防ぐため）
            if (timeDiff > 0.2) {
              // オーディオが十分に読み込まれていることを確認
              if (bgmAudio.readyState >= 2) {
                bgmAudio.currentTime = targetTime;
              }
            }
          }
        } else {
          // 一時停止
          if (!bgmAudio.paused) {
            bgmAudio.pause();
          }
        }
      } catch (error) {
        // エラーは無視（Playerが準備できていない場合など）
        warn('[VideoEditor] BGM同期エラー:', error);
      }
    };

    // オーディオの読み込み完了を待つ
    const handleCanPlayThrough = () => {
      debug('[VideoEditor] BGM読み込み完了、同期を開始');
      // 初期同期
      syncBgm();
    };

    bgmAudio.addEventListener('canplaythrough', handleCanPlayThrough);
    
    // 既に読み込まれている場合は即座に同期
    if (bgmAudio.readyState >= 3) {
      syncBgm();
    }

    // 定期的に同期（100msごと - 途切れを防ぐため間隔を少し長く）
    bgmSyncIntervalRef.current = setInterval(syncBgm, 100);

    return () => {
      if (bgmSyncIntervalRef.current) {
        clearInterval(bgmSyncIntervalRef.current);
        bgmSyncIntervalRef.current = null;
      }
      if (bgmAudio) {
        bgmAudio.removeEventListener('canplaythrough', handleCanPlayThrough);
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
      }
    };
  }, [videoUrl, bgmUrl, convertedBgmUrl, bgmVolume, bgmStartTime, bgmEndTime, isPlaying, totalDuration]);

  // BGMの音量変更を反映
  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = Math.max(0, Math.min(1, bgmVolume));
    }
  }, [bgmVolume]);

  // Keep BGM playback rate in sync with the editor's preview rate. The
  // Remotion <Player> handles rate for the composition itself; BGM is an
  // out-of-band <audio> element so we mirror it manually.
  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // シーク時にBGMも同期
  useEffect(() => {
    if (videoUrl) return; // 完成動画の場合は不要
    if (!bgmUrl || !bgmAudioRef.current || !playerRef.current) return;
    if (!isSeekingRef.current) return; // シーク中でない場合はスキップ

    const bgmAudio = bgmAudioRef.current;
    try {
      const currentFrame = playerRef.current.getCurrentFrame();
      const playerTime = currentFrame / 30;

      // BGMの開始位置に達していない場合は停止
      if (playerTime < bgmStartTime) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
        return;
      }

      // BGMの終了位置をチェック
      if (bgmEndTime !== null && playerTime >= bgmEndTime) {
        bgmAudio.pause();
        const bgmFileEndTime = bgmEndTime - bgmStartTime;
        bgmAudio.currentTime = bgmFileEndTime;
        return;
      }

      // BGMファイル内の再生位置を計算
      const bgmFileTime = playerTime - bgmStartTime;
      const targetTime = Math.max(0, bgmFileTime);
      bgmAudio.currentTime = targetTime;
    } catch (error) {
      // エラーは無視
    }
  }, [currentTime, videoUrl, bgmUrl, bgmStartTime, bgmEndTime]);

  // クリップ選択のヘルパー関数
  const handleClipSelect = useCallback((index: number, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => {
    if (modifiers?.shift && selectedClipIndices.length > 0) {
      // Shift+クリック: 範囲選択
      const lastIndex = selectedClipIndices[selectedClipIndices.length - 1];
      const start = Math.min(lastIndex, index);
      const end = Math.max(lastIndex, index);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedClipIndices([...new Set([...selectedClipIndices, ...range])].sort((a, b) => a - b));
      setSelectedSubtitleIds([]); // 字幕の選択を解除
    } else if (modifiers?.ctrl || modifiers?.meta) {
      // Cmd/Ctrl+クリック: 個別追加/削除
      if (selectedClipIndices.includes(index)) {
        setSelectedClipIndices(selectedClipIndices.filter(i => i !== index));
      } else {
        setSelectedClipIndices([...selectedClipIndices, index].sort((a, b) => a - b));
      }
      setSelectedSubtitleIds([]); // 字幕の選択を解除
    } else {
      // 通常のクリック: 単一選択
      setSelectedClipIndices([index]);
      setSelectedSubtitleIds([]); // 字幕の選択を解除
      setShowProperties(false);
      setBgmEnabled(false); // BGM設定を閉じる
      
      // ピンの位置はそのまま維持（自動再生しない）
      // ユーザーが手動で再生ボタンを押すまで待つ
    }
  }, [selectedClipIndices]);

  // clipsが変更されたときに、現在の再生位置を調整し、Playerを更新
  useEffect(() => {
    // currentTimeRefを使用して最新の値を参照
    const currentTimeValue = currentTimeRef.current;
    
    // 現在の再生位置がtotalDurationを超えている場合、調整
    if (currentTimeValue > totalDuration && totalDuration > 0) {
      const newTime = Math.max(0, totalDuration - 0.1);
      updateCurrentTime(newTime, true);
    }

    // 選択中のクリップインデックスが無効になった場合、調整
    const validIndices = selectedClipIndices.filter(index => index < clips.length);
    if (validIndices.length !== selectedClipIndices.length) {
      if (validIndices.length > 0) {
        setSelectedClipIndices(validIndices);
      } else if (clips.length > 0) {
        setSelectedClipIndices([clips.length - 1]);
      } else {
        setSelectedClipIndices([]);
      }
    }

    // Remotion Playerの再生位置を調整（keyプロパティの変更によりPlayerが再マウントされるため、ここでは再生位置の調整のみ行う）
    if (!videoUrl && playerRef.current && clips.length > 0) {
      // Playerの再レンダリングを促すために、現在のフレームを再設定
      try {
        const currentFrame = playerRef.current.getCurrentFrame();
        const maxFrame = Math.ceil(totalDuration * 30);
        if (currentFrame >= maxFrame && maxFrame > 0) {
          const newTime = Math.max(0, (maxFrame - 1) / 30);
          updateCurrentTime(newTime, true);
        }
        // clipsが変更されたときは、最初のフレームに戻す（オプション）
        // playerRef.current.seekTo(0);
      } catch (error) {
        // エラーは無視（Playerがまだ準備できていない可能性がある）
      }
    }
  }, [clips, totalDuration, selectedClipIndices, videoUrl, updateCurrentTime]); // currentTimeを依存配列から削除

  // 埋め込まれた字幕を無効化するヘルパー関数
  const disableEmbeddedSubtitles = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      debug('[VideoEditor] 埋め込み字幕を無効化中...');
      
      // すべてのtextTracksを無効化
      if (video.textTracks && video.textTracks.length > 0) {
        debug('[VideoEditor] textTracksを検出:', video.textTracks.length, '個');
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          debug('[VideoEditor] Track', i, ':', track.kind, track.mode);
          track.mode = 'disabled';
        }
        debug('[VideoEditor] すべてのtextTracksを無効化しました ✅');
      } else {
        debug('[VideoEditor] textTracksが見つかりませんでした');
      }
      
      // <track>タグを削除（念のため）
      const trackElements = video.querySelectorAll('track');
      if (trackElements.length > 0) {
        debug('[VideoEditor] <track>要素を検出:', trackElements.length, '個');
        trackElements.forEach((trackElement) => {
          trackElement.remove();
          debug('[VideoEditor] <track>要素を削除しました');
        });
      }
    }
  }, []);

  // videoUrlが変更された時に埋め込み字幕を無効化し、字幕ステートをクリア
  useEffect(() => {
    if (videoUrl) {
      debug('[VideoEditor] videoUrlが変更されました、字幕をクリアして埋め込み字幕を無効化します');
      
      // 完成動画が読み込まれた場合、字幕ステートをクリア（動画に埋め込まれている字幕を使用）
      setSubtitles([]);
      initialSubtitlesRef.current = [];
      setSelectedSubtitleIds([]);
      setShowSubtitleEditor(false);
      
      if (videoRef.current) {
        // 少し待ってから無効化（ビデオの読み込みを待つ）
        const timer = setTimeout(() => {
          disableEmbeddedSubtitles();
        }, 100);
        
        // 定期的に無効化をチェック（念のため）
        const intervalTimer = setInterval(() => {
          if (videoRef.current && videoRef.current.textTracks && videoRef.current.textTracks.length > 0) {
            for (let i = 0; i < videoRef.current.textTracks.length; i++) {
              if (videoRef.current.textTracks[i].mode !== 'disabled') {
                debug('[VideoEditor] 有効な字幕トラックを検出、再度無効化します');
                disableEmbeddedSubtitles();
                break;
              }
            }
          }
        }, 500); // 500msごとにチェック
        
        return () => {
          clearTimeout(timer);
          clearInterval(intervalTimer);
        };
      }
    } else {
      // videoUrlがクリアされた場合（下書き編集モードなど）、字幕をクリア
      debug('[VideoEditor] videoUrlがクリアされました、字幕をクリアします');
      setSubtitles([]);
      initialSubtitlesRef.current = [];
      setSelectedSubtitleIds([]);
      setShowSubtitleEditor(false);
    }
  }, [videoUrl, disableEmbeddedSubtitles]);

  // 履歴に追加するヘルパー関数
  // レンダリング中の状態更新を防ぐため、queueMicrotaskで遅延実行
  const addToHistory = useCallback((newClips: VideoClip[]) => {
    queueMicrotask(() => {
      pushHistoryStore(newClips);
    });
  }, [pushHistoryStore]);

  // Phase 3.5: clip CRUD handlers (delete / reorder / extend / copy / paste)
  // extracted to useClipHandlers. Cut/Edit/Add/Select stay in this file
  // because they touch refs, subtitles, or panel toggles.
  const {
    handleClipDelete,
    handleClipReorder,
    handleClipExtend,
    handleClipCopy,
    handleClipPaste,
  } = useClipHandlers({
    clips,
    onClipsChange,
    rippleEditMode,
    copiedClip,
    setCopiedClip,
  });

  // 字幕の時間重複チェック (must be defined BEFORE useSubtitleHandlers consumes it)
  const checkSubtitleOverlap = useCallback(
    (startTime: number, endTime: number, excludeId?: string): boolean =>
      subtitles.some((sub) => {
        if (excludeId && sub.id === excludeId) return false;
        return startTime < sub.endTime && endTime > sub.startTime;
      }),
    [subtitles],
  );

  // Phase 3.5: subtitle CRUD (add / edit / delete / copy / paste). Cut and
  // preview drag stay in this file because they touch refs / compound state.
  const {
    handleSubtitleAdd,
    handleSubtitleEdit,
    handleSubtitleDelete,
    handleSubtitleCopy,
    handleSubtitlePaste,
  } = useSubtitleHandlers({
    subtitles,
    setSubtitles,
    totalDuration,
    copiedSubtitle,
    setCopiedSubtitle,
    checkSubtitleOverlap,
  });

  // clips propsが更新されたことを検出
  useEffect(() => {
    debug('[VideoEditor] ========== clips props updated ==========');
    debug('[VideoEditor] clips count:', clips.length);
    debug('[VideoEditor] clips details:', clips.map((c, i) => ({
      index: i,
      plotName: c.plotName,
      duration: c.duration,
      audioStartTime: c.audioStartTime,
      imageUrl: c.imageUrl ? c.imageUrl.substring(0, 30) + '...' : 'none',
    })));
    debug('[VideoEditor] Total duration (calculated):', clips.reduce((sum, c) => sum + (c.duration || 3), 0), '秒');
    debug('[VideoEditor] ==================================================');
  }, [clips]);

  // クリップの編集（コールバック形式で最新のstateを確実に参照）
  const handleClipEdit = useCallback((index: number, updates: Partial<VideoClip>) => {
    debug('[VideoEditor/handleClipEdit] ========== 開始 ==========');
    debug('[VideoEditor/handleClipEdit] Editing clip index:', index);
    debug('[VideoEditor/handleClipEdit] Updates:', updates);
    debug('[VideoEditor/handleClipEdit] Current clips count:', clips.length);
    
    // setStateのコールバック形式を使用して、最新のstateを取得
    onClipsChange((prevClips) => {
      debug('[VideoEditor/handleClipEdit] Previous clips count:', prevClips.length);
      const updatedClips = [...prevClips];
      
      // 変更前の値をログ
      debug('[VideoEditor/handleClipEdit] Before update:', {
        plotName: updatedClips[index]?.plotName,
        text: updatedClips[index]?.text?.substring(0, 30) || '(no text)',
        duration: updatedClips[index]?.duration,
        imageEffect: updatedClips[index]?.imageEffect || 'none',
        transitionType: updatedClips[index]?.transitionType || 'none',
        scale: updatedClips[index]?.scale || 1.0,
        position: updatedClips[index]?.position || { x: 0, y: 0 },
      });
      
    updatedClips[index] = { ...updatedClips[index], ...updates };
      
      // 変更後の値をログ
      debug('[VideoEditor/handleClipEdit] After update:', {
        plotName: updatedClips[index]?.plotName,
        text: updatedClips[index]?.text?.substring(0, 30) || '(no text)',
        duration: updatedClips[index]?.duration,
        imageEffect: updatedClips[index]?.imageEffect || 'none',
        transitionType: updatedClips[index]?.transitionType || 'none',
        scale: updatedClips[index]?.scale || 1.0,
        position: updatedClips[index]?.position || { x: 0, y: 0 },
      });
      
      // 履歴への追加（addToHistory内でqueueMicrotaskを使用しているため、ここでは直接呼び出し）
      addToHistory(updatedClips);
    
    // clip.textが更新された場合、対応するsubtitlesエントリも更新
    if (updates.text !== undefined) {
      const clip = updatedClips[index];
      // updatedClipsに基づいてclipStartTimeを計算
        const clipStartTime = updatedClips.slice(0, index).reduce((sum: number, c: VideoClip) => sum + (c.duration || 3), 0);
      const clipDuration = clip.duration || 3;
      const clipEndTime = clipStartTime + clipDuration;
      
      // 対応する字幕を検索（開始時間が一致する字幕）
      const subtitleIndex = subtitles.findIndex(
        (sub) => Math.abs(sub.startTime - clipStartTime) < 0.01
      );
      
      if (subtitleIndex !== -1) {
        // 既存の字幕を更新
        const updatedSubtitles = [...subtitles];
        updatedSubtitles[subtitleIndex] = {
          ...updatedSubtitles[subtitleIndex],
          text: updates.text || '',
          endTime: clipEndTime,
        };
        setSubtitles(updatedSubtitles);
      } else if (updates.text && updates.text.trim()) {
        // 字幕が存在しない場合は新規作成
        const newSubtitle: Subtitle = {
          id: `subtitle-${index}-${Date.now()}`,
          text: updates.text,
          startTime: clipStartTime,
          endTime: clipEndTime,
          position: 'bottom',
          positionYPercent: 90, // 下から10%（上から90%）
          fontSize: 5, // 後方互換性のため残す
          fontSizePercent: 5, // 初期値: 5%
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          align: 'center',
          positionXPercent: 50, // 中央
        };
        setSubtitles([...subtitles, newSubtitle]);
      } else if (subtitleIndex !== -1 && (!updates.text || !updates.text.trim())) {
        // テキストが空になった場合は字幕を削除
        const updatedSubtitles = subtitles.filter((_, i) => i !== subtitleIndex);
        setSubtitles(updatedSubtitles);
      }
    }
      
      // durationの変更時の字幕調整
      if (updates.duration !== undefined) {
        const clip = updatedClips[index];
        const oldDuration = prevClips[index]?.duration || 3;
        const newDuration = updates.duration || 3;
        const durationDiff = newDuration - oldDuration;
        
        if (durationDiff !== 0) {
          const clipStartTime = updatedClips.slice(0, index).reduce((sum: number, c: VideoClip) => sum + (c.duration || 3), 0);
          const clipEndTime = clipStartTime + oldDuration;
          
          const updatedSubtitles = subtitles.map(sub => {
            if (sub.startTime >= clipEndTime) {
              return { ...sub, startTime: sub.startTime + durationDiff, endTime: sub.endTime + durationDiff };
            } else if (sub.startTime >= clipStartTime && sub.startTime < clipEndTime) {
              if (sub.endTime > clipEndTime) {
                return { ...sub, endTime: sub.endTime + durationDiff };
              }
            }
            return sub;
          });
          
          setSubtitles(updatedSubtitles);
        }
      }
      
      debug('[VideoEditor/handleClipEdit] ========== 完了 ==========');
      return updatedClips;
    });
  }, [clips, onClipsChange, addToHistory, subtitles]);

  // (handleClipDelete moved to useClipHandlers — see hook invocation below)

  // 「+ シーン追加」ボタン → 即座にメディア選択ダイアログを開く。
  // 旧フロー（空クリップ → プロパティパネルから後付けアップロード）は2段階で
  // 直感性に欠けたため、追加=メディア選択 を1ステップに統合した。
  const addSceneFileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingScene, setIsAddingScene] = useState(false);

  const handleClipAdd = useCallback(() => {
    if (isAddingScene) return;
    addSceneFileInputRef.current?.click();
  }, [isAddingScene]);

  const handleAddSceneFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      );
      if (files.length === 0) return;

      setIsAddingScene(true);
      try {
        const urls: string[] = [];
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Upload failed: ${res.status}`);
          }
          const { url } = (await res.json()) as { url: string };
          urls.push(url);
        }

        // Append new clips. Reindex everything so `index` and `totalClips`
        // stay consistent across the timeline.
        const baseIndex = clips.length;
        const appended: VideoClip[] = urls.map((imageUrl, i) => ({
          plotName: t('timeline.sceneDefaultName', { number: baseIndex + i + 1 }),
          text: '',
          imageUrl,
          audioUrl: '',
          duration: 3,
          index: baseIndex + i,
          totalClips: baseIndex + urls.length,
        }));
        const merged = [...clips, ...appended].map((c, i, arr) => ({
          ...c,
          index: i,
          totalClips: arr.length,
        }));
        addToHistory(merged);
        onClipsChange(merged);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError('シーン追加用のメディアアップロードに失敗:', err);
        alert(msg);
      } finally {
        setIsAddingScene(false);
        // Reset so picking the same file again still triggers onChange.
        if (addSceneFileInputRef.current) addSceneFileInputRef.current.value = '';
      }
    },
    [clips, onClipsChange, addToHistory, t],
  );

  // (checkSubtitleOverlap moved above useSubtitleHandlers — TDZ requirement)

  // 字幕の追加
  // Phase 3.5: subtitle add / edit / delete moved to useSubtitleHandlers
  // (see hook invocation below). Cut + textEdit + previewDragStart stay
  // here because they touch refs or compound state.

  // 複数選択したシーケンスを削除
  const handleDeleteSelected = useCallback(() => {
    // 選択された字幕を削除
    if (selectedSubtitleIds.length > 0) {
      setSubtitles(subtitles.filter(sub => !selectedSubtitleIds.includes(sub.id)));
      setSelectedSubtitleIds([]);
      setShowSubtitleEditor(false);
    }
    
    // 選択されたクリップを削除（インデックスの大きい順に削除）
    if (selectedClipIndices.length > 0) {
      const sortedIndices = [...selectedClipIndices].sort((a, b) => b - a);
      let updatedClips = [...clips];
      sortedIndices.forEach(index => {
        if (rippleEditMode) {
          updatedClips = updatedClips.filter((_, i) => i !== index);
        } else {
          updatedClips = updatedClips.filter((_, i) => i !== index);
        }
      });
      
      // インデックスを更新
      updatedClips.forEach((c, index) => {
        c.index = index;
        c.totalClips = updatedClips.length;
      });
      
      addToHistory(updatedClips);
      onClipsChange(updatedClips);
      setSelectedClipIndices([]);
    }
  }, [selectedSubtitleIds, selectedClipIndices, subtitles, clips, rippleEditMode, onClipsChange, addToHistory]);

  // 変更があるかどうかを判定（初期状態と比較）
  const hasUnsavedChanges = useMemo(() => {
    // clipsの変更をチェック
    const clipsChanged = JSON.stringify(clips) !== JSON.stringify(initialClipsRef.current);
    // subtitlesの変更をチェック
    const subtitlesChanged = JSON.stringify(subtitles) !== JSON.stringify(initialSubtitlesRef.current);
    // 履歴が変更されているかチェック（Undo/Redoが実行された場合）。
    // store 初期値は -1（initHistory 前）、初期化後は 0、編集が入ると 1+ になる。
    // -1 と 0 のどちらも "未編集" として扱うため `> 0` で判定する。
    const historyChanged = historyIndex > 0;
    
    return clipsChanged || subtitlesChanged || historyChanged;
  }, [clips, subtitles, historyIndex]);
  
  // トップに戻る処理
  const handleGoToTop = useCallback(() => {
    if (hasUnsavedChanges && onSaveDraft) {
      // 未保存の変更がある場合は確認ダイアログを表示
      setShowExitConfirmDialog(true);
    } else {
      // 変更がない場合は直接トップに戻る
      router.push('/');
    }
  }, [hasUnsavedChanges, onSaveDraft, router]);
  
  // 確認ダイアログで下書き保存を選択
  const handleSaveAndExit = useCallback(async () => {
    if (onSaveDraft) {
      try {
        await onSaveDraft(subtitles); // 字幕データを渡す
        setShowExitConfirmDialog(false);
        router.push('/');
      } catch (error) {
        logError('Failed to save draft:', error);
        alert(t('alert.draftSaveFailed'));
      }
    }
  }, [onSaveDraft, router, subtitles]);
  
  // 確認ダイアログで保存せずに戻るを選択
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitConfirmDialog(false);
    router.push('/');
  }, [router]);

  // プレビュー内の字幕ドラッグ開始
  const handleSubtitlePreviewDragStart = useCallback((e: React.MouseEvent, subtitle: Subtitle) => {
    if (!selectedSubtitleIds.includes(subtitle.id)) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    setDraggingSubtitleInPreview(true);
    subtitleDragStartPos.current = { x: e.clientX, y: e.clientY };
    subtitleDragStartSubtitle.current = subtitle;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!subtitleDragStartPos.current || !subtitleDragStartSubtitle.current || !previewContainerRef.current) return;
      
      const container = previewContainerRef.current;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      
      const width = rect.width;
      const height = rect.height;
      
      // 位置を計算（Y軸: top/center/bottom）
      let newPosition: 'top' | 'center' | 'bottom' = subtitleDragStartSubtitle.current.position || 'bottom';
      if (relativeY < height * 0.33) {
        newPosition = 'top';
      } else if (relativeY > height * 0.67) {
        newPosition = 'bottom';
      } else {
        newPosition = 'center';
      }
      
      // 配置を計算（X軸: left/center/right）
      let newAlign: 'left' | 'center' | 'right' = subtitleDragStartSubtitle.current.align || 'center';
      if (relativeX < width * 0.33) {
        newAlign = 'left';
      } else if (relativeX > width * 0.67) {
        newAlign = 'right';
      } else {
        newAlign = 'center';
      }
      
      // 位置が変更された場合のみ更新
      if (newPosition !== subtitleDragStartSubtitle.current.position || newAlign !== subtitleDragStartSubtitle.current.align) {
        handleSubtitleEdit(subtitleDragStartSubtitle.current.id, {
          position: newPosition,
          align: newAlign,
        });
        subtitleDragStartSubtitle.current = {
          ...subtitleDragStartSubtitle.current,
          position: newPosition,
          align: newAlign,
        };
      }
    };
    
    const handleMouseUp = () => {
      setDraggingSubtitleInPreview(false);
      subtitleDragStartPos.current = null;
      subtitleDragStartSubtitle.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectedSubtitleIds, handleSubtitleEdit]);

  // 字幕テキストのインライン編集
  const handleSubtitleTextEdit = useCallback((id: string, newText: string) => {
    handleSubtitleEdit(id, { text: newText });
    setEditingSubtitleText(null);
  }, [handleSubtitleEdit]);

  // (handleClipReorder moved to useClipHandlers — see hook invocation below)

  // 字幕のカット（現在位置で分割）
  const handleSubtitleCut = useCallback(() => {
    if (selectedSubtitleIds.length === 0) {
      return;
    }
    // 最初に選択された字幕のみカット（複数選択時は最初の1つ）
    const selectedSubtitleId = selectedSubtitleIds[0];
    const subtitle = subtitles.find(s => s.id === selectedSubtitleId);
    if (!subtitle) {
      return;
    }
    
    // カット位置が字幕の範囲内かチェック
    if (currentTime <= subtitle.startTime || currentTime >= subtitle.endTime) {
      alert(t('alert.subtitleCutOutOfRange'));
      return;
    }
    
    // 字幕を2つに分割
    const firstPart: Subtitle = {
      ...subtitle,
      id: subtitle.id, // 最初の部分は元のIDを保持
      endTime: currentTime,
    };
    
    const secondPart: Subtitle = {
      ...subtitle,
      id: `subtitle-${Date.now()}-${Math.random()}`, // 新しいIDを生成
      startTime: currentTime,
    };
    
    const updatedSubtitles = subtitles.map(sub => 
      sub.id === selectedSubtitleId ? firstPart : sub
    );
    
    // 2つ目の部分を追加（元の字幕の後に挿入）
    const subtitleIndex = updatedSubtitles.findIndex(sub => sub.id === firstPart.id);
    updatedSubtitles.splice(subtitleIndex + 1, 0, secondPart);
    
    setSubtitles(updatedSubtitles);
    
    // 分割後の2つ目の字幕を選択
    setSelectedSubtitleIds([secondPart.id]);
    
    // カット位置にシーク
    updateCurrentTime(currentTime, true);
  }, [subtitles, currentTime, selectedSubtitleIds, updateCurrentTime]);

  // クリップのカット（現在位置で分割）
  const handleClipCut = useCallback(() => {
    // selectedClipIndicesが空の場合はカットできない
    if (selectedClipIndices.length === 0) {
      alert(t('alert.selectSequenceToCut'));
      return;
    }
    // 最初に選択されたクリップのみカット（複数選択時は最初の1つ）
    const selectedClipIndex = selectedClipIndices[0];
    const clip = clips[selectedClipIndex];
    if (!clip) {
      alert(t('alert.sequenceNotFound'));
      return;
    }
    
    const startTime = clipStartTimes[selectedClipIndex];
    const clipDuration = clip.duration || 3;
    const cutPosition = currentTime - startTime;
    
    // カット位置がクリップの範囲内かチェック
    if (cutPosition <= 0 || cutPosition >= clipDuration) {
      alert(t('alert.clipCutOutOfRange'));
      return;
    }
    
    // シーケンスを2つに分割
    // 音声の開始位置を考慮（元のクリップのaudioStartTime + カット位置までの時間）
    const originalAudioStartTime = clip.audioStartTime || 0;
    
    const firstPart: VideoClip = {
      ...clip,
      duration: cutPosition,
      index: selectedClipIndex,
      totalClips: clips.length + 1,
      audioStartTime: originalAudioStartTime, // 最初の部分は元の開始位置を保持
    };
    
    const secondPart: VideoClip = {
      ...clip,
      plotName: `${clip.plotName} ${t('clipProperties.splitSuffix')}`,
      duration: clipDuration - cutPosition,
      index: selectedClipIndex + 1,
      totalClips: clips.length + 1,
      audioStartTime: originalAudioStartTime + cutPosition, // 2つ目の部分はカット位置から開始
    };
    
    const updatedClips = [...clips];
    updatedClips[selectedClipIndex] = firstPart;
    updatedClips.splice(selectedClipIndex + 1, 0, secondPart);
    
    // インデックスを更新
    updatedClips.forEach((c, index) => {
      c.index = index;
      c.totalClips = updatedClips.length;
    });
    
    addToHistory(updatedClips);
    onClipsChange(updatedClips);
    
    // 分割後の2つ目のクリップを選択
    setSelectedClipIndices([selectedClipIndex + 1]);
    
    // カット位置にシーク
    updateCurrentTime(currentTime, true);
  }, [clips, clipStartTimes, currentTime, selectedClipIndices, onClipsChange, addToHistory, videoUrl, updateCurrentTime]);

  // 前のクリップまで過去方向にカット（現在位置から前のクリップの開始位置までを削除）
  const handleClipCutToPrevious = useCallback(() => {
    if (clips.length === 0) {
      return;
    }
    
    // 現在位置にあるクリップを検索
    let targetClipIndex = -1;
    for (let i = clips.length - 1; i >= 0; i--) {
      const clipStartTime = clipStartTimes[i] ?? 0;
      const clipDuration = clips[i]?.duration || 3;
      const clipEndTime = clipStartTime + clipDuration;
      
      if (currentTime >= clipStartTime && currentTime < clipEndTime) {
        targetClipIndex = i;
        break;
      }
    }
    
    if (targetClipIndex === -1) {
      return;
    }
    
    const targetClip = clips[targetClipIndex];
    const targetStartTime = clipStartTimes[targetClipIndex];
    const targetDuration = targetClip.duration || 3;
    const cutPosition = currentTime - targetStartTime;
    
    // 現在位置からクリップの開始位置までを削除（クリップの開始位置を現在位置に変更）
    if (cutPosition > 0 && cutPosition < targetDuration) {
      const updatedClips = [...clips];
      const newDuration = targetDuration - cutPosition;
      const originalAudioStartTime = targetClip.audioStartTime || 0;
      
      updatedClips[targetClipIndex] = {
        ...targetClip,
        duration: newDuration,
        audioStartTime: originalAudioStartTime + cutPosition, // カット位置分、音声の開始位置を進める
      };
      
      // インデックスを更新
      updatedClips.forEach((c, index) => {
        c.index = index;
        c.totalClips = updatedClips.length;
      });
      
      addToHistory(updatedClips);
      onClipsChange(updatedClips);
      setSelectedClipIndices([targetClipIndex]);
      updateCurrentTime(currentTime, true);
    } else if (targetClipIndex > 0) {
      // 現在位置がクリップの開始位置の場合は、前のクリップの終了位置までカット
      const prevClipIndex = targetClipIndex - 1;
      const prevClip = clips[prevClipIndex];
      const prevStartTime = clipStartTimes[prevClipIndex];
      const prevDuration = prevClip.duration || 3;
      const prevEndTime = prevStartTime + prevDuration;
      
      if (currentTime > prevEndTime) {
        // 前のクリップと現在のクリップの間をカット
        const updatedClips = [...clips];
        const gapDuration = currentTime - prevEndTime;
        const newDuration = prevDuration + gapDuration;
        
        const originalPrevAudioStartTime = prevClip.audioStartTime || 0;
        updatedClips[prevClipIndex] = {
          ...prevClip,
          duration: newDuration,
          // 前のクリップの音声開始位置は変更しない（最初の部分を保持）
        };
        
        // 現在のクリップの開始位置を調整
        const remainingDuration = targetDuration - gapDuration;
        const originalTargetAudioStartTime = targetClip.audioStartTime || 0;
        if (remainingDuration > 0) {
          updatedClips[targetClipIndex] = {
            ...targetClip,
            duration: remainingDuration,
            audioStartTime: originalTargetAudioStartTime + gapDuration, // ギャップ分、音声の開始位置を進める
          };
        } else {
          // 現在のクリップを削除
          updatedClips.splice(targetClipIndex, 1);
        }
        
        // インデックスを更新
        updatedClips.forEach((c, index) => {
          c.index = index;
          c.totalClips = updatedClips.length;
        });
        
        addToHistory(updatedClips);
        onClipsChange(updatedClips);
        setSelectedClipIndices([prevClipIndex]);
        updateCurrentTime(currentTime, true);
      }
    }
  }, [clips, clipStartTimes, currentTime, onClipsChange, addToHistory, updateCurrentTime]);

  // 次のクリップまでカット（現在位置から次のクリップの開始位置までを削除）
  const handleClipCutToNext = useCallback(() => {
    if (clips.length === 0) {
      return;
    }
    
    // 現在位置にあるクリップを検索
    let targetClipIndex = -1;
    for (let i = clips.length - 1; i >= 0; i--) {
      const clipStartTime = clipStartTimes[i] ?? 0;
      const clipDuration = clips[i]?.duration || 3;
      const clipEndTime = clipStartTime + clipDuration;
      
      if (currentTime >= clipStartTime && currentTime < clipEndTime) {
        targetClipIndex = i;
        break;
      }
    }
    
    if (targetClipIndex === -1) {
      return;
    }
    
    const targetClip = clips[targetClipIndex];
    const targetStartTime = clipStartTimes[targetClipIndex];
    const targetDuration = targetClip.duration || 3;
    const cutPosition = currentTime - targetStartTime;
    
    // 現在位置からクリップの終了位置までを削除（クリップの終了位置を現在位置に変更）
    if (cutPosition > 0 && cutPosition < targetDuration) {
      const updatedClips = [...clips];
      const newDuration = cutPosition;
      const originalAudioStartTime = targetClip.audioStartTime || 0;
      
      updatedClips[targetClipIndex] = {
        ...targetClip,
        duration: newDuration,
        // 音声の開始位置は変更しない（最初の部分を保持）
        audioStartTime: originalAudioStartTime,
      };
      
      // インデックスを更新
      updatedClips.forEach((c, index) => {
        c.index = index;
        c.totalClips = updatedClips.length;
      });
      
      addToHistory(updatedClips);
      onClipsChange(updatedClips);
      setSelectedClipIndices([targetClipIndex]);
      updateCurrentTime(currentTime, true);
    } else if (targetClipIndex < clips.length - 1) {
      // 現在位置がクリップの終了位置の場合は、次のクリップの開始位置までカット
      const nextClipIndex = targetClipIndex + 1;
      const nextClip = clips[nextClipIndex];
      const nextStartTime = clipStartTimes[nextClipIndex];
      const targetEndTime = targetStartTime + targetDuration;
      
      if (currentTime < nextStartTime) {
        // 現在のクリップと次のクリップの間をカット
        const updatedClips = [...clips];
        const gapDuration = nextStartTime - currentTime;
        const newDuration = targetDuration - gapDuration;
        
        const originalTargetAudioStartTime = targetClip.audioStartTime || 0;
        if (newDuration > 0) {
          updatedClips[targetClipIndex] = {
            ...targetClip,
            duration: newDuration,
            // 音声の開始位置は変更しない（最初の部分を保持）
            audioStartTime: originalTargetAudioStartTime,
          };
        } else {
          // 現在のクリップを削除
          updatedClips.splice(targetClipIndex, 1);
        }
        
        // 次のクリップの開始位置を調整
        const remainingDuration = (nextClip.duration || 3) - gapDuration;
        const originalNextAudioStartTime = nextClip.audioStartTime || 0;
        if (remainingDuration > 0) {
          updatedClips[nextClipIndex - (newDuration > 0 ? 0 : 1)] = {
            ...nextClip,
            duration: remainingDuration,
            audioStartTime: originalNextAudioStartTime + gapDuration, // ギャップ分、音声の開始位置を進める
          };
        } else {
          // 次のクリップを削除
          updatedClips.splice(nextClipIndex - (newDuration > 0 ? 0 : 1), 1);
        }
        
        // インデックスを更新
        updatedClips.forEach((c, index) => {
          c.index = index;
          c.totalClips = updatedClips.length;
        });
        
        addToHistory(updatedClips);
        onClipsChange(updatedClips);
        const newSelectedIndex = newDuration > 0 ? targetClipIndex : (nextClipIndex > 0 ? nextClipIndex - 1 : 0);
        setSelectedClipIndices([newSelectedIndex < updatedClips.length ? newSelectedIndex : updatedClips.length - 1]);
        updateCurrentTime(currentTime, true);
      }
    }
  }, [clips, clipStartTimes, currentTime, onClipsChange, addToHistory, updateCurrentTime]);

  // (handleClipExtend / handleClipCopy / handleClipPaste moved to useClipHandlers — see hook invocation below)

  // (handleSubtitleCopy / handleSubtitlePaste moved to useSubtitleHandlers)

  // Undo / Redo (delegated to useEditorStore actions)
  const handleUndo = useCallback(() => {
    const restored = undoStore();
    if (restored) onClipsChange(restored);
  }, [undoStore, onClipsChange]);

  const handleRedo = useCallback(() => {
    const restored = redoStore();
    if (restored) onClipsChange(restored);
  }, [redoStore, onClipsChange]);

  // タイムラインのクリック
  const handleTimelineClick = useCallback((time: number, isDragging: boolean = false) => {
    updateCurrentTime(time, true);
    // タイムラインをクリックした位置から再生を開始（再生中でない場合のみ、かつドラッグ中でない場合のみ）
    if (!isPlaying && !isDragging) {
      // シーク完了を待ってから再生を開始
      const waitForSeekComplete = () => {
        // シーク完了を待つ（isSeekingRefがfalseになるまで）
        const checkSeekComplete = () => {
          if (!isSeekingRef.current) {
            // シーク完了
        if (videoUrl && videoRef.current) {
          // 完成動画の場合
          const video = videoRef.current;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true);
              })
              .catch((error) => {
                    logError('[VideoEditor] Play error:', error);
                setIsPlaying(false);
              });
          } else {
            setIsPlaying(true);
          }
        } else if (playerRef.current) {
          // Remotion Playerの場合
          try {
            if (playTimeoutRef.current) {
              clearTimeout(playTimeoutRef.current);
            }
            playTimeoutRef.current = setTimeout(() => {
              if (playerRef.current) {
                playerRef.current.play();
                setIsPlaying(true);
              }
              playTimeoutRef.current = null;
            }, 50);
          } catch (error) {
                logError('[VideoEditor] Remotion Player play error:', error);
            setIsPlaying(false);
            if (playTimeoutRef.current) {
              clearTimeout(playTimeoutRef.current);
              playTimeoutRef.current = null;
            }
          }
        }
          } else {
            // まだシーク中、50ms後に再チェック
            setTimeout(checkSeekComplete, 50);
          }
        };
        
        // 初回チェック（シークが即座に完了した場合の対策）
        setTimeout(checkSeekComplete, 50);
      };
      
      waitForSeekComplete();
    }
  }, [updateCurrentTime, isPlaying, videoUrl]);

  // 再生/一時停止
  const handlePlayPause = useCallback(() => {
    if (videoUrl && videoRef.current) {
      // 完成動画の場合
      const video = videoRef.current;
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        // 再生開始前に必ず現在位置を設定
        // 動画が終了している場合のみ最初に戻す
        let targetTime: number;
        if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.1)) {
          targetTime = 0;
        } else {
          // 現在位置を確実に設定（動画の範囲内に制限）
          // video.currentTimeを優先的に使用（一時停止時の位置を保持）
          const savedTime = video.currentTime || currentTime;
          targetTime = Math.max(0, Math.min(video.duration || totalDuration, savedTime));
        }
        
        // currentTimeを設定（位置が変わらない場合は設定しない）
        if (Math.abs(video.currentTime - targetTime) > 0.01) {
          updateCurrentTime(targetTime, true);
        }
        
        // 再生を開始（seekedイベントを待たずに直接再生）
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              logError('Play error:', error);
              setIsPlaying(false);
            });
        } else {
          setIsPlaying(true);
        }
      }
    } else if (playerRef.current) {
      // Remotion Playerの場合
      try {
        const player = playerRef.current;
        if (isPlaying) {
          player.pause();
          setIsPlaying(false);
          // 再生停止時にタイムアウトをクリーンアップ
          if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
            playTimeoutRef.current = null;
          }
        } else {
          // 再生開始前に現在位置にシーク（currentTimeRefを使用）
          updateCurrentTime(currentTimeRef.current, true);
          // 少し待ってから再生（シークが完了してから）
          // 既存のタイムアウトをクリーンアップ
          if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
          }
          playTimeoutRef.current = setTimeout(() => {
            if (playerRef.current) {
              playerRef.current.play();
              setIsPlaying(true);
            }
            playTimeoutRef.current = null;
          }, 50);
        }
      } catch (error) {
        logError('Play/pause error:', error);
        setIsPlaying(!isPlaying);
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
          playTimeoutRef.current = null;
        }
      }
    }
  }, [isPlaying, videoUrl, updateCurrentTime]); // currentTimeとtotalDurationを依存配列から削除

  // エクスポートダイアログを開く
  const handleExportClick = useCallback(() => {
    setExportResolution(videoResolution);
    setShowExportDialog(true);
  }, [videoResolution]);

  // エクスポートを実行
  const handleConfirmExport = useCallback(() => {
    setShowExportDialog(false);
    onExport(exportResolution);
  }, [exportResolution, onExport, setShowExportDialog]);

  // Phase 3.5: keyboard shortcut bindings extracted to a hook.
  useKeyboardShortcuts(
    {
      onPlayPause: handlePlayPause,
      updateCurrentTime,
      onClipAdd: handleClipAdd,
      onClipCopy: handleClipCopy,
      onClipPaste: handleClipPaste,
      onClipCut: handleClipCut,
      onClipCutToPrevious: handleClipCutToPrevious,
      onClipCutToNext: handleClipCutToNext,
      onSubtitleCopy: handleSubtitleCopy,
      onSubtitlePaste: handleSubtitlePaste,
      onSubtitleDelete: handleSubtitleDelete,
      onSubtitleCut: handleSubtitleCut,
      onDeleteSelected: handleDeleteSelected,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onConfirmExport: handleConfirmExport,
    },
    {
      clips,
      clipStartTimes,
      totalDuration,
      subtitles,
      copiedClip,
      copiedSubtitle,
      setCopiedSubtitle,
    },
  );

  // 時間をフォーマット（ゼロカンマ秒単位）
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0d0d0d] text-white relative">
      {/* オンボーディング */}
      <Onboarding replayKey={onboardingReplayKey} />

      {/* Phase 3.2: トップツールバー */}
      <EditorToolbar
        totalDuration={totalDuration}
        showSyncWarning={showSyncWarning}
        previewDuration={previewDuration}
        isSavingDraft={isSavingDraft}
        hasSaveDraft={!!onSaveDraft}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onStepBack={() => updateCurrentTime(Math.max(0, currentTime - 1 / 30), true)}
        onStepForward={() => updateCurrentTime(Math.min(totalDuration, currentTime + 1 / 30), true)}
        onPlayPause={handlePlayPause}
        onBackToTop={handleGoToTop}
        onSaveDraft={() => onSaveDraft?.(subtitles)}
        onExport={handleExportClick}
      />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* プレビューエリア */}
        <div 
          className="flex items-center justify-center p-6 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] relative"
          style={{
            height: previewHeight !== null ? `${previewHeight}px` : 'auto',
            flex: previewHeight !== null ? '0 0 auto' : '1 1 0%', // flex-shrinkを1に設定して、タイムラインの高さを確保
            minHeight: '200px',
            maxHeight: previewHeight !== null ? 'none' : '80vh',
          }}
        >
          {/* 背景装飾 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 w-full h-full flex items-center justify-center">
            {/* BGM用のHTML5 Audio要素（非表示） */}
            {!videoUrl && bgmUrl && (
              <audio
                ref={bgmAudioRef}
                src={convertedBgmUrl || bgmUrl}
                preload="auto"
                style={{ display: 'none' }}
                onEnded={() => {
                  // BGMが終了した場合の処理（必要に応じて）
                  if (bgmAudioRef.current && bgmEndTime !== null) {
                    // ループ再生する場合はここで処理
                  }
                }}
              />
            )}
            <div 
              ref={previewContainerRef}
              id={TOUR_TARGETS.preview}
              className="flex items-center justify-center relative"
              style={{
                width: `${calculatePreviewSize.width}px`,
                height: `${calculatePreviewSize.height}px`,
              }}
            >
              {videoUrl ? (
                // 完成した動画を表示
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-black"
                    style={{
                      width: `${calculatePreviewSize.width}px`,
                      height: `${calculatePreviewSize.height}px`,
                      aspectRatio: '16 / 9',
                      objectFit: 'contain',
                    }}
                    preload="auto"
                    playsInline
                    crossOrigin="anonymous"
                    onLoadedMetadata={() => {
                      debug('[VideoEditor] 動画メタデータ読み込み完了');
                      // メタデータ読み込み完了時に、現在位置を設定
                      if (videoRef.current && currentTime > 0) {
                        updateCurrentTime(currentTime, true);
                      }
                      // 動画に埋め込まれた字幕トラックを無効化
                      disableEmbeddedSubtitles();
                    }}
                    onLoadedData={() => {
                      debug('[VideoEditor] 動画データ読み込み完了');
                      // データ読み込み完了時にも字幕を無効化
                      disableEmbeddedSubtitles();
                    }}
                    onCanPlay={() => {
                      debug('[VideoEditor] 動画再生可能');
                      // 再生可能になった時にも字幕を無効化
                      disableEmbeddedSubtitles();
                    }}
                    onCanPlayThrough={() => {
                      debug('[VideoEditor] 動画全体再生可能');
                    }}
                    onError={(e) => {
                      const video = e.currentTarget;
                      const error = video.error;
                      
                      // エラーコードの説明
                      const errorMessages: Record<number, string> = {
                        1: 'MEDIA_ERR_ABORTED: 動画の読み込みが中断されました',
                        2: 'MEDIA_ERR_NETWORK: ネットワークエラーが発生しました',
                        3: 'MEDIA_ERR_DECODE: 動画のデコードに失敗しました',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: 動画形式がサポートされていません',
                      };
                      
                      // 詳細なエラー情報を収集
                      const errorInfo: Record<string, unknown> = {
                        hasError: !!error,
                        errorCode: error?.code ?? null,
                        errorMessage: error?.message ?? null,
                        networkState: video.networkState,
                        networkStateText: ['EMPTY', 'IDLE', 'LOADING', 'NO_SOURCE'][video.networkState] || 'UNKNOWN',
                        readyState: video.readyState,
                        readyStateText: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState] || 'UNKNOWN',
                        src: video.src || '未設定',
                        currentSrc: video.currentSrc || '未設定',
                        videoUrl: videoUrl || '未設定',
                        videoWidth: video.videoWidth || 0,
                        videoHeight: video.videoHeight || 0,
                        duration: isNaN(video.duration) ? 'NaN' : video.duration,
                        paused: video.paused,
                        ended: video.ended,
                      };
                      
                      if (error?.code) {
                        errorInfo.errorDescription = errorMessages[error.code] || 'エラーの詳細が不明です';
                      }
                      
                      logError('[VideoEditor] 動画読み込みエラー:', errorInfo);
                      
                      // エラーの原因を推測
                      if (!error) {
                        warn('[VideoEditor] ⚠️ video.errorがnullです。ネットワーク状態を確認してください。');
                        if (video.networkState === 3) {
                          logError('[VideoEditor] ❌ ネットワーク状態: NO_SOURCE - 動画ソースが見つかりません');
                        }
                      } else {
                        logError('[VideoEditor] エラー詳細:', {
                          code: error.code,
                          message: error.message || errorMessages[error.code] || '不明なエラー',
                          description: errorMessages[error.code] || 'エラーの詳細が不明です',
                        });
                      }
                      
                      // 動画URLの検証
                      if (!videoUrl) {
                        logError('[VideoEditor] ❌ videoUrlが設定されていません');
                      } else if (video.src !== videoUrl) {
                        warn('[VideoEditor] ⚠️ video.srcとvideoUrlが一致しません:', {
                          videoSrc: video.src,
                          videoUrl: videoUrl,
                        });
                      }
                    }}
                    onSeeking={() => {
                      debug('[VideoEditor] シーク中...');
                    }}
                    onSeeked={() => {
                      debug('[VideoEditor] シーク完了');
                      if (videoRef.current) {
                        debug('[VideoEditor] 現在位置:', videoRef.current.currentTime, '秒');
                      }
                    }}
                  >
                    {t('preview.browserUnsupported')}
                  </video>
                  {/* 字幕オーバーレイ（HTML5 video用） */}
                  {/* 完成動画（videoUrl）が存在する場合、字幕は既に動画に埋め込まれているため、オーバーレイを表示しない */}
                  {!videoUrl && subtitles && subtitles.length > 0 && (
                    <div 
                      className={`absolute inset-0 z-20 ${selectedSubtitleId ? 'pointer-events-auto' : 'pointer-events-none'}`}
                      style={{
                        width: `${calculatePreviewSize.width}px`,
                        height: `${calculatePreviewSize.height}px`,
                      }}
                    >
                      {(() => {
                        const activeSubtitle = subtitles.find(
                          (subtitle) => currentTime >= subtitle.startTime && currentTime < subtitle.endTime
                        );
                        if (!activeSubtitle) return null;
                        
                        const isSelected = selectedSubtitleId === activeSubtitle.id;
                        const isEditing = editingSubtitleText === activeSubtitle.id;
                        
                        // プレビューエリアの実際のサイズを取得（calculatePreviewSizeを使用）
                        const previewWidth = calculatePreviewSize.width;
                        const previewHeight = calculatePreviewSize.height;
                        
                        // 位置の計算（パーセンテージベース）
                        let positionY: number;
                        let positionX: number;
                        
                        if (activeSubtitle.positionYPercent !== undefined) {
                          // パーセンテージベースの位置指定（上から）
                          // 10%の余白を確保（最小10%、最大90%）
                          const clampedYPercent = Math.max(10, Math.min(90, activeSubtitle.positionYPercent));
                          positionY = (clampedYPercent / 100) * previewHeight;
                        } else {
                          // 従来のposition指定（後方互換性）
                          const position = activeSubtitle.position || 'bottom';
                          if (position === 'top') {
                            positionY = 0.1 * previewHeight; // 上から10%
                          } else if (position === 'center') {
                            positionY = 0.5 * previewHeight; // 中央
                          } else {
                            positionY = 0.9 * previewHeight; // 下から10%（上から90%）
                          }
                        }
                        
                        if (activeSubtitle.positionXPercent !== undefined) {
                          // パーセンテージベースの位置指定（左から）
                          // 10%の余白を確保（最小10%、最大90%）
                          const clampedXPercent = Math.max(10, Math.min(90, activeSubtitle.positionXPercent));
                          positionX = (clampedXPercent / 100) * previewWidth;
                        } else {
                          // 従来のalign指定（後方互換性）
                          const align = activeSubtitle.align || 'center';
                          if (align === 'left') {
                            positionX = 0.1 * previewWidth; // 左から10%
                          } else if (align === 'center') {
                            positionX = 0.5 * previewWidth; // 中央
                          } else {
                            positionX = 0.9 * previewWidth; // 右から10%（左から90%）
                          }
                        }
                        
                        // フォントサイズの計算（パーセンテージベース）
                        let fontSizePx: number;
                        if (activeSubtitle.fontSizePercent !== undefined) {
                          // パーセンテージベースのフォントサイズ（プレビュー高さに対する%）
                          fontSizePx = (activeSubtitle.fontSizePercent / 100) * previewHeight;
                        } else {
                          // 従来のfontSize（ピクセル値、後方互換性）
                          // 既存データとの互換性のため、fontSizeが100以下の場合はパーセンテージとして扱う
                          // 100より大きい場合はピクセル値として扱う
                          if (activeSubtitle.fontSize <= 100) {
                            fontSizePx = (activeSubtitle.fontSize / 100) * previewHeight;
                          } else {
                            fontSizePx = activeSubtitle.fontSize;
                          }
                        }
                        
                        // alignの取得（後方互換性のため）
                        const align = activeSubtitle.align || 'center';
                        
                        return (
                          <div
                            className="w-full h-full relative"
                            style={{
                              position: 'relative',
                            }}
                          >
                            <div
                              onMouseDown={(e) => handleSubtitlePreviewDragStart(e, activeSubtitle)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setEditingSubtitleText(activeSubtitle.id);
                                }
                              }}
                              className={isSelected ? 'cursor-move' : ''}
                              style={{
                                background: (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? activeSubtitle.backgroundColor 
                                  : 'transparent',
                                backdropFilter: 'none', // 背景色の有無に関わらずブラーなし
                                padding: '16px 24px',
                                borderRadius: '12px',
                                maxWidth: '90%',
                                textAlign: align,
                                boxShadow: (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? '0 4px 20px rgba(0, 0, 0, 0.5)' 
                                  : 'none',
                                border: isSelected 
                                  ? '2px solid rgba(255, 215, 0, 0.6)' 
                                  : (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? '1px solid rgba(255, 255, 255, 0.1)' 
                                  : 'none',
                                display: 'inline-block',
                                outline: isSelected ? '2px solid rgba(255, 215, 0, 0.3)' : 'none',
                                outlineOffset: '2px',
                              }}
                            >
                              {isEditing ? (
                                <input
                                  ref={(el) => {
                                    subtitleTextInputRef.current = el;
                                    if (el) {
                                      el.focus();
                                      el.select();
                                    }
                                  }}
                                  type="text"
                                  value={activeSubtitle.text}
                                  onChange={(e) => handleSubtitleEdit(activeSubtitle.id, { text: e.target.value })}
                                  onBlur={() => setEditingSubtitleText(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      setEditingSubtitleText(null);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingSubtitleText(null);
                                    }
                                  }}
                                  style={{
                                    color: activeSubtitle.color || '#FFFFFF',
                                    fontSize: `${fontSizePx}px`,
                                    fontFamily: activeSubtitle.fontFamily || 'Noto Sans JP', // 選択されたフォントを使用
                                    fontWeight: 600,
                                    background: 'transparent',
                                    border: '2px solid rgba(255, 215, 0, 0.8)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    width: '100%',
                                    minWidth: '200px',
                                    outline: 'none',
                                  }}
                                />
                              ) : (
                                <p
                                  style={{
                                    color: activeSubtitle.color || '#FFFFFF',
                                    fontSize: `${fontSizePx}px`,
                                    fontFamily: activeSubtitle.fontFamily || 'system-ui, -apple-system, sans-serif', // 実際の字幕と同じフォント
                                    fontWeight: activeSubtitle.fontWeight || 600, // 実際の字幕と同じfontWeight
                                    margin: 0,
                                    lineHeight: activeSubtitle.lineHeight || 1.4, // 実際の字幕と同じlineHeight
                                    letterSpacing: activeSubtitle.letterSpacing || 'normal', // 実際の字幕と同じletterSpacing
                                    textTransform: activeSubtitle.textTransform || 'none', // 実際の字幕と同じtextTransform
                                    textShadow: activeSubtitle.textShadow !== undefined 
                                      ? activeSubtitle.textShadow 
                                      : '0 2px 10px rgba(0, 0, 0, 0.8)', // 実際の字幕と同じtextShadow
                                    ...(activeSubtitle.borderWidth && activeSubtitle.borderWidth > 0 && activeSubtitle.borderColor ? {
                                      WebkitTextStroke: `${activeSubtitle.borderWidth}px ${activeSubtitle.borderColor}`,
                                      paintOrder: 'stroke fill',
                                    } : {}), // 実際の字幕と同じ文字の縁取り
                                  }}
                                >
                                  {activeSubtitle.text}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              ) : (
                // 編集モード: Remotion Playerでプレビュー
                <>
                  {(() => {
                    // durationInFramesを計算
                    const durationInFrames = Math.max(1, Math.ceil(totalDuration * 30));
                    const calculatedPreviewDuration = durationInFrames / 30;
                    
                    // デバッグログを追加してクリップの変更を確認
                    debug('[VideoEditor] ========== Rendering Remotion Player ==========');
                    debug('[VideoEditor] playerKey:', playerKey);
                    debug('[VideoEditor] playerVisible:', playerVisible);
                    debug('[VideoEditor] totalDuration (タイムライン):', totalDuration, '秒');
                    debug('[VideoEditor] durationInFrames:', durationInFrames, 'フレーム');
                    debug('[VideoEditor] calculatedPreviewDuration (プレビュー):', calculatedPreviewDuration, '秒');
                    debug('[VideoEditor] 長さが一致:', Math.abs(totalDuration - calculatedPreviewDuration) < 0.01 ? '✅' : '❌');
                    debug('[VideoEditor] clips count:', clips.length);
                    debug('[VideoEditor] clips details:', clips.map((c, i) => ({
                      index: i,
                      plotName: c.plotName,
                      duration: c.duration,
                      audioStartTime: c.audioStartTime,
                      imageEffect: c.imageEffect,
                      text: c.text?.substring(0, 20) || '',
                    })));
                    debug('[VideoEditor] playerInputProps.clips:', playerInputProps.clips.length);
                    debug('[VideoEditor] playerInputProps total duration:', 
                      playerInputProps.clips.reduce((sum: number, c: VideoClip) => sum + (c.duration || 3), 0), '秒');
                    debug('[VideoEditor] =============================================');
                    return null;
                  })()}
                  {playerVisible ? (
                    <div 
                      className="flex items-center justify-center"
                      style={{
                        width: `${calculatePreviewSize.width}px`,
                        height: `${calculatePreviewSize.height}px`,
                        aspectRatio: '16 / 9', // 16:9固定
                      }}
                    >
                      <Player
                        key={playerKey}
                        ref={playerRef}
                        component={ProductVideo}
                        compositionWidth={config.width}
                        compositionHeight={config.height}
                        fps={30}
                        durationInFrames={Math.max(1, Math.ceil(totalDuration * 30))}
                        controls={false}
                        loop
                        playbackRate={playbackRate}
                        inputProps={playerInputProps}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '12px',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full flex items-center justify-center bg-[rgba(0,0,0,0.4)] rounded-xl"
                      style={{
                        maxHeight: previewHeight !== null ? `${previewHeight - 120}px` : '80vh',
                        height: previewHeight !== null ? `${previewHeight - 120}px` : '80vh',
                      }}
                    >
                      <div className="text-gray-400 text-sm">{t('preview.updating')}</div>
                    </div>
                  )}
                  {/* 字幕オーバーレイ（Remotion Player用） */}
                  {subtitles && subtitles.length > 0 && (
                    <div 
                      className={`absolute z-20 ${selectedSubtitleId ? 'pointer-events-auto' : 'pointer-events-none'}`}
                      style={{
                        width: `${calculatePreviewSize.width}px`,
                        height: `${calculatePreviewSize.height}px`,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {(() => {
                        const activeSubtitle = subtitles.find(
                          (subtitle) => currentTime >= subtitle.startTime && currentTime < subtitle.endTime
                        );
                        if (!activeSubtitle) return null;
                        
                        const isSelected = selectedSubtitleId === activeSubtitle.id;
                        const isEditing = editingSubtitleText === activeSubtitle.id;
                        
                        // プレビューエリアの実際のサイズを取得（calculatePreviewSizeを使用）
                        const previewWidth = calculatePreviewSize.width;
                        const previewHeight = calculatePreviewSize.height;
                        
                        // 位置の計算（パーセンテージベース）
                        let positionY: number;
                        let positionX: number;
                        
                        if (activeSubtitle.positionYPercent !== undefined) {
                          // パーセンテージベースの位置指定（上から）
                          // 10%の余白を確保（最小10%、最大90%）
                          const clampedYPercent = Math.max(10, Math.min(90, activeSubtitle.positionYPercent));
                          positionY = (clampedYPercent / 100) * previewHeight;
                        } else {
                          // 従来のposition指定（後方互換性）
                          const position = activeSubtitle.position || 'bottom';
                          if (position === 'top') {
                            positionY = 0.1 * previewHeight; // 上から10%
                          } else if (position === 'center') {
                            positionY = 0.5 * previewHeight; // 中央
                          } else {
                            positionY = 0.9 * previewHeight; // 下から10%（上から90%）
                          }
                        }
                        
                        if (activeSubtitle.positionXPercent !== undefined) {
                          // パーセンテージベースの位置指定（左から）
                          // 10%の余白を確保（最小10%、最大90%）
                          const clampedXPercent = Math.max(10, Math.min(90, activeSubtitle.positionXPercent));
                          positionX = (clampedXPercent / 100) * previewWidth;
                        } else {
                          // 従来のalign指定（後方互換性）
                          const align = activeSubtitle.align || 'center';
                          if (align === 'left') {
                            positionX = 0.1 * previewWidth; // 左から10%
                          } else if (align === 'center') {
                            positionX = 0.5 * previewWidth; // 中央
                          } else {
                            positionX = 0.9 * previewWidth; // 右から10%（左から90%）
                          }
                        }
                        
                        // フォントサイズの計算（パーセンテージベース）
                        let fontSizePx: number;
                        if (activeSubtitle.fontSizePercent !== undefined) {
                          // パーセンテージベースのフォントサイズ（プレビュー高さに対する%）
                          fontSizePx = (activeSubtitle.fontSizePercent / 100) * previewHeight;
                        } else {
                          // 従来のfontSize（ピクセル値、後方互換性）
                          // 既存データとの互換性のため、fontSizeが100以下の場合はパーセンテージとして扱う
                          // 100より大きい場合はピクセル値として扱う
                          if (activeSubtitle.fontSize <= 100) {
                            fontSizePx = (activeSubtitle.fontSize / 100) * previewHeight;
                          } else {
                            fontSizePx = activeSubtitle.fontSize;
                          }
                        }
                        
                        // alignの取得（後方互換性のため）
                        const align = activeSubtitle.align || 'center';
                        
                        return (
                          <div
                            className="w-full h-full relative"
                            style={{
                              position: 'relative',
                            }}
                          >
                            <div
                              onMouseDown={(e) => handleSubtitlePreviewDragStart(e, activeSubtitle)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setEditingSubtitleText(activeSubtitle.id);
                                }
                              }}
                              className={isSelected ? 'cursor-move' : ''}
                              style={{
                                position: 'absolute',
                                top: `${positionY}px`,
                                left: `${positionX}px`,
                                transform: 'translate(-50%, -50%)', // 中央揃え
                                background: (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? activeSubtitle.backgroundColor 
                                  : 'transparent',
                                backdropFilter: 'none', // 背景色の有無に関わらずブラーなし
                                padding: '16px 24px',
                                borderRadius: '12px',
                                maxWidth: '90%',
                                textAlign: align,
                                boxShadow: (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? '0 4px 20px rgba(0, 0, 0, 0.5)' 
                                  : 'none',
                                border: isSelected 
                                  ? '2px solid rgba(255, 215, 0, 0.6)' 
                                  : (activeSubtitle.backgroundColor && activeSubtitle.backgroundColor.trim() !== '' && activeSubtitle.backgroundColor.toLowerCase() !== 'transparent') 
                                  ? '1px solid rgba(255, 255, 255, 0.1)' 
                                  : 'none',
                                display: 'inline-block',
                                outline: isSelected ? '2px solid rgba(255, 215, 0, 0.3)' : 'none',
                                outlineOffset: '2px',
                              }}
                            >
                              {isEditing ? (
                                <input
                                  ref={(el) => {
                                    subtitleTextInputRef.current = el;
                                    if (el) {
                                      el.focus();
                                      el.select();
                                    }
                                  }}
                                  type="text"
                                  value={activeSubtitle.text}
                                  onChange={(e) => handleSubtitleEdit(activeSubtitle.id, { text: e.target.value })}
                                  onBlur={() => setEditingSubtitleText(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      setEditingSubtitleText(null);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingSubtitleText(null);
                                    }
                                  }}
                                  style={{
                                    color: activeSubtitle.color || '#FFFFFF',
                                    fontSize: `${fontSizePx}px`,
                                    fontFamily: activeSubtitle.fontFamily || 'system-ui, -apple-system, sans-serif', // 実際の字幕と同じフォント
                                    fontWeight: activeSubtitle.fontWeight || 600, // 実際の字幕と同じfontWeight
                                    background: 'transparent',
                                    border: '2px solid rgba(255, 215, 0, 0.8)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    width: '100%',
                                    minWidth: '200px',
                                    outline: 'none',
                                    lineHeight: activeSubtitle.lineHeight || 1.4, // 実際の字幕と同じlineHeight
                                    letterSpacing: activeSubtitle.letterSpacing || 'normal', // 実際の字幕と同じletterSpacing
                                    textTransform: activeSubtitle.textTransform || 'none', // 実際の字幕と同じtextTransform
                                    textShadow: activeSubtitle.textShadow !== undefined 
                                      ? activeSubtitle.textShadow 
                                      : '0 2px 10px rgba(0, 0, 0, 0.8)', // 実際の字幕と同じtextShadow
                                    ...(activeSubtitle.borderWidth && activeSubtitle.borderWidth > 0 && activeSubtitle.borderColor ? {
                                      WebkitTextStroke: `${activeSubtitle.borderWidth}px ${activeSubtitle.borderColor}`,
                                      paintOrder: 'stroke fill',
                                    } : {}), // 実際の字幕と同じ文字の縁取り
                                  }}
                                />
                              ) : (
                                <p
                                  style={{
                                    color: activeSubtitle.color || '#FFFFFF',
                                    fontSize: `${fontSizePx}px`,
                                    fontFamily: activeSubtitle.fontFamily || 'system-ui, -apple-system, sans-serif', // 実際の字幕と同じフォント
                                    fontWeight: activeSubtitle.fontWeight || 600, // 実際の字幕と同じfontWeight
                                    margin: 0,
                                    lineHeight: activeSubtitle.lineHeight || 1.4, // 実際の字幕と同じlineHeight
                                    letterSpacing: activeSubtitle.letterSpacing || 'normal', // 実際の字幕と同じletterSpacing
                                    textTransform: activeSubtitle.textTransform || 'none', // 実際の字幕と同じtextTransform
                                    textShadow: activeSubtitle.textShadow !== undefined 
                                      ? activeSubtitle.textShadow 
                                      : '0 2px 10px rgba(0, 0, 0, 0.8)', // 実際の字幕と同じtextShadow
                                    ...(activeSubtitle.borderWidth && activeSubtitle.borderWidth > 0 && activeSubtitle.borderColor ? {
                                      WebkitTextStroke: `${activeSubtitle.borderWidth}px ${activeSubtitle.borderColor}`,
                                      paintOrder: 'stroke fill',
                                    } : {}), // 実際の字幕と同じ文字の縁取り
                                  }}
                                >
                                  {activeSubtitle.text}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 左側ツールバー */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20">
            <div className="flex flex-col gap-3 bg-[rgba(0,0,0,0.7)] backdrop-blur-xl rounded-2xl p-3 border border-[rgba(255,255,255,0.1)]">
              <ToolButton
                id={TOUR_TARGETS.subtitleButton}
                icon="📝"
                label={t('sideTools.subtitle')}
                onClick={() => {
                  handleSubtitleAdd();
                }}
                color="blue"
              />
              <ToolButton
                id={TOUR_TARGETS.propertiesButton}
                icon="🎨"
                label={t('sideTools.properties')}
                onClick={() => {
                  if (showProperties) {
                    setShowProperties(false);
                  } else {
                    setShowProperties(true);
                    setBgmEnabled(false); // 他のウィンドウを閉じる
                    setShowSubtitleEditor(false); // 他のウィンドウを閉じる
                  }
                }}
                active={showProperties}
                color="purple"
              />
              <ToolButton
                id={TOUR_TARGETS.bgmButton}
                icon="🎵"
                label={t('sideTools.bgm')}
                onClick={() => {
                  if (bgmEnabled) {
                    setBgmEnabled(false);
                  } else {
                    setBgmEnabled(true);
                    setShowProperties(false); // 他のウィンドウを閉じる
                    setShowSubtitleEditor(false); // 他のウィンドウを閉じる
                  }
                }}
                active={bgmEnabled}
                color="pink"
              />
            </div>
          </div>

          {/* 右下: ツアー再生 & ショートカットボタン */}
          <div className="absolute right-6 bottom-6 z-20 flex items-center gap-2">
            <button
              onClick={() => bumpOnboardingReplay()}
              className="px-4 py-2 text-gray-300 hover:text-gray-100 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-all text-sm font-medium bg-[rgba(0,0,0,0.7)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] shadow-lg"
              title={t('sideTools.showTourTooltip')}
              aria-label={t('sideTools.showTourTooltip')}
            >
              {t('sideTools.showTour')}
            </button>
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="px-4 py-2 text-gray-300 hover:text-gray-100 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-all text-sm font-medium bg-[rgba(0,0,0,0.7)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] shadow-lg"
              title={t('sideTools.shortcutsTooltip')}
            >
              {t('sideTools.shortcuts')}
            </button>
          </div>
        </div>

        {/* リサイズハンドル */}
        <div
          className="relative h-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] cursor-row-resize transition-colors group"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            resizeStartY.current = e.clientY;
            const previewElement = e.currentTarget.previousElementSibling as HTMLElement;
            if (previewElement) {
              resizeStartHeight.current = previewElement.offsetHeight;
            }
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-0.5 bg-[rgba(255,255,255,0.3)] group-hover:bg-[rgba(255,255,255,0.5)] transition-colors rounded-full" />
          </div>
        </div>

        {/* タイムラインエリア */}
        <div 
          className="bg-[rgba(0,0,0,0.8)] backdrop-blur-xl border-t border-[rgba(255,255,255,0.1)] overflow-hidden"
          style={{
            flex: previewHeight !== null ? '1 1 0%' : '0 0 320px', // タイムラインの高さを固定値（320px）に設定
            minHeight: '320px',
            maxHeight: '320px', // 最大高さも320pxに固定
          }}
        >
          <input
            ref={addSceneFileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={(e) => handleAddSceneFiles(e.target.files)}
          />
          <ModernTimeline
            clips={clips}
            clipStartTimes={clipStartTimes}
            currentTime={currentTime}
            totalDuration={totalDuration}
            selectedClipIndices={selectedClipIndices}
            onTimeClick={handleTimelineClick}
            onClipSelect={handleClipSelect}
            onClipDoubleClick={(index, modifiers) => {
              handleClipSelect(index, modifiers);
              setShowProperties(true);
              setBgmEnabled(false); // 他のウィンドウを閉じる
              setShowSubtitleEditor(false); // 他のウィンドウを閉じる
              // クリップの開始位置に移動
              updateCurrentTime(clipStartTimes[index], true);
            }}
            onClipEdit={(index, updates) => handleClipEdit(index, updates)}
            onClipDelete={handleClipDelete}
            onClipAdd={handleClipAdd}
            isAddingScene={isAddingScene}
            onClipReorder={handleClipReorder}
            zoom={timelineZoom}
            onZoomChange={setTimelineZoom}
            bgmUrl={bgmUrl}
            bgmVolume={bgmVolume}
            subtitles={subtitles}
            selectedSubtitleIds={selectedSubtitleIds}
            onSubtitleSelect={handleSubtitleSelect}
            onSubtitleDoubleClick={(id, modifiers) => {
              handleSubtitleSelect(id, modifiers);
              // ダブルクリックで詳細スライドを表示
              setShowSubtitleEditor(true);
              setBgmEnabled(false); // 他のウィンドウを閉じる
              setShowProperties(false); // 他のウィンドウを閉じる
            }}
            onSubtitleAdd={handleSubtitleAdd}
            onSubtitleEdit={handleSubtitleEdit}
            onSubtitleDelete={handleSubtitleDelete}
            onBgmTrackClick={() => {
              // BGM設定が既に開いている場合は閉じる、開いていない場合は開く
              setBgmEnabled(prev => {
                if (prev) {
                  return false;
                } else {
                  setShowProperties(false); // 他のウィンドウを閉じる
                  setShowSubtitleEditor(false); // 他のウィンドウを閉じる
                  return true;
                }
              });
            }}
          />
        </div>
      </div>

      {/* Phase 3.3: mutually-exclusive side panels (Properties / Subtitle / BGM).
         Container subscribes to activePanel directly and renders the right one. */}
      <SidePanelsContainer
        clips={clips}
        onClipEdit={handleClipEdit}
        subtitles={subtitles}
        onSubtitleEdit={handleSubtitleEdit}
        onSubtitleDelete={handleSubtitleDelete}
        totalDuration={totalDuration}
        onTimeSeek={(time) => updateCurrentTime(time, true)}
        bgmUrl={bgmUrl}
        bgmVolume={bgmVolume}
        bgmStartTime={bgmStartTime}
        bgmEndTime={bgmEndTime}
        subtitleAudioEnabled={subtitleAudioEnabled}
        subtitleAudioVolume={subtitleAudioVolume}
        onBgmUrlChange={setBgmUrl}
        onBgmVolumeChange={setBgmVolume}
        onBgmStartTimeChange={setBgmStartTime}
        onBgmEndTimeChange={setBgmEndTime}
        onSubtitleAudioEnabledChange={setSubtitleAudioEnabled}
        onSubtitleAudioVolumeChange={setSubtitleAudioVolume}
      />

      {/* Phase 3.1: dialog/overlay components — each renders null when its
         own visibility flag is off, so they can sit unconditionally here. */}
      <ShortcutsOverlay />
      <ExportDialog
        videoAspectRatio={videoAspectRatio}
        exportResolution={exportResolution}
        onResolutionChange={setExportResolution}
        onConfirm={handleConfirmExport}
      />
      <ExitConfirmDialog
        open={showExitConfirmDialog}
        isSavingDraft={isSavingDraft}
        onSaveAndExit={handleSaveAndExit}
        onExit={handleExitWithoutSaving}
        onCancel={() => setShowExitConfirmDialog(false)}
      />
    </div>
  );
}



