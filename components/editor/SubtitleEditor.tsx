'use client';

// Properties panel for a single subtitle: text, position, font, size, color,
// background, shadow, border, and start/end timing. Pure presentational —
// state lives in the parent VideoEditor and is updated via onUpdate.

import { useTranslations } from 'next-intl';
import type { Subtitle } from '@/src/types';
import { SUBTITLE_PRESETS, AVAILABLE_FONTS, applyPresetToSubtitle } from '@/lib/subtitlePresets';

export interface SubtitleEditorProps {
  subtitle: Subtitle;
  onUpdate: (updates: Partial<Subtitle>) => void;
  onDelete: () => void;
  totalDuration: number;
  currentTime: number;
  onTimeSeek: (time: number) => void;
}

export function SubtitleEditor({
  subtitle,
  onUpdate,
  onDelete,
  totalDuration,
  currentTime,
  onTimeSeek,
}: SubtitleEditorProps) {
  const t = useTranslations('editor');
  const formatTime = (seconds: number) => {
    const totalMilliseconds = Math.floor(seconds * 1000);
    const mins = Math.floor(totalMilliseconds / (60 * 1000));
    const secs = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const millis = totalMilliseconds % 1000;
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const hasTextShadow = !!subtitle.textShadow && subtitle.textShadow !== 'none';
  const hasBorder = !!subtitle.borderColor && (subtitle.borderWidth || 0) > 0;
  const hasBackground = !!subtitle.backgroundColor && subtitle.backgroundColor !== 'transparent';

  return (
    <div className="space-y-6">
      {/* プリセット選択 */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-3">{t('subtitleEditor.presetsLabel')}</label>
        <div className="grid grid-cols-2 gap-2">
          {SUBTITLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                const newSubtitle = applyPresetToSubtitle(subtitle, preset);
                onUpdate({
                  fontSize: newSubtitle.fontSize,
                  color: newSubtitle.color,
                  backgroundColor: newSubtitle.backgroundColor,
                  fontFamily: newSubtitle.fontFamily,
                  textShadow: newSubtitle.textShadow,
                  borderColor: newSubtitle.borderColor,
                  borderWidth: newSubtitle.borderWidth,
                  letterSpacing: newSubtitle.letterSpacing,
                  lineHeight: newSubtitle.lineHeight,
                  textTransform: newSubtitle.textTransform,
                });
              }}
              className="px-3 py-2.5 bg-gradient-to-br from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.03)] hover:from-[rgba(255,255,255,0.15)] hover:to-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.3)] rounded-xl transition-all text-left group shadow-sm"
              title={preset.description}
            >
              <div className="text-xs font-bold text-gray-200 group-hover:text-white transition-colors mb-0.5">{preset.name}</div>
              <div className="text-[10px] text-gray-500 group-hover:text-gray-400 line-clamp-2 leading-tight">{preset.description}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">{t('subtitleEditor.presetsNote')}</p>
      </div>

      {/* テキスト編集 */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">{t('subtitleEditor.textLabel')}</label>
        <textarea
          value={subtitle.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
          placeholder={t('subtitleEditor.textPlaceholder')}
        />
      </div>

      {/* 位置設定（上下） */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          {t('subtitleEditor.positionYLabel', { value: (() => {
            const currentY = subtitle.positionYPercent ?? (subtitle.position === 'top' ? 10 : subtitle.position === 'center' ? 50 : 90);
            return `${currentY}%`;
          })() })}
        </label>
        <div className="flex gap-2 mb-2">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => {
                const positionYPercent = pos === 'top' ? 10 : pos === 'center' ? 50 : 90;
                onUpdate({ position: pos, positionYPercent });
              }}
              className={`flex-1 px-4 py-2 rounded-lg transition-all ${
                (subtitle.position === pos) || (subtitle.positionYPercent !== undefined && (
                  (pos === 'top' && subtitle.positionYPercent === 10) ||
                  (pos === 'center' && subtitle.positionYPercent === 50) ||
                  (pos === 'bottom' && subtitle.positionYPercent === 90)
                ))
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                  : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.15)]'
              }`}
            >
              {pos === 'top' ? t('subtitleEditor.positionTop') : pos === 'center' ? t('subtitleEditor.positionCenter') : t('subtitleEditor.positionBottom')}
            </button>
          ))}
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="1"
          value={subtitle.positionYPercent ?? (subtitle.position === 'top' ? 10 : subtitle.position === 'center' ? 50 : 90)}
          onChange={(e) => {
            const positionYPercent = Math.max(10, Math.min(90, parseInt(e.target.value)));
            onUpdate({ positionYPercent });
          }}
          className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t('subtitleEditor.positionYRangeMin')}</span>
          <span>{t('subtitleEditor.positionYRangeMax')}</span>
        </div>
      </div>

      {/* 配置設定（左右） */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          {t('subtitleEditor.positionXLabel', { value: (() => {
            const currentX = subtitle.positionXPercent ?? (subtitle.align === 'left' ? 10 : subtitle.align === 'center' ? 50 : 90);
            return `${currentX}%`;
          })() })}
        </label>
        <div className="flex gap-2 mb-2">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => {
                const positionXPercent = align === 'left' ? 10 : align === 'center' ? 50 : 90;
                onUpdate({ align, positionXPercent });
              }}
              className={`flex-1 px-4 py-2 rounded-lg transition-all ${
                (subtitle.align === align) || (subtitle.positionXPercent !== undefined && (
                  (align === 'left' && subtitle.positionXPercent === 10) ||
                  (align === 'center' && subtitle.positionXPercent === 50) ||
                  (align === 'right' && subtitle.positionXPercent === 90)
                ))
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                  : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(255,255,255,0.15)]'
              }`}
            >
              {align === 'left' ? t('subtitleEditor.alignLeft') : align === 'center' ? t('subtitleEditor.alignCenter') : t('subtitleEditor.alignRight')}
            </button>
          ))}
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="1"
          value={subtitle.positionXPercent ?? (subtitle.align === 'left' ? 10 : subtitle.align === 'center' ? 50 : 90)}
          onChange={(e) => {
            const positionXPercent = Math.max(10, Math.min(90, parseInt(e.target.value)));
            onUpdate({ positionXPercent });
          }}
          className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t('subtitleEditor.positionXRangeMin')}</span>
          <span>{t('subtitleEditor.positionXRangeMax')}</span>
        </div>
      </div>

      {/* フォント選択 */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">{t('subtitleEditor.fontLabel')}</label>
        <select
          value={subtitle.fontFamily || 'Noto Sans JP'}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-4 py-3 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent cursor-pointer"
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>
      </div>

      {/* フォントサイズ */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          {t('subtitleEditor.fontSizeLabel', { value: subtitle.fontSizePercent ?? (subtitle.fontSize && subtitle.fontSize <= 100 ? subtitle.fontSize : 5) })}
        </label>
        <input
          type="range"
          min="1"
          max="60"
          value={subtitle.fontSizePercent ?? (subtitle.fontSize && subtitle.fontSize <= 100 ? subtitle.fontSize : 5)}
          onChange={(e) => {
            const fontSizePercent = parseInt(e.target.value);
            if (fontSizePercent >= 1 && fontSizePercent <= 60) {
              onUpdate({ fontSizePercent });
            }
          }}
          className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1%</span>
          <span>60%</span>
        </div>
      </div>

      {/* 文字色 */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">{t('subtitleEditor.textColorLabel')}</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={subtitle.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-16 h-10 rounded-lg cursor-pointer border border-[rgba(255,255,255,0.2)]"
          />
          <input
            type="text"
            value={subtitle.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="flex-1 px-4 py-2.5 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            placeholder={t('subtitleEditor.textColorPlaceholder')}
          />
        </div>
      </div>

      {/* 背景色 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-300">{t('subtitleEditor.backgroundColorLabel')}</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasBackground}
              onChange={(e) => {
                if (e.target.checked) onUpdate({ backgroundColor: 'rgba(0, 0, 0, 0.7)' });
                else onUpdate({ backgroundColor: undefined });
              }}
              className="w-4 h-4 rounded border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] checked:bg-yellow-500 checked:border-yellow-500 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-0 transition-colors cursor-pointer"
            />
            <span className="text-xs text-gray-400">{t('subtitleEditor.enabledToggle')}</span>
          </label>
        </div>
        {hasBackground && (
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={subtitle.backgroundColor || '#000000'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="w-16 h-10 rounded-lg cursor-pointer border border-[rgba(255,255,255,0.2)]"
            />
            <input
              type="text"
              value={subtitle.backgroundColor || ''}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value || undefined })}
              className="flex-1 px-4 py-2.5 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder={t('subtitleEditor.backgroundColorPlaceholder')}
            />
          </div>
        )}
      </div>

      {/* テキストシャドウ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-300">{t('subtitleEditor.textShadowLabel')}</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasTextShadow}
              onChange={(e) => {
                if (e.target.checked) onUpdate({ textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)' });
                else onUpdate({ textShadow: undefined });
              }}
              className="w-4 h-4 rounded border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] checked:bg-yellow-500 checked:border-yellow-500 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-0 transition-colors cursor-pointer"
            />
            <span className="text-xs text-gray-400">{t('subtitleEditor.enabledToggle')}</span>
          </label>
        </div>
        {hasTextShadow && (
          <div className="space-y-2">
            <input
              type="text"
              value={subtitle.textShadow || ''}
              onChange={(e) => onUpdate({ textShadow: e.target.value || undefined })}
              className="w-full px-4 py-2.5 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
              placeholder={t('subtitleEditor.textShadowPlaceholder')}
            />
            <div className="text-[10px] text-gray-500 space-y-1">
              <div>{t('subtitleEditor.textShadowFormat')} <span className="bg-[rgba(0,0,0,0.3)] px-1.5 py-0.5 rounded font-mono">offsetX offsetY blur color</span></div>
              <div>{t('subtitleEditor.textShadowExample')} <span className="bg-[rgba(0,0,0,0.3)] px-1.5 py-0.5 rounded font-mono">0 2px 10px rgba(0, 0, 0, 0.8)</span></div>
            </div>
          </div>
        )}
      </div>

      {/* 文字の縁取り */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-300">{t('subtitleEditor.borderLabel')}</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasBorder}
              onChange={(e) => {
                if (e.target.checked) onUpdate({ borderColor: '#000000', borderWidth: 2 });
                else onUpdate({ borderColor: undefined, borderWidth: 0 });
              }}
              className="w-4 h-4 rounded border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] checked:bg-yellow-500 checked:border-yellow-500 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-0 transition-colors cursor-pointer"
            />
            <span className="text-xs text-gray-400">{t('subtitleEditor.enabledToggle')}</span>
          </label>
        </div>
        {hasBorder && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={subtitle.borderColor || '#000000'}
                onChange={(e) => onUpdate({ borderColor: e.target.value })}
                className="w-16 h-10 rounded-lg cursor-pointer border border-[rgba(255,255,255,0.2)]"
              />
              <input
                type="text"
                value={subtitle.borderColor || ''}
                onChange={(e) => onUpdate({ borderColor: e.target.value || undefined })}
                className="flex-1 px-4 py-2.5 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder={t('subtitleEditor.borderColorPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                {t('subtitleEditor.borderWidthLabel', { value: subtitle.borderWidth || 0 })}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={subtitle.borderWidth || 0}
                onChange={(e) => onUpdate({ borderWidth: parseInt(e.target.value) })}
                className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0px</span>
                <span>10px</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 表示時間 */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">{t('subtitleEditor.displayTimeLabel')}</label>
        <div className="space-y-2">
          {/* 開始時間 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">{t('subtitleEditor.startTimeLabel')}</span>
            <div className="flex-1 flex items-center gap-1">
              <button
                onClick={() => onTimeSeek(subtitle.startTime)}
                className="px-2 py-1.5 text-xs bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] rounded-lg transition-colors font-mono"
                title={t('subtitleEditor.seekToStartTooltip')}
              >
                {formatTime(subtitle.startTime)}
              </button>
              <button
                onClick={() => onUpdate({ startTime: currentTime })}
                className="px-2 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors"
                title={t('subtitleEditor.setStartToCurrentTooltip')}
              >
                ⏱
              </button>
              <div className="flex-1 flex gap-1">
                <button
                  onClick={() => onUpdate({ startTime: Math.max(0, subtitle.startTime - 0.1) })}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                  title={t('subtitleEditor.nudgeBack01Tooltip')}
                >
                  −0.1
                </button>
                <button
                  onClick={() => onUpdate({ startTime: Math.min(subtitle.endTime - 0.1, subtitle.startTime + 0.1) })}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                  title={t('subtitleEditor.nudgeForward01Tooltip')}
                >
                  +0.1
                </button>
              </div>
            </div>
          </div>

          {/* 終了時間 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">{t('subtitleEditor.endTimeLabel')}</span>
            <div className="flex-1 flex items-center gap-1">
              <button
                onClick={() => onTimeSeek(subtitle.endTime)}
                className="px-2 py-1.5 text-xs bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] rounded-lg transition-colors font-mono"
                title={t('subtitleEditor.seekToEndTooltip')}
              >
                {formatTime(subtitle.endTime)}
              </button>
              <button
                onClick={() => onUpdate({ endTime: Math.min(totalDuration, currentTime) })}
                className="px-2 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors"
                title={t('subtitleEditor.setEndToCurrentTooltip')}
              >
                ⏱
              </button>
              <div className="flex-1 flex gap-1">
                <button
                  onClick={() => onUpdate({ endTime: Math.max(subtitle.startTime + 0.1, subtitle.endTime - 0.1) })}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                  title={t('subtitleEditor.nudgeBack01Tooltip')}
                >
                  −0.1
                </button>
                <button
                  onClick={() => onUpdate({ endTime: Math.min(totalDuration, subtitle.endTime + 0.1) })}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
                  title={t('subtitleEditor.nudgeForward01Tooltip')}
                >
                  +0.1
                </button>
              </div>
            </div>
          </div>

          {/* 表示時間の長さ */}
          <div className="flex items-center gap-2 pt-1 border-t border-[rgba(255,255,255,0.1)]">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">{t('subtitleEditor.durationLabel')}</span>
            <span className="text-xs text-gray-300 font-mono">{formatTime(subtitle.endTime - subtitle.startTime)}</span>
          </div>
        </div>
      </div>

      {/* 削除ボタン */}
      <button
        onClick={onDelete}
        className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-xl transition-all font-semibold"
      >
        {t('subtitleEditor.deleteSubtitle')}
      </button>
    </div>
  );
}
