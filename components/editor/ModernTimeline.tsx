'use client';

// Multi-track timeline: clips track + subtitles track + BGM track + ruler.
// Handles drag-to-reorder, click-to-seek, hover scrubbing, edge trim, +scene
// affordance with upload spinner, and per-track context menus. The largest
// sub-component of the editor (~1.5k lines) — extracted from VideoEditor.tsx
// in Phase 1 of the refactor; not yet split further by track.

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { debug } from '@/lib/utils/logger.client';
import type { VideoClip, Subtitle } from '@/src/types';
import { TOUR_TARGETS } from '@/lib/onboardingTargets';

export interface ModernTimelineProps {
  clips: VideoClip[];
  clipStartTimes: number[];
  currentTime: number;
  totalDuration: number;
  selectedClipIndices: number[];
  onTimeClick: (time: number, isDragging?: boolean) => void;
  onClipSelect: (index: number, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => void;
  onClipDoubleClick?: (index: number, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => void;
  onClipEdit: (index: number, updates: Partial<VideoClip>) => void;
  onClipDelete: (index: number) => void;
  onClipAdd: () => void;
  isAddingScene?: boolean;
  onClipReorder: (fromIndex: number, toIndex: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  bgmUrl: string | null;
  bgmVolume: number;
  subtitles: Subtitle[];
  selectedSubtitleIds: string[];
  onSubtitleSelect: (id: string, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => void;
  onSubtitleDoubleClick?: (id: string, modifiers?: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => void;
  onSubtitleAdd: () => void;
  onSubtitleEdit: (id: string, updates: Partial<Subtitle>) => void;
  onSubtitleDelete: (id: string) => void;
  onBgmTrackClick?: () => void;
}

export function ModernTimeline({
  clips,
  clipStartTimes,
  currentTime,
  totalDuration,
  selectedClipIndices,
  onTimeClick,
  onClipSelect,
  onClipDoubleClick,
  onClipEdit,
  onClipDelete,
  onClipAdd,
  isAddingScene,
  onClipReorder,
  zoom,
  onZoomChange,
  bgmUrl,
  bgmVolume,
  subtitles,
  selectedSubtitleIds,
  onSubtitleSelect,
  onSubtitleDoubleClick,
  onSubtitleAdd,
  onSubtitleEdit,
  onSubtitleDelete,
  onBgmTrackClick,
}: ModernTimelineProps) {
  const t = useTranslations('editor');
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingPin, setIsDraggingPin] = useState(false); // ピンのドラッグ中かどうか
  const [isBoxSelecting, setIsBoxSelecting] = useState(false); // ドラッグボックス選択中かどうか
  const [boxSelectStart, setBoxSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ x: number; y: number } | null>(null);
  const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [resizingClipIndex, setResizingClipIndex] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'left' | 'right' | null>(null);
  const resizeStartTime = useRef<number>(0);
  const resizeStartDuration = useRef<number>(0);
  const shouldAutoScroll = useRef<boolean>(true);
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 自動スクロール再有効化のsetTimeoutのIDを保存
  const [isZoomDragging, setIsZoomDragging] = useState(false);
  const zoomStartY = useRef<number>(0);
  const zoomStartZoom = useRef<number>(1);
  const zoomAnimationFrameRef = useRef<number | null>(null); // ズームアニメーションフレーム用
  const zoomUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ズーム更新のデバウンス用
  
  // 横方向長押しでズーム調整用の状態
  const [isHorizontalZoomDragging, setIsHorizontalZoomDragging] = useState(false);
  const horizontalZoomStartX = useRef<number>(0);
  const horizontalZoomStartZoom = useRef<number>(1);
  const horizontalZoomTimerRef = useRef<NodeJS.Timeout | null>(null);
  const horizontalZoomMouseDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  const HORIZONTAL_ZOOM_LONG_PRESS_DELAY = 600; // 600ms長押しで横方向ズーム開始
  
  // 字幕リサイズ・ドラッグ用の状態
  const [resizingSubtitleId, setResizingSubtitleId] = useState<string | null>(null);
  const [subtitleResizeHandle, setSubtitleResizeHandle] = useState<'left' | 'right' | null>(null);
  const [draggingSubtitleId, setDraggingSubtitleId] = useState<string | null>(null);
  const subtitleResizeStartTime = useRef<number>(0);
  const subtitleResizeStartEndTime = useRef<number>(0);
  const subtitleDragStartTime = useRef<number>(0);
  const subtitleDragStartOffset = useRef<number>(0);
  
  // イベントリスナーの参照を保持（クリーンアップ用）
  const pinDragHandlersRef = useRef<{ mousemove: ((e: MouseEvent) => void) | null; mouseup: (() => void) | null }>({ mousemove: null, mouseup: null });
  const isDraggingPinRef = useRef(false); // ピンのドラッグ状態をrefで管理（クロージャ問題を回避）
  const resizeHandlersRef = useRef<{ mousemove: ((e: MouseEvent) => void) | null; mouseup: (() => void) | null }>({ mousemove: null, mouseup: null });
  const subtitleResizeHandlersRef = useRef<{ mousemove: ((e: MouseEvent) => void) | null; mouseup: (() => void) | null }>({ mousemove: null, mouseup: null });
  const subtitleDragHandlersRef = useRef<{ mousemove: ((e: MouseEvent) => void) | null; mouseup: (() => void) | null }>({ mousemove: null, mouseup: null });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ドラッグボックス選択機能は廃止（長押しタイマーのクリーンアップも不要）

  // タイムラインの幅を計算（ズームレベルに応じて）
  // 実際の秒数よりも3秒分多く将来方向にタイムラインを表示（「＋シーン追加」ボタン用）
  const timelineWidth = useMemo(() => {
    // 基本幅: 1秒あたり100px、ズームで調整
    // totalDurationに3秒を追加して、将来方向に3秒分のスペースを確保
    const extendedDuration = totalDuration + 3;
    const baseWidth = extendedDuration * 100 * zoom;
    // 最小幅はコンテナ幅、最大幅は制限なし
    return Math.max(800, baseWidth);
  }, [totalDuration, zoom]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !timelineContainerRef.current) return;
    
    const containerRect = timelineContainerRef.current.getBoundingClientRect();
    const timelineRect = timelineRef.current.getBoundingClientRect();
    // スクロール位置を考慮した相対位置
    const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
    const percentage = x / timelineRect.width;
    // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
    const extendedDuration = totalDuration + 3;
    const time = percentage * extendedDuration;
    
    // クリックできる範囲は実際のtotalDurationまでに制限
    onTimeClick(Math.max(0, Math.min(time, totalDuration)));
  };

  // マウスホイールで横スクロール（Shift+ホイール）またはズーム（Ctrl/Cmd/Alt+ホイール）
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Ctrl/Cmd/Alt + ホイールでズーム（Premiere Proスタイル）
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      if (!timelineRef.current || !timelineContainerRef.current) return;
      
      // 既存のタイムアウトをクリア（デバウンス処理）
      if (zoomUpdateTimeoutRef.current) {
        clearTimeout(zoomUpdateTimeoutRef.current);
      }
      
      // マウス位置を基準にズーム
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const scrollLeft = timelineContainerRef.current.scrollLeft;
      // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
      const extendedDuration = totalDuration + 3;
      const mouseTime = ((mouseX + scrollLeft) / timelineWidth) * extendedDuration;
      
      // ズーム量を計算（デルタに応じて、より滑らかに）
      const zoomSpeed = 0.05; // ズーム速度を調整
      const zoomDelta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
      const newZoom = Math.max(0.1, Math.min(5, zoom + zoomDelta));
      
      // ズーム後のタイムライン幅
      const newTimelineWidth = Math.max(800, totalDuration * 100 * newZoom);
      
      // マウス位置の時間を維持するようにスクロール位置を調整
      const newScrollLeft = (mouseTime / totalDuration) * newTimelineWidth - mouseX;
      
      // デバウンス処理：連続したズーム操作をまとめて処理
      zoomUpdateTimeoutRef.current = setTimeout(() => {
        onZoomChange(newZoom);
        
        // スクロール位置を更新（requestAnimationFrameを使用）
        requestAnimationFrame(() => {
          if (timelineContainerRef.current) {
            timelineContainerRef.current.scrollLeft = Math.max(0, newScrollLeft);
          }
        });
      }, 16); // 約60fps（16ms）で更新
    } else if (e.shiftKey || e.deltaX !== 0) {
      // Shift+ホイールで横スクロール
      e.preventDefault();
      if (timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft += e.deltaY || e.deltaX;
      }
    } else {
      // 通常のホイールで横スクロール（Premiere Proスタイル）
      e.preventDefault();
      if (timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  // 現在位置に自動スクロール（requestAnimationFrameを使用して最適化）
  useEffect(() => {
    if (!timelineContainerRef.current || !timelineRef.current || !shouldAutoScroll.current) return;
    
    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 200; // 200msごとに更新（パフォーマンス向上）
    
    const updateScroll = (currentTime: number) => {
      const now = performance.now();
      
      // 更新間隔を制限（パフォーマンス向上）
      if (now - lastUpdateTime < UPDATE_INTERVAL) {
        animationFrameId = requestAnimationFrame(() => updateScroll(currentTime));
        return;
      }
      
      lastUpdateTime = now;
      
      if (!timelineContainerRef.current || !timelineRef.current || !shouldAutoScroll.current) {
        return;
      }
      
      const container = timelineContainerRef.current;
      const timeline = timelineRef.current;
      const containerWidth = container.clientWidth;
      const scrollWidth = timeline.scrollWidth;
      
      if (scrollWidth <= containerWidth) return; // スクロール不要な場合は何もしない
      
      // 現在位置のパーセンテージ
      const currentPercent = totalDuration > 0 ? (currentTime / totalDuration) : 0;
      const targetScrollLeft = (scrollWidth - containerWidth) * currentPercent;
      const currentScrollLeft = container.scrollLeft;
      
      // 現在位置が表示範囲外の場合のみスクロール
      const visibleStart = currentScrollLeft;
      const visibleEnd = currentScrollLeft + containerWidth;
      const targetPosition = (scrollWidth * currentPercent);
      
      if (targetPosition < visibleStart || targetPosition > visibleEnd) {
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        });
      }
    };
    
    // 初回実行
    animationFrameId = requestAnimationFrame(() => updateScroll(currentTime));
    
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [currentTime, totalDuration, timelineWidth]);

  // 手動スクロール時は自動スクロールを一時的に無効化
  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      shouldAutoScroll.current = false;
      // 既存のタイムアウトをクリーンアップ
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
      // 2秒後に自動スクロールを再有効化
      autoScrollTimeoutRef.current = setTimeout(() => {
        shouldAutoScroll.current = true;
        autoScrollTimeoutRef.current = null;
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      // タイムアウトをクリーンアップ
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // リサイズハンドルがクリックされた場合は処理しない
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    // ピンがクリックされた場合は処理しない（ピンのonMouseDownで処理される）
    const target = e.target as HTMLElement;
    if (target.closest('[data-pin-indicator]')) {
      return;
    }
    // クリップや字幕がクリックされた場合は処理しない（個別選択）
    if (target.closest('.clip-item') || target.closest('.subtitle-item')) {
      return;
    }
    // ピンのドラッグ中は処理しない
    if (isDraggingPin) {
      return;
    }
    
    // 横方向長押しでズーム調整機能
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      // 左クリックのみ（修飾キーなし）
      if (!timelineContainerRef.current) return;
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const startX = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      const startY = e.clientY - containerRect.top;
      
      // マウスダウン位置を記録
      horizontalZoomMouseDownPositionRef.current = { x: startX, y: startY };
      
      // 既存のタイマーをクリア
      if (horizontalZoomTimerRef.current) {
        clearTimeout(horizontalZoomTimerRef.current);
      }
      
      // 長押しタイマーを開始（横方向ズームモードに入る）
      horizontalZoomTimerRef.current = setTimeout(() => {
        setIsHorizontalZoomDragging(true);
        horizontalZoomStartX.current = startX;
        horizontalZoomStartZoom.current = zoom;
        debug('[ModernTimeline] 横方向ズームモード開始');
      }, HORIZONTAL_ZOOM_LONG_PRESS_DELAY);
      
      // 通常のドラッグも開始（ピン移動のために）
      setIsDragging(true);
    } else {
      // 修飾キーありのクリック処理
      setIsDragging(true);
      handleTimelineClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 横方向ズームモード中の場合、左右のドラッグでズームを調整
    if (isHorizontalZoomDragging && timelineContainerRef.current) {
      e.preventDefault();
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const currentX = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      
      // 横方向のドラッグ量に応じてズームを調整
      const deltaX = currentX - horizontalZoomStartX.current;
      const zoomSpeed = 0.001; // ズーム速度を調整（1pxあたりのズーム量）
      const zoomDelta = deltaX * zoomSpeed;
      const newZoom = Math.max(0.1, Math.min(5, horizontalZoomStartZoom.current + zoomDelta));
      
      // マウス位置を基準にズーム
      const mouseX = e.clientX - containerRect.left;
      const scrollLeft = timelineContainerRef.current.scrollLeft;
      const extendedDuration = totalDuration + 3;
      // 現在のタイムライン幅を使用（useMemoで計算された最新値）
      const currentTimelineWidth = Math.max(800, extendedDuration * 100 * zoom);
      const mouseTime = ((mouseX + scrollLeft) / currentTimelineWidth) * extendedDuration;
      
      // ズーム後のタイムライン幅
      const newTimelineWidth = Math.max(800, extendedDuration * 100 * newZoom);
      
      // マウス位置の時間を維持するようにスクロール位置を調整
      const newScrollLeft = (mouseTime / extendedDuration) * newTimelineWidth - mouseX;
      
      // デバウンス処理：連続したズーム操作をまとめて処理
      if (zoomUpdateTimeoutRef.current) {
        clearTimeout(zoomUpdateTimeoutRef.current);
      }
      
      zoomUpdateTimeoutRef.current = setTimeout(() => {
        onZoomChange(newZoom);
        
        // スクロール位置を更新
        requestAnimationFrame(() => {
          if (timelineContainerRef.current) {
            timelineContainerRef.current.scrollLeft = Math.max(0, newScrollLeft);
          }
        });
      }, 16); // 約60fpsで更新
      
      return; // 横方向ズーム中はピン移動を実行しない
    }
    
    // 横方向ズームモードでない場合、マウス移動中に一定距離以上動いた場合は長押しタイマーをキャンセル
    if (horizontalZoomMouseDownPositionRef.current && !isHorizontalZoomDragging && horizontalZoomTimerRef.current) {
      if (!timelineContainerRef.current) return;
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const currentX = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      const currentY = e.clientY - containerRect.top;
      const distanceX = Math.abs(currentX - horizontalZoomMouseDownPositionRef.current.x);
      const distanceY = Math.abs(currentY - horizontalZoomMouseDownPositionRef.current.y);
      
      // 縦方向に5px以上動いた場合は長押し判定をキャンセル（ピン移動として処理）
      if (distanceY > 5) {
        clearTimeout(horizontalZoomTimerRef.current);
        horizontalZoomTimerRef.current = null;
      }
    }
    
    // 通常のドラッグ（ピン移動）
    if (isDragging && !resizingClipIndex && !isDraggingPin && !isHorizontalZoomDragging) {
      // ピン移動を実行
      handleTimelineClick(e);
    }
  };

  const handleMouseUp = () => {
    // 横方向ズームタイマーをクリア
    if (horizontalZoomTimerRef.current) {
      clearTimeout(horizontalZoomTimerRef.current);
      horizontalZoomTimerRef.current = null;
    }
    
    // 横方向ズームモードを終了
    setIsHorizontalZoomDragging(false);
    horizontalZoomMouseDownPositionRef.current = null;
    
    // 通常のドラッグを終了
    setIsDragging(false);
    if (resizingClipIndex !== null) {
      setResizingClipIndex(null);
      setResizeHandle(null);
    }
  };

  // リサイズハンドルのマウスダウン
  const handleResizeStart = (e: React.MouseEvent, clipIndex: number, handle: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    
    // 既存のイベントリスナーをクリーンアップ
    if (resizeHandlersRef.current.mousemove) {
      document.removeEventListener('mousemove', resizeHandlersRef.current.mousemove);
    }
    if (resizeHandlersRef.current.mouseup) {
      document.removeEventListener('mouseup', resizeHandlersRef.current.mouseup);
    }
    
    const clip = clips[clipIndex];
    const startTime = clipStartTimes[clipIndex];
    
    setResizingClipIndex(clipIndex);
    setResizeHandle(handle);
    resizeStartTime.current = startTime;
    resizeStartDuration.current = clip.duration || 3;
    
    // グローバルマウスイベントを設定
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !timelineContainerRef.current) {
        // リサイズが終了した場合、クリーンアップ
        if (resizeHandlersRef.current.mousemove) {
          document.removeEventListener('mousemove', resizeHandlersRef.current.mousemove);
          resizeHandlersRef.current.mousemove = null;
        }
        if (resizeHandlersRef.current.mouseup) {
          document.removeEventListener('mouseup', resizeHandlersRef.current.mouseup);
          resizeHandlersRef.current.mouseup = null;
        }
        return;
      }
      
      // resizingClipIndexとresizeHandleの最新値を取得するため、refを使用
      const currentResizingIndex = resizingClipIndex;
      const currentResizeHandle = resizeHandle;
      
      if (currentResizingIndex === null || currentResizeHandle === null) return;
      
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const timelineRect = timelineRef.current.getBoundingClientRect();
      // スクロール位置を考慮した相対位置
      const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      const percentage = x / timelineRect.width;
      // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
      const extendedDuration = totalDuration + 3;
      const time = percentage * extendedDuration;
      
      const currentClip = clips[currentResizingIndex];
      const clipStartTime = clipStartTimes[currentResizingIndex];
      const currentDuration = currentClip.duration || 3;
      
      if (currentResizeHandle === 'right') {
        // 右端をリサイズ: 長さを変更
        const newDuration = Math.max(0.1, Math.min(60, time - clipStartTime));
        if (newDuration > 0.1 && newDuration !== currentDuration) {
          onClipEdit(currentResizingIndex, { duration: newDuration });
        }
      } else {
        // 左端をリサイズ: 長さを変更（開始位置は変更しない）
        const newDuration = Math.max(0.1, Math.min(60, clipStartTime + currentDuration - time));
        if (newDuration > 0.1 && newDuration !== currentDuration && time < clipStartTime + currentDuration) {
          onClipEdit(currentResizingIndex, { duration: newDuration });
        }
      }
    };
    
    const handleMouseUp = () => {
      setResizingClipIndex(null);
      setResizeHandle(null);
      
      // イベントリスナーを削除
      if (resizeHandlersRef.current.mousemove) {
        document.removeEventListener('mousemove', resizeHandlersRef.current.mousemove);
        resizeHandlersRef.current.mousemove = null;
      }
      if (resizeHandlersRef.current.mouseup) {
        document.removeEventListener('mouseup', resizeHandlersRef.current.mouseup);
        resizeHandlersRef.current.mouseup = null;
      }
    };
    
    // イベントハンドラーをrefに保存
    resizeHandlersRef.current.mousemove = handleMouseMove;
    resizeHandlersRef.current.mouseup = handleMouseUp;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 字幕リサイズハンドルのマウスダウン
  const handleSubtitleResizeStart = (e: React.MouseEvent, subtitleId: string, handle: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    
    // 既存のイベントリスナーをクリーンアップ
    if (subtitleResizeHandlersRef.current.mousemove) {
      document.removeEventListener('mousemove', subtitleResizeHandlersRef.current.mousemove);
    }
    if (subtitleResizeHandlersRef.current.mouseup) {
      document.removeEventListener('mouseup', subtitleResizeHandlersRef.current.mouseup);
    }
    
    const subtitle = subtitles.find(s => s.id === subtitleId);
    if (!subtitle) return;
    
    setResizingSubtitleId(subtitleId);
    setSubtitleResizeHandle(handle);
    subtitleResizeStartTime.current = subtitle.startTime;
    subtitleResizeStartEndTime.current = subtitle.endTime;
    
    // グローバルマウスイベントを設定
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !timelineContainerRef.current) {
        // リサイズが終了した場合、クリーンアップ
        if (subtitleResizeHandlersRef.current.mousemove) {
          document.removeEventListener('mousemove', subtitleResizeHandlersRef.current.mousemove);
          subtitleResizeHandlersRef.current.mousemove = null;
        }
        if (subtitleResizeHandlersRef.current.mouseup) {
          document.removeEventListener('mouseup', subtitleResizeHandlersRef.current.mouseup);
          subtitleResizeHandlersRef.current.mouseup = null;
        }
        return;
      }
      
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      const percentage = x / timelineRect.width;
      const time = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
      
      const currentSubtitle = subtitles.find(s => s.id === subtitleId);
      if (!currentSubtitle) return;
      
      if (handle === 'right') {
        // 右端をリサイズ: 終了時間を変更
        const newEndTime = Math.max(subtitleResizeStartTime.current + 0.1, Math.min(totalDuration, time));
        if (newEndTime > currentSubtitle.startTime + 0.1 && newEndTime !== currentSubtitle.endTime) {
          // 重複チェック
          const hasOverlap = subtitles.some(sub => {
            if (sub.id === subtitleId) return false;
            return (currentSubtitle.startTime < sub.endTime) && (newEndTime > sub.startTime);
          });
          if (!hasOverlap) {
            onSubtitleEdit(subtitleId, { endTime: newEndTime });
          }
        }
      } else {
        // 左端をリサイズ: 開始時間を変更
        const newStartTime = Math.max(0, Math.min(subtitleResizeStartEndTime.current - 0.1, time));
        if (newStartTime < currentSubtitle.endTime - 0.1 && newStartTime !== currentSubtitle.startTime) {
          // 重複チェック
          const hasOverlap = subtitles.some(sub => {
            if (sub.id === subtitleId) return false;
            return (newStartTime < sub.endTime) && (currentSubtitle.endTime > sub.startTime);
          });
          if (!hasOverlap) {
            onSubtitleEdit(subtitleId, { startTime: newStartTime });
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setResizingSubtitleId(null);
      setSubtitleResizeHandle(null);
      
      // イベントリスナーを削除
      if (subtitleResizeHandlersRef.current.mousemove) {
        document.removeEventListener('mousemove', subtitleResizeHandlersRef.current.mousemove);
        subtitleResizeHandlersRef.current.mousemove = null;
      }
      if (subtitleResizeHandlersRef.current.mouseup) {
        document.removeEventListener('mouseup', subtitleResizeHandlersRef.current.mouseup);
        subtitleResizeHandlersRef.current.mouseup = null;
      }
    };
    
    // イベントハンドラーをrefに保存
    subtitleResizeHandlersRef.current.mousemove = handleMouseMove;
    subtitleResizeHandlersRef.current.mouseup = handleMouseUp;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 字幕ドラッグ開始
  const handleSubtitleDragStart = (e: React.MouseEvent, subtitleId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // リサイズ中や他の操作中はドラッグを無視
    if (resizingSubtitleId || resizingClipIndex || isDraggingPin) return;
    
    // 既存のイベントリスナーをクリーンアップ
    if (subtitleDragHandlersRef.current.mousemove) {
      document.removeEventListener('mousemove', subtitleDragHandlersRef.current.mousemove);
    }
    if (subtitleDragHandlersRef.current.mouseup) {
      document.removeEventListener('mouseup', subtitleDragHandlersRef.current.mouseup);
    }
    
    const subtitle = subtitles.find(s => s.id === subtitleId);
    if (!subtitle) return;
    
    if (!timelineRef.current || !timelineContainerRef.current) return;
    
    const containerRect = timelineContainerRef.current.getBoundingClientRect();
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
    const percentage = x / timelineRect.width;
    // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
    const extendedDuration = totalDuration + 3;
    const clickTime = percentage * extendedDuration;
    
    setDraggingSubtitleId(subtitleId);
    subtitleDragStartTime.current = subtitle.startTime;
    subtitleDragStartOffset.current = subtitle.startTime - clickTime; // クリック位置からのオフセット（開始時間とクリック位置の差）
    
    // グローバルマウスイベントを設定
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !timelineContainerRef.current) {
        setDraggingSubtitleId(null);
        return;
      }
      
      const containerRect = timelineContainerRef.current.getBoundingClientRect();
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
      const percentage = x / timelineRect.width;
      const time = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
      
      const currentSubtitle = subtitles.find(s => s.id === subtitleId);
      if (!currentSubtitle) return;
      
      // クリック位置からのオフセットを考慮して新しい開始時間を計算
      const newStartTime = Math.max(0, Math.min(totalDuration, time + subtitleDragStartOffset.current));
      // 字幕の長さを保持
      const subtitleDuration = currentSubtitle.endTime - currentSubtitle.startTime;
      const newEndTime = Math.min(totalDuration, newStartTime + subtitleDuration);
      
      // 有効な範囲内の場合のみ更新
      if (newStartTime >= 0 && newEndTime <= totalDuration && newEndTime > newStartTime) {
        // 重複チェック
        const hasOverlap = subtitles.some(sub => {
          if (sub.id === subtitleId) return false;
          return (newStartTime < sub.endTime) && (newEndTime > sub.startTime);
        });
        
        if (!hasOverlap && (newStartTime !== currentSubtitle.startTime || newEndTime !== currentSubtitle.endTime)) {
          onSubtitleEdit(subtitleId, { 
            startTime: newStartTime,
            endTime: newEndTime 
          });
        }
      }
    };
    
    const handleMouseUp = () => {
      setDraggingSubtitleId(null);
      
      // イベントリスナーを削除
      if (subtitleDragHandlersRef.current.mousemove) {
        document.removeEventListener('mousemove', subtitleDragHandlersRef.current.mousemove);
        subtitleDragHandlersRef.current.mousemove = null;
      }
      if (subtitleDragHandlersRef.current.mouseup) {
        document.removeEventListener('mouseup', subtitleDragHandlersRef.current.mouseup);
        subtitleDragHandlersRef.current.mouseup = null;
      }
    };
    
    // イベントハンドラーをrefに保存
    subtitleDragHandlersRef.current.mousemove = handleMouseMove;
    subtitleDragHandlersRef.current.mouseup = handleMouseUp;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // コンポーネントのアンマウント時に字幕関連のイベントリスナーとタイマーをクリーンアップ
  useEffect(() => {
    return () => {
      // 字幕リサイズのイベントリスナーをクリーンアップ
      if (subtitleResizeHandlersRef.current.mousemove) {
        document.removeEventListener('mousemove', subtitleResizeHandlersRef.current.mousemove);
        subtitleResizeHandlersRef.current.mousemove = null;
      }
      if (subtitleResizeHandlersRef.current.mouseup) {
        document.removeEventListener('mouseup', subtitleResizeHandlersRef.current.mouseup);
        subtitleResizeHandlersRef.current.mouseup = null;
      }
      
      // 字幕ドラッグのイベントリスナーをクリーンアップ
      if (subtitleDragHandlersRef.current.mousemove) {
        document.removeEventListener('mousemove', subtitleDragHandlersRef.current.mousemove);
        subtitleDragHandlersRef.current.mousemove = null;
      }
      if (subtitleDragHandlersRef.current.mouseup) {
        document.removeEventListener('mouseup', subtitleDragHandlersRef.current.mouseup);
        subtitleDragHandlersRef.current.mouseup = null;
      }
      
      // タイマーのクリーンアップ
      if (zoomUpdateTimeoutRef.current) {
        clearTimeout(zoomUpdateTimeoutRef.current);
        zoomUpdateTimeoutRef.current = null;
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
      if (zoomAnimationFrameRef.current !== null) {
        cancelAnimationFrame(zoomAnimationFrameRef.current);
        zoomAnimationFrameRef.current = null;
      }
      // 横方向ズームタイマーのクリーンアップ
      if (horizontalZoomTimerRef.current) {
        clearTimeout(horizontalZoomTimerRef.current);
        horizontalZoomTimerRef.current = null;
      }
    };
  }, []); // マウント時のみ実行

  useEffect(() => {
    // ピンのドラッグ中は、タイムラインのグローバルマウスイベントを無視
    if (isDragging && !isDraggingPin) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        // ピンがドラッグ中でないことを再確認（クロージャ内で最新の値を確認）
        if (isDraggingPin) return;
        
        if (timelineRef.current && timelineContainerRef.current) {
          const containerRect = timelineContainerRef.current.getBoundingClientRect();
          const timelineRect = timelineRef.current.getBoundingClientRect();
          // スクロール位置を考慮した相対位置
          const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
          const percentage = x / timelineRect.width;
          // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
      const extendedDuration = totalDuration + 3;
      const time = percentage * extendedDuration;
          const clampedTime = Math.max(0, Math.min(time, totalDuration));
          // 0秒でない場合のみ移動
          if (clampedTime > 0 || time === 0) {
            onTimeClick(clampedTime);
          }
        }
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isDraggingPin, totalDuration, onTimeClick]);

  return (
    <div className="px-6 py-2">
      {/* タイムラインコントロール */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-300">{t('timeline.title')}</span>
        </div>
        <div className="text-sm font-mono text-gray-400">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {/* タイムライン本体（スクロール可能コンテナ） */}
      <div
        ref={timelineContainerRef}
        id={TOUR_TARGETS.timeline}
        className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-[rgba(255,255,255,0.1)] timeline-scroll-container"
        style={{ 
          height: '320px', // 映像、音声、字幕トラックを表示するため固定
        }}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          // 右クリックでズームドラッグを開始（Premiere Proスタイル）
          e.preventDefault();
          setIsZoomDragging(true);
          zoomStartY.current = e.clientY;
          zoomStartZoom.current = zoom;
          
          // マウス位置を基準にズームするため、開始位置を記録
          if (timelineRef.current && timelineContainerRef.current) {
            const containerRect = timelineContainerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const scrollLeft = timelineContainerRef.current.scrollLeft;
            zoomStartY.current = e.clientY;
            zoomStartZoom.current = zoom;
          }
        }}
        onMouseMove={(e) => {
          if (isZoomDragging) {
            e.preventDefault();
            if (!timelineRef.current || !timelineContainerRef.current) return;
            
            // 既存のアニメーションフレームをキャンセル
            if (zoomAnimationFrameRef.current !== null) {
              cancelAnimationFrame(zoomAnimationFrameRef.current);
            }
            
            // requestAnimationFrameを使用してスムーズに更新
            zoomAnimationFrameRef.current = requestAnimationFrame(() => {
              // 上下のドラッグ量に応じてズーム（感度を改善）
              const deltaY = e.clientY - zoomStartY.current;
              const zoomSpeed = 0.005; // 感度を調整（より滑らかに）
              const zoomDelta = -deltaY * zoomSpeed;
              const newZoom = Math.max(0.1, Math.min(5, zoomStartZoom.current + zoomDelta));
              
              // マウス位置を基準にズーム
              const containerRect = timelineContainerRef.current!.getBoundingClientRect();
              const mouseX = e.clientX - containerRect.left;
              const scrollLeft = timelineContainerRef.current!.scrollLeft;
              // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
      const extendedDuration = totalDuration + 3;
      const mouseTime = ((mouseX + scrollLeft) / timelineWidth) * extendedDuration;
              
              // ズーム後のタイムライン幅
              const newTimelineWidth = Math.max(800, totalDuration * 100 * newZoom);
              
              // マウス位置の時間を維持するようにスクロール位置を調整
              const newScrollLeft = (mouseTime / totalDuration) * newTimelineWidth - mouseX;
              
              // デバウンス処理：連続したズーム操作をまとめて処理
              if (zoomUpdateTimeoutRef.current) {
                clearTimeout(zoomUpdateTimeoutRef.current);
              }
              
              zoomUpdateTimeoutRef.current = setTimeout(() => {
                onZoomChange(newZoom);
                
                // スクロール位置を更新
                requestAnimationFrame(() => {
                  if (timelineContainerRef.current) {
                    timelineContainerRef.current.scrollLeft = Math.max(0, newScrollLeft);
                  }
                });
              }, 16); // 約60fps（16ms）で更新
            });
          }
        }}
        onMouseUp={(e) => {
          if (isZoomDragging) {
            e.preventDefault();
            setIsZoomDragging(false);
          }
        }}
        onMouseLeave={(e) => {
          if (isZoomDragging) {
            setIsZoomDragging(false);
          }
        }}
      >
        <div
          ref={timelineRef}
          className={`relative bg-[rgba(255,255,255,0.05)] ${isHorizontalZoomDragging ? 'cursor-ew-resize' : 'cursor-pointer'}`}
          style={{ 
            height: '320px', // 音声トラックと字幕トラック分の高さ
            width: `${timelineWidth}px`,
            minWidth: '100%',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
        {/* 現在位置インジケーター（ドラッグ可能） */}
        {totalDuration > 0 && (
          <div
            data-pin-indicator
            className="absolute top-0 bottom-0 w-1 bg-red-500 z-50 cursor-grab active:cursor-grabbing shadow-lg shadow-red-500/50 hover:w-1.5 transition-all pointer-events-auto"
            style={{
              // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
              left: `${(currentTime / (totalDuration + 3)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
            onMouseDown={(e) => {
              // イベントの伝播を完全に停止
              e.stopPropagation();
              e.preventDefault();
              e.nativeEvent.stopImmediatePropagation();
              
              // 既存のイベントリスナーをクリーンアップ
              if (pinDragHandlersRef.current.mousemove) {
                document.removeEventListener('mousemove', pinDragHandlersRef.current.mousemove, true);
              }
              if (pinDragHandlersRef.current.mouseup) {
                document.removeEventListener('mouseup', pinDragHandlersRef.current.mouseup, true);
              }
              
              setIsDraggingPin(true);
              isDraggingPinRef.current = true; // refも更新
              
              // ドラッグ開始時にも現在位置のクリップを選択
              const selectClipAtTime = (time: number) => {
                for (let i = clips.length - 1; i >= 0; i--) {
                  const startTime = clipStartTimes[i] ?? 0;
                  const clipDuration = clips[i]?.duration || 3;
                  const endTime = startTime + clipDuration;
                  
                  if (time >= startTime && time < endTime) {
                    // このクリップの範囲内にある
                    if (!selectedClipIndices.includes(i)) {
                      onClipSelect(i);
                    }
                    break;
                  }
                }
              };
              
              // 現在位置のクリップを選択
              selectClipAtTime(currentTime);
              
              const handleMouseMove = (e: MouseEvent) => {
                // ピンのドラッグ中であることを再確認（refを使用して最新の値を取得）
                if (!isDraggingPinRef.current) {
                  // ドラッグが終了した場合、クリーンアップ
                  if (pinDragHandlersRef.current.mousemove) {
                    document.removeEventListener('mousemove', pinDragHandlersRef.current.mousemove, true);
                    pinDragHandlersRef.current.mousemove = null;
                  }
                  if (pinDragHandlersRef.current.mouseup) {
                    document.removeEventListener('mouseup', pinDragHandlersRef.current.mouseup, true);
                    pinDragHandlersRef.current.mouseup = null;
                  }
                  return;
                }
                
                if (!timelineRef.current || !timelineContainerRef.current) return;
                const containerRect = timelineContainerRef.current.getBoundingClientRect();
                const timelineRect = timelineRef.current.getBoundingClientRect();
                // スクロール位置を考慮した相対位置
                const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
                const percentage = x / timelineRect.width;
                const newTime = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
                
                // 時間が有効な場合のみ移動（0秒でない、または意図的に0秒の場合）
                if (newTime >= 0 && newTime <= totalDuration) {
                  onTimeClick(newTime, true); // ピンドラッグ中であることを伝える
                  
                  // ピンの位置にあるクリップを自動選択
                  selectClipAtTime(newTime);
                }
              };
              
              const handleMouseUp = () => {
                setIsDraggingPin(false);
                isDraggingPinRef.current = false; // refも更新
                
                // イベントリスナーを削除
                if (pinDragHandlersRef.current.mousemove) {
                  document.removeEventListener('mousemove', pinDragHandlersRef.current.mousemove, true);
                  pinDragHandlersRef.current.mousemove = null;
                }
                if (pinDragHandlersRef.current.mouseup) {
                  document.removeEventListener('mouseup', pinDragHandlersRef.current.mouseup, true);
                  pinDragHandlersRef.current.mouseup = null;
                }
              };
              
              // イベントハンドラーをrefに保存
              pinDragHandlersRef.current.mousemove = handleMouseMove;
              pinDragHandlersRef.current.mouseup = handleMouseUp;
              
              // グローバルイベントリスナーを追加（キャプチャフェーズで追加して優先度を上げる）
              document.addEventListener('mousemove', handleMouseMove, true);
              document.addEventListener('mouseup', handleMouseUp, true);
            }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500 pointer-events-none" />
          </div>
        )}

        {/* 時間目盛り */}
        <div className="absolute inset-0 flex items-center">
          {/* タイムラインの表示範囲を3秒延長しているため、totalDuration + 3まで表示 */}
          {Array.from({ length: Math.ceil(totalDuration) + 4 }).map((_, i) => {
            const time = i;
            const extendedDuration = totalDuration + 3;
            const percent = extendedDuration > 0 ? (time / extendedDuration) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-[rgba(255,255,255,0.1)]"
                style={{ left: `${percent}%` }}
              >
                <div 
                  className="absolute top-0 left-0 text-xs text-gray-500 mt-1 -translate-x-1/2 cursor-pointer hover:text-gray-300 hover:font-semibold transition-all px-1 py-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimeClick(time);
                  }}
                  title={t('timeline.seekToTimeTooltip', { time: formatTime(time) })}
                >
                  {formatTime(time)}
                </div>
              </div>
            );
          })}
        </div>

        {/* 字幕トラック */}
        <div className="absolute left-0 right-0 border-b border-[rgba(255,255,255,0.1)] top-0" style={{ height: '80px' }}>
          <div className="absolute top-2 left-2 text-xs font-semibold text-gray-400 z-30">
            <span>{t('timeline.subtitleLabel')}</span>
          </div>
          
          {/* 字幕バー */}
          {subtitles.length > 0 ? (
            subtitles.map((subtitle) => {
            if (totalDuration === 0) return null;
            
            // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
            const extendedDuration = totalDuration + 3;
            const startPercent = extendedDuration > 0 ? (subtitle.startTime / extendedDuration) * 100 : 0;
            const duration = subtitle.endTime - subtitle.startTime;
            const widthPercent = extendedDuration > 0 ? (duration / extendedDuration) * 100 : 0;
                const isSelected = selectedSubtitleIds.includes(subtitle.id);
            
            if (isNaN(startPercent) || isNaN(widthPercent) || startPercent < 0 || widthPercent <= 0) {
              return null;
            }
            
            const clampedStartPercent = Math.max(0, Math.min(100, startPercent));
            const clampedWidthPercent = Math.max(0, Math.min(100 - clampedStartPercent, widthPercent));
            
            const isResizing = resizingSubtitleId === subtitle.id;
            const isDragging = draggingSubtitleId === subtitle.id;
            
            return (
              <div
                key={subtitle.id}
                className={`subtitle-item absolute top-8 bottom-2 rounded-lg transition-all group ${
                  isResizing || isDragging
                    ? 'cursor-ew-resize'
                    : 'cursor-move'
                } ${
                  isSelected
                    ? 'bg-gradient-to-r from-yellow-500/60 to-orange-500/60 border-2 border-yellow-400 shadow-lg shadow-yellow-500/50 z-10'
                    : 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-400/50 hover:from-yellow-500/40 hover:to-orange-500/40 z-0'
                }`}
                style={{
                  left: `${clampedStartPercent}%`,
                  width: `${clampedWidthPercent}%`,
                }}
                onClick={(e) => {
                  // リサイズハンドルをクリックした場合は選択しない
                  if ((e.target as HTMLElement).classList.contains('subtitle-resize-handle')) {
                    return;
                  }
                  e.stopPropagation();
                  onSubtitleSelect(subtitle.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  // ダブルクリック: 字幕編集（詳細スライドを表示）
                  if (onSubtitleDoubleClick) {
                    onSubtitleDoubleClick(subtitle.id, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
                  } else {
                    // フォールバック: 選択のみ
                    onSubtitleSelect(subtitle.id, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
                  }
                }}
                onMouseDown={(e) => {
                  // リサイズハンドルをクリックした場合はドラッグを開始しない
                  if ((e.target as HTMLElement).classList.contains('subtitle-resize-handle')) {
                    return;
                  }
                  handleSubtitleDragStart(e, subtitle.id);
                }}
              >
                {/* リサイズハンドル（選択時のみ表示） */}
                {isSelected && (
                  <>
                    <div
                      className="subtitle-resize-handle absolute left-0 top-0 bottom-0 w-2 bg-yellow-400/70 cursor-ew-resize hover:bg-yellow-400 hover:w-3 transition-all z-20 rounded-l-lg"
                      onMouseDown={(e) => handleSubtitleResizeStart(e, subtitle.id, 'left')}
                      title={t('timeline.subtitleResizeLeftTooltip')}
                    />
                    <div
                      className="subtitle-resize-handle absolute right-0 top-0 bottom-0 w-2 bg-yellow-400/70 cursor-ew-resize hover:bg-yellow-400 hover:w-3 transition-all z-20 rounded-r-lg"
                      onMouseDown={(e) => handleSubtitleResizeStart(e, subtitle.id, 'right')}
                      title={t('timeline.subtitleResizeRightTooltip')}
                    />
                  </>
                )}
                <div className="p-1 h-full flex flex-col justify-center pointer-events-none">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate flex-1 text-yellow-100">
                      {subtitle.text || t('timeline.subtitleFallbackLabel')}
                    </span>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubtitleDelete(subtitle.id);
                        }}
                        className="ml-1 p-1 bg-red-500/80 hover:bg-red-500 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-yellow-200/60 mt-0.5">
                    {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
                  </div>
                </div>
              </div>
            );
            })
          ) : (
            <div 
              className="absolute top-8 bottom-2 left-0 right-0 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSubtitleAdd();
              }}
            >
              <span className="text-xs text-gray-500">{t('timeline.subtitleEmptyTrack')}</span>
            </div>
          )}
        </div>

        {/* 映像トラック */}
        <div className="absolute top-20 left-0 right-0 h-24 border-b border-[rgba(255,255,255,0.1)]">
          <div className="absolute top-2 left-2 text-xs font-semibold text-gray-400 z-30">
            {t('timeline.videoLabel')}
          </div>
          
          {/* クリップバー */}
          {clips.map((clip, index) => {
          if (totalDuration === 0) return null;
          
          const startTime = clipStartTimes[index] ?? 0;
          const clipDuration = clip.duration || 3;
          // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
          const extendedDuration = totalDuration + 3;
          const startPercent = extendedDuration > 0 ? (startTime / extendedDuration) * 100 : 0;
          const widthPercent = extendedDuration > 0 ? (clipDuration / extendedDuration) * 100 : 0;
          const isSelected = selectedClipIndices.includes(index);
          
          if (isNaN(startPercent) || isNaN(widthPercent) || startPercent < 0 || widthPercent <= 0) {
            return null;
          }
          
          const clampedStartPercent = Math.max(0, Math.min(100, startPercent));
          const clampedWidthPercent = Math.max(0, Math.min(100 - clampedStartPercent, widthPercent));
          
          const isDraggingThis = draggedClipIndex === index;
          const isDragOver = dragOverIndex === index;
          
          return (
            <div
              key={index}
              draggable
              onDragStart={(e) => {
                setDraggedClipIndex(index);
                setDragOverIndex(null);
                dragStartPos.current = { x: e.clientX, y: e.clientY };
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
                // ドラッグ中の視覚的フィードバック
                if (e.dataTransfer.setDragImage) {
                  const dragImage = document.createElement('div');
                  dragImage.style.position = 'absolute';
                  dragImage.style.top = '-1000px';
                  dragImage.innerHTML = clip.plotName || t('timeline.sceneDefaultName', { number: index + 1 });
                  document.body.appendChild(dragImage);
                  e.dataTransfer.setDragImage(dragImage, 0, 0);
                  setTimeout(() => document.body.removeChild(dragImage), 0);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                
                if (draggedClipIndex === null || draggedClipIndex === index) return;
                
                // ドロップ位置を計算
                if (timelineRef.current && timelineContainerRef.current) {
                  const containerRect = timelineContainerRef.current.getBoundingClientRect();
                  const timelineRect = timelineRef.current.getBoundingClientRect();
                  // スクロール位置を考慮した相対位置
                  const x = e.clientX - containerRect.left + timelineContainerRef.current.scrollLeft;
                  const percentage = x / timelineRect.width;
                  // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
      const extendedDuration = totalDuration + 3;
      const time = percentage * extendedDuration;
                  
                  // どのクリップの前にドロップするかを判定
                  let targetIndex = index;
                  const clipCenter = startTime + clipDuration / 2;
                  
                  if (time < clipCenter) {
                    // クリップの前半にドロップ → このクリップの前に挿入
                    targetIndex = index;
                  } else {
                    // クリップの後半にドロップ → このクリップの後に挿入
                    targetIndex = index + 1;
                  }
                  
                  // ドラッグ元のクリップの場合は調整
                  if (draggedClipIndex < targetIndex) {
                    targetIndex -= 1;
                  }
                  
                  if (targetIndex !== dragOverIndex && targetIndex >= 0 && targetIndex <= clips.length) {
                    setDragOverIndex(targetIndex);
                  }
                }
              }}
              onDragLeave={(e) => {
                // 子要素への移動は無視
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (draggedClipIndex === null) return;
                
                const dropIndex = dragOverIndex !== null ? dragOverIndex : index;
                
                if (draggedClipIndex !== dropIndex) {
                  onClipReorder(draggedClipIndex, dropIndex);
                }
                
                setDraggedClipIndex(null);
                setDragOverIndex(null);
                dragStartPos.current = null;
              }}
              onDragEnd={() => {
                setDraggedClipIndex(null);
                setDragOverIndex(null);
                dragStartPos.current = null;
              }}
              className={`clip-item absolute top-8 bottom-2 rounded-lg transition-all group ${
                isDraggingThis
                  ? 'opacity-50 cursor-grabbing z-50'
                  : isDragOver
                  ? 'border-2 border-yellow-400 border-dashed z-40'
                  : isSelected
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-2 border-indigo-300 shadow-lg shadow-indigo-500/50 z-10 cursor-move'
                  : 'bg-gradient-to-r from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.3)] hover:from-[rgba(255,255,255,0.3)] hover:to-[rgba(255,255,255,0.25)] z-0 cursor-move'
              }`}
              style={{
                left: `${clampedStartPercent}%`,
                width: `${clampedWidthPercent}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                
                // クリップを選択（ピンは移動させない）
                onClipSelect(index, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // クリップを選択
                onClipSelect(index, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
                
                // プロパティパネルを表示
                if (onClipDoubleClick) {
                  onClipDoubleClick(index, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
                }
              }}
            >
              {/* クリップ情報 */}
              <div className="p-2 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold truncate flex-1">
                    {clip.plotName || t('timeline.sceneDefaultName', { number: index + 1 })}
                  </span>
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClipDelete(index);
                      }}
                      className="ml-2 p-1 bg-red-500/80 hover:bg-red-500 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {clip.text && (
                  <div className="text-xs text-gray-300 line-clamp-1 mt-1">
                    {clip.text}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-auto">
                  {formatTime(clipDuration)}
                </div>
              </div>

              {/* リサイズハンドル（選択時のみ） */}
              {isSelected && (
                <>
                  <div
                    className="resize-handle absolute left-0 top-0 bottom-0 w-2 bg-white/50 cursor-ew-resize hover:bg-white hover:w-3 transition-all z-20"
                    onMouseDown={(e) => handleResizeStart(e, index, 'left')}
                    title={t('timeline.clipResizeLeftTooltip')}
                  />
                  <div
                    className="resize-handle absolute right-0 top-0 bottom-0 w-2 bg-white/50 cursor-ew-resize hover:bg-white hover:w-3 transition-all z-20"
                    onMouseDown={(e) => handleResizeStart(e, index, 'right')}
                    title={t('timeline.clipResizeRightTooltip')}
                  />
                </>
              )}
            </div>
          );
        })}
        
        {/* ＋シーン追加ボタン（最後のシーケンスの隣） */}
        {clips.length > 0 && totalDuration > 0 && (
          <button
            onClick={onClipAdd}
            disabled={isAddingScene}
            className={`absolute top-8 bottom-2 rounded-lg border-2 border-dashed transition-all flex items-center justify-center z-10 ${
              isAddingScene
                ? 'border-indigo-400/60 text-indigo-300 bg-indigo-400/10 cursor-wait'
                : 'border-[rgba(255,255,255,0.3)] text-gray-400 hover:border-indigo-400 hover:text-indigo-400 hover:bg-indigo-400/10'
            }`}
            style={{
              left: `${(totalDuration / (totalDuration + 3)) * 100}%`,
              width: `${(3 / (totalDuration + 3)) * 100}%`,
              minWidth: '80px',
            }}
            title={t('timeline.addSceneTooltip')}
          >
            {isAddingScene ? (
              <div className="flex flex-col items-center gap-1">
                <span className="h-4 w-4 rounded-full border-2 border-indigo-300/40 border-t-indigo-300 animate-spin" />
                <span className="text-xs">{t('timeline.addingScene')}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-bold">+</span>
                <span className="text-xs">{t('timeline.addSceneShort')}</span>
              </div>
            )}
          </button>
        )}
        
        {/* ドロップ位置インジケーター */}
        {dragOverIndex !== null && draggedClipIndex !== null && (
          <div
            className="absolute top-8 bottom-2 w-1 bg-yellow-400 z-50 pointer-events-none shadow-lg"
            style={{
              left: dragOverIndex === 0
                ? '0%'
                : dragOverIndex < clips.length
                ? `${(clipStartTimes[dragOverIndex] / totalDuration) * 100}%`
                : '100%',
            }}
          />
        )}

        {/* 空状態のCTA: クリップが1つもないときに表示 */}
        {clips.length === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isAddingScene) onClipAdd();
            }}
            disabled={isAddingScene}
            className={`absolute top-8 bottom-2 left-2 right-2 rounded-lg border-2 border-dashed flex items-center justify-center transition-all z-10 ${
              isAddingScene
                ? 'border-indigo-400/60 text-indigo-300 bg-indigo-400/10 cursor-wait'
                : 'border-[rgba(255,255,255,0.2)] text-gray-400 bg-[rgba(255,255,255,0.03)] hover:border-indigo-400 hover:text-indigo-400 hover:bg-indigo-400/10 cursor-pointer'
            }`}
          >
            {isAddingScene ? (
              <div className="flex flex-col items-center gap-1">
                <span className="h-4 w-4 rounded-full border-2 border-indigo-300/40 border-t-indigo-300 animate-spin" />
                <span className="text-xs">{t('timeline.addingScene')}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-2xl font-bold leading-none">+</span>
                <span className="text-sm font-medium">{t('timeline.emptyClipsCta')}</span>
                <span className="text-[10px] text-gray-500">{t('timeline.emptyClipsHint')}</span>
              </div>
            )}
          </button>
        )}
        </div>

        {/* オーディオトラック（デフォルトで表示） */}
        <div className="absolute top-44 left-0 right-0 h-24 border-t border-[rgba(255,255,255,0.1)]">
          <div className="absolute top-2 left-2 text-xs font-semibold text-gray-400 z-30">
            {t('timeline.audioLabel')}
          </div>
          
          {/* BGMバー */}
          {bgmUrl ? (
            <div
              className="absolute top-8 bottom-0 left-0 right-0 rounded-lg transition-all bg-gradient-to-r from-pink-500/40 to-purple-500/40 border border-pink-400/50 hover:from-pink-500/50 hover:to-purple-500/50 z-0 cursor-pointer"
              style={{
                width: '100%',
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (onBgmTrackClick) {
                  onBgmTrackClick();
                }
              }}
              title={t('timeline.bgmTrackTooltip')}
            >
              <div className="p-2 h-full flex flex-col justify-between pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold truncate flex-1 text-pink-200">
                    {t('timeline.bgmTrackName')}
                  </span>
                  <div className="text-xs text-pink-300/80">
                    {t('timeline.bgmVolumeLabel', { percent: Math.round(bgmVolume * 100) })}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-auto">
                  {formatTime(totalDuration)}
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="absolute top-8 bottom-0 left-0 right-0 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (onBgmTrackClick) {
                  onBgmTrackClick();
                }
              }}
            >
              <span className="text-xs text-gray-500">{t('timeline.musicEmptyTrack')}</span>
            </div>
          )}
        </div>

        
        {/* 現在位置インジケーター */}
        {totalDuration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 z-20 pointer-events-none shadow-lg"
            style={{
              // タイムラインの表示範囲を3秒延長しているため、totalDuration + 3を基準に計算
              left: `${Math.max(0, Math.min(100, (currentTime / (totalDuration + 3)) * 100))}%`,
            }}
          >
            <div className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>
          </div>
        )}
        
        {/* ドラッグボックス選択機能は廃止（視覚的表示も削除） */}
        </div>
      </div>

    </div>
  );
}
