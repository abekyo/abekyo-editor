import { debug, info, warn, logError } from '../lib/utils/logger.client';

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  useVideoConfig,
  Sequence,
  staticFile,
} from 'remotion';
import { ProductVideoProps, TransitionType } from './types';
import { Subtitle } from './Subtitle';
import { TimeBasedSubtitle } from './TimeBasedSubtitle';
import { ClipTransition } from './Transitions';
import { ImageWithEffects } from './ImageEffects';
import { LayoutTemplate, LayoutTemplate as LayoutTemplateType } from './LayoutTemplates';
export const ProductVideo: React.FC<ProductVideoProps> = ({ clips, productName, tempo = 1.0, audioEnabled = true, subtitles = [], bgmUrl = null, bgmVolume = 0.3, bgmStartTime = 0, bgmEndTime = null, subtitleAudioVolume = 0.8 }) => {
  // デバッグログを追加してクリップの変更を確認
  debug('[ProductVideo] ========== Component Rendering ==========');
  debug('[ProductVideo] Clips count:', clips.length);
  debug('[ProductVideo] Clips details:', clips.map((c, i) => ({
    index: i,
    plotName: c.plotName,
    duration: c.duration,
    imageEffect: c.imageEffect,
    audioStartTime: c.audioStartTime,
    textPreview: c.text?.substring(0, 30) || '',
    hasImage: !!c.imageUrl,
    hasAudio: !!c.audioUrl,
  })));
  debug('[ProductVideo] ================================================');
  
  // Hooks must run unconditionally before any early return.
  const { fps } = useVideoConfig();

  if (!clips || clips.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'white', fontSize: 24 }}>No clips</p>
      </AbsoluteFill>
    );
  }
  
  // tempoのバリデーション（0やNaNを防ぐ）
  const safeTempo = tempo && !isNaN(tempo) && tempo > 0 ? tempo : 1.0;
  
  // fpsのバリデーション
  const safeFps = fps && !isNaN(fps) && fps > 0 ? fps : 30;
  
  // 控えめなレイアウト（classic、modern、minimalをローテーション）
  const layoutTemplates: LayoutTemplateType[] = ['classic', 'modern', 'minimal', 'classic', 'modern'];
  
  // 最初から開始（オープニングなし）
  let currentTime = 0;
  // 音声の1.2倍速再生（音声の再生速度のみを上げる、シーンの表示時間はclip.durationに基づく）
  const audioPlaybackRate = 1.2;
  
  const sequences = clips.map((clip, index) => {
    // クリップの実際のdurationを使用（デフォルトは3秒）
    const clipDuration = clip.duration || 3.0;
    // Math.ceilを使用して、Root.tsxとVideoEditor.tsxの計算と一致させる
    const startFrame = Math.ceil(currentTime * safeFps);
    const durationInFrames = Math.max(1, Math.ceil(clipDuration * safeFps));
    // 次のクリップの開始時間を正確に計算（clip.durationに基づいて加算）
    currentTime += clipDuration;
    
    // トランジションタイプを選択
    // clip.transitionTypeが明示的に設定されている場合はそれを使用
    // 未設定の場合は'none'（トランジションなし）
    const transitionType: TransitionType = clip.transitionType || 'none';
    
    // レイアウトテンプレートを選択（控えめなレイアウト）
    const layoutTemplate = layoutTemplates[index % layoutTemplates.length];
    
    // トランジション時間（クリップ設定またはデフォルト）
    // transitionTypeが'none'の場合でも、デフォルト値を設定（エラー防止）
    const clipTransitionDuration = clip.transitionDuration !== undefined && clip.transitionDuration > 0 
      ? clip.transitionDuration 
      : 0.5;
    const transitionDuration = Math.max(0.01, clipTransitionDuration / safeTempo); // 最小0.01秒を保証
    
    // クリップにimageEffectが設定されている場合はそれを使用、なければ'none'をデフォルトに
    const imageEffect = clip.imageEffect || 'none';
    
    // 一意のキーを生成（クリップのすべての重要なプロパティを含める）
    // audioStartTimeも含めることで、音声の開始位置が変わったときに確実に再レンダリングされる
    const audioStartTime = clip.audioStartTime !== undefined ? clip.audioStartTime : 0;
    const uniqueKey = `${clip.plotName || 'clip'}-${clip.imageUrl || 'no-image'}-${clip.text || 'no-text'}-${clip.duration || 3}-${clip.audioUrl || 'no-audio'}-${audioStartTime}-${index}`;
    
    return (
      <Sequence
        key={uniqueKey}
        from={startFrame}
        durationInFrames={durationInFrames}
      >
        <VideoClipComponent 
          clip={clip} 
          transitionType={transitionType}
          transitionDuration={transitionDuration}
          layoutTemplate={layoutTemplate}
          isFirst={index === 0}
          isLast={index === clips.length - 1}
          productName={productName}
          tempo={tempo}
          audioPlaybackRate={audioPlaybackRate}
          audioEnabled={audioEnabled}
          imageEffect={imageEffect}
          subtitleAudioVolume={subtitleAudioVolume}
          scale={clip.scale}
          position={clip.position}
        />
      </Sequence>
    );
  });

  // 総時間を計算（各クリップのdurationの合計）
  const totalDuration = clips.reduce((sum, clip) => sum + (clip.duration || 3.0), 0);
  
  // BGMの総フレーム数を計算
  // Math.ceilを使用して、Root.tsxとVideoEditor.tsxの計算と一致させる
  const totalDurationInFrames = Math.max(1, Math.ceil(totalDuration * safeFps));

  return (
    <AbsoluteFill style={{ backgroundColor: '#1e1e1e' }}>
      {/* メインコンテンツ（最初から開始） */}
      {sequences}
      
      {/* BGM再生 - タイムラインの長さに合わせてSequenceでラップ */}
      {/* bgmVolume > 0の条件を削除（音量が0でもBGM URLが設定されていれば処理する） */}
      {bgmUrl && (() => {
        debug('[ProductVideo] ========== BGM configuration ==========');
        debug('[ProductVideo] BGM URL:', bgmUrl);
        debug('[ProductVideo] BGM Volume:', bgmVolume);
        debug('[ProductVideo] BGM Start Time:', bgmStartTime);
        debug('[ProductVideo] BGM End Time:', bgmEndTime);
        debug('[ProductVideo] Is Server:', typeof window === 'undefined');
        debug('[ProductVideo] Total Duration:', totalDuration, '秒');
        debug('[ProductVideo] Total Duration (frames):', totalDurationInFrames, 'フレーム');
        
        // BGM URLを処理
        let audioSrc: string;
        
        debug('[ProductVideo] BGM URL processing (before):', {
          original: bgmUrl,
          isServer: typeof window === 'undefined',
        });
        
        // BGM URLの処理（クライアント側とサーバー側で分岐）
        // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
        if (bgmUrl.startsWith('http://') || bgmUrl.startsWith('https://')) {
          // 絶対URLの場合
          try {
            const url = new URL(bgmUrl);
            const hostname = url.hostname;
            const relativePath = url.pathname; // /uploads/audio/xxx.mp3
            
            // localhost:3000のURLで、publicディレクトリに存在するパスの場合のみstaticFile()を使用
            // /uploads/... で始まるパスのみstaticFile()を使用
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            const isPublicPath = relativePath.startsWith('/uploads/');
            
            if (isLocalhost && isPublicPath) {
              // staticFileはpublicディレクトリからの相対パスを期待
              // /uploads/audio/... → uploads/audio/... (先頭の/を削除)
              const staticPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
              audioSrc = staticFile(staticPath);
              debug('[ProductVideo] BGM URL→staticFile (public path):', {
                original: bgmUrl,
                pathname: relativePath,
                staticPath: staticPath,
                final: audioSrc,
                isServer: typeof window === 'undefined',
              });
            } else {
              // 外部URLまたはpublicディレクトリに存在しないパスの場合
              // Remotion Playerは外部URLを直接使用できないため、警告を表示
              warn('[ProductVideo] ⚠️ 外部URLまたはpublic外のパスはRemotion Playerで使用できません:', {
                original: bgmUrl,
                hostname,
                pathname: relativePath,
                isLocalhost,
                isPublicPath,
                message: 'Remotion Playerでは、publicディレクトリ内のファイルのみ使用可能です。外部URLを使用する場合は、Next.jsのAPIルート経由でプロキシするか、publicディレクトリにコピーしてください。',
              });
              // エラー: 空文字列にして、BGMをスキップ
              audioSrc = '';
            }
          } catch (e) {
            logError('[ProductVideo] BGM URLの解析に失敗:', bgmUrl, e);
            // フォールバック処理
            const fallbackPath = bgmUrl.replace(/^https?:\/\/[^/]+/, '');
            if (fallbackPath.startsWith('/uploads/')) {
              audioSrc = staticFile(fallbackPath.slice(1));
              debug('[ProductVideo] BGM URLフォールバック:', {
                fallbackPath,
                final: audioSrc,
              });
            } else {
              logError('[ProductVideo] BGM URLを処理できませんでした:', bgmUrl);
              // エラー: 空文字列にして、BGMをスキップ
              audioSrc = '';
            }
          }
        } else if (bgmUrl.startsWith('/')) {
          // 相対パス（/で始まる）の場合
          // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
          const relativePath = bgmUrl.slice(1); // /を削除
          audioSrc = staticFile(relativePath);
          debug('[ProductVideo] BGM 相対パス→staticFile:', {
            original: bgmUrl,
            staticPath: relativePath,
            final: audioSrc,
            isServer: typeof window === 'undefined',
          });
        } else {
          // その他の場合（相対パス、先頭/なし）
          // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
          audioSrc = staticFile(bgmUrl);
          debug('[ProductVideo] BGM 相対パス→staticFile:', {
            original: bgmUrl,
            final: audioSrc,
            isServer: typeof window === 'undefined',
          });
        }
        
        // BGMのトリミング設定
        // Math.ceilを使用して、他の計算と一致させる
        const bgmStartFrame = Math.ceil(bgmStartTime * safeFps);
        const bgmDurationFrames = bgmEndTime 
          ? Math.ceil((bgmEndTime - bgmStartTime) * safeFps)
          : totalDurationInFrames;
        
        debug('[ProductVideo] BGM URL processing (after):', {
          final: audioSrc,
          isServer: typeof window === 'undefined',
          original: bgmUrl,
          processed: audioSrc,
          volume: bgmVolume,
          startTime: bgmStartTime,
          endTime: bgmEndTime,
          startFrame: bgmStartFrame,
          durationFrames: bgmDurationFrames,
        });
        
        // サーバー側でstaticFileが正しく使用されているか確認
        // RemotionのrenderMediaでは、staticFile()はサーバー側で絶対パスを返す
        // 警告は、audioSrcが空でない場合のみ表示（空の場合は既に警告済み）
        if (typeof window === 'undefined' && audioSrc && audioSrc.trim() !== '') {
          debug('[ProductVideo] サーバー側BGM URL処理完了:', {
            original: bgmUrl,
            processed: audioSrc,
            isValid: audioSrc.startsWith('/') || audioSrc.startsWith('file://') || audioSrc.startsWith('http'),
          });
        }
        
        // audioSrcが空の場合はBGMをスキップ
        if (!audioSrc || audioSrc.trim() === '') {
          warn('[ProductVideo] ⚠️ BGM URLが無効なため、BGMをスキップします:', {
            original: bgmUrl,
            processed: audioSrc,
          });
          return null;
        }
        
        // 音量が0の場合はBGMをスキップ（ミュート状態）
        if (bgmVolume <= 0) {
          debug('[ProductVideo] BGM音量が0のため、BGMをスキップします（ミュート）:', {
            bgmUrl,
            bgmVolume,
          });
          return null;
        }
        
        debug('[ProductVideo] ✅ BGMを再生します:', {
          audioSrc,
          volume: bgmVolume,
          startFrame: bgmStartFrame,
          durationFrames: bgmDurationFrames,
          endFrame: bgmStartFrame + bgmDurationFrames,
          totalDurationInFrames,
          bgmStartTime,
          bgmEndTime,
          safeFps,
        });
        
        // BGMの再生設定
        // bgmStartTime: BGMファイル内の開始位置（秒）
        // bgmEndTime: BGMファイル内の終了位置（秒、nullの場合は最後まで）
        // Sequenceは動画の最初から最後まで（from=0, durationInFrames=totalDurationInFrames）
        // AudioのstartFrom/endAtでBGMファイル内の再生範囲を指定
        
        return (
          <Sequence
            from={0}
            durationInFrames={totalDurationInFrames}
          >
            <Audio 
              src={audioSrc}
              volume={bgmVolume}
              startFrom={bgmStartFrame}
              endAt={bgmStartFrame + bgmDurationFrames}
              loop
            />
          </Sequence>
        );
      })()}
      
      {/* 時間ベースの字幕を表示（修正案2：デバッグログ追加） */}
      {subtitles && subtitles.length > 0 && (() => {
        debug('[ProductVideo] 字幕レンダリング:', {
          count: subtitles.length,
          totalDuration,
          subtitles: subtitles.map(s => ({
            id: s.id,
            text: s.text?.substring(0, 30) || '',
            startTime: s.startTime,
            endTime: s.endTime,
            position: s.position,
            fontSize: s.fontSize,
            color: s.color,
            backgroundColor: s.backgroundColor,
          })),
          isServer: typeof window === 'undefined',
        });
        
        return <TimeBasedSubtitle subtitles={subtitles} totalDuration={totalDuration} />;
      })()}
    </AbsoluteFill>
  );
};

interface VideoClipComponentProps {
  clip: ProductVideoProps['clips'][0] & { totalClips?: number };
  transitionType: TransitionType;
  transitionDuration: number;
  layoutTemplate: LayoutTemplateType;
  isFirst: boolean;
  isLast: boolean;
  productName?: string;
  tempo?: number;
  audioPlaybackRate: number;
  audioEnabled: boolean;
  imageEffect: 'none' | 'kenBurns' | 'zoom' | 'pan' | 'zoomOut' | 'pulse';
  subtitleAudioVolume?: number; // 字幕読み上げの音量
  scale?: number; // 画像のスケール
  position?: { x: number; y: number }; // 画像の位置
}

const VideoClipComponent: React.FC<VideoClipComponentProps> = ({ 
  clip, 
  transitionType,
  transitionDuration,
  layoutTemplate,
  isFirst,
  isLast,
  productName,
  tempo = 1.0,
  audioPlaybackRate,
  audioEnabled,
  imageEffect,
  subtitleAudioVolume = 0.8,
  scale,
  position,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  
  // fpsとtransitionDurationのバリデーション
  const safeFps = fps && !isNaN(fps) && fps > 0 ? fps : 30;
  const safeTransitionDuration = transitionDuration && !isNaN(transitionDuration) && transitionDuration > 0 ? transitionDuration : 0.2;
  
  // シーンの全期間を取得（画像と字幕が表示される期間）
  const safeDurationInFrames = durationInFrames && !isNaN(durationInFrames) && durationInFrames > 0 ? durationInFrames : 90;
  
  return (
    <AbsoluteFill>
      {/* トランジションは最初の短い時間だけ適用 */}
      <ClipTransition transitionType={transitionType} transitionDuration={safeTransitionDuration}>
        <LayoutTemplate
          template={layoutTemplate}
          productName={productName}
          clipIndex={clip.index}
          totalClips={clip.totalClips || 1}
          showProductName={false} // メインコンテンツでは商品名を表示しない
        >
          {/* 背景画像（エフェクト付き）- シーンの全期間表示 */}
          {(() => {
            const imageUrl = clip.imageUrl || clip.image_url || null;
            debug('[ProductVideo/VideoClipComponent] 画像URL確認:', {
              clipIndex: clip.index,
              plotName: clip.plotName,
              imageUrl: imageUrl,
              hasImageUrl: !!clip.imageUrl,
              hasImage_url: !!clip.image_url,
              imageEffect: imageEffect,
              scale: scale,
              position: position,
            });
            
            if (!imageUrl || imageUrl.trim() === '') {
              warn('[ProductVideo/VideoClipComponent] ⚠️ 画像URLが設定されていません:', {
                clipIndex: clip.index,
                plotName: clip.plotName,
                imageUrl: imageUrl,
              });
              // 画像がない場合は黒い背景を表示（エラー表示はImageWithEffects内で行う）
              return (
                <AbsoluteFill style={{ backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ color: '#666', fontSize: 14 }}>No image set</div>
                </AbsoluteFill>
              );
            }
            
            return (
              <ImageWithEffects 
                imageUrl={imageUrl} 
                effect={imageEffect}
                scale={scale}
                position={position}
              />
            );
          })()}

          {/* Audio - 字幕読み上げの音声 */}
          {/* audioEnabledがfalseの場合は音声を読み込まない（エクスポート時は常にfalse） */}
          {audioEnabled && (clip.audio_path || clip.audioUrl) && (() => {
            // サーバー側レンダリングでaudioEnabledがfalseの場合はスキップ
            if (typeof window === 'undefined' && !audioEnabled) {
              warn('[ProductVideo] サーバー側レンダリングでaudioEnabledがfalseのため、音声をスキップします');
              return null;
            }
            const rawAudioPath = clip.audio_path || clip.audioUrl || '';
            let audioSrc: string;
            
            // 音声URLの処理（BGMと同様の処理）
            // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
            if (rawAudioPath.startsWith('http://') || rawAudioPath.startsWith('https://')) {
              // 絶対URLの場合
              try {
                const url = new URL(rawAudioPath);
                const hostname = url.hostname;
                const relativePath = url.pathname; // /uploads/audio/...
                
                // localhost:3000のURLで、publicディレクトリに存在するパスの場合のみstaticFile()を使用
                // /uploads/... で始まるパスのみstaticFile()を使用
                const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                const isPublicPath = relativePath.startsWith('/uploads/');
                
                if (isLocalhost && isPublicPath) {
                  // staticFileはpublicディレクトリからの相対パスを期待
                  // /uploads/audio/... → uploads/audio/... (先頭の/を削除)
                  const staticPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
                  audioSrc = staticFile(staticPath);
                  debug('[ProductVideo] 音声URL→staticFile (public path):', {
                    original: rawAudioPath,
                    pathname: relativePath,
                    staticPath: staticPath,
                    final: audioSrc,
                    isServer: typeof window === 'undefined',
                  });
                } else {
                  // 外部URLまたはpublicディレクトリに存在しないパスの場合
                  // Remotion Playerは外部URLを直接使用できないため、警告を表示
                  warn('[ProductVideo] ⚠️ 外部URLまたはpublic外のパスはRemotion Playerで使用できません:', {
                    original: rawAudioPath,
                    hostname,
                    pathname: relativePath,
                    isLocalhost,
                    isPublicPath,
                    message: 'Remotion Playerでは、publicディレクトリ内のファイルのみ使用可能です。',
                  });
                  // エラー: 空文字列にして、音声をスキップ
                  audioSrc = '';
                }
              } catch (e) {
                // URL解析に失敗した場合はエラーをログに記録
                logError('[ProductVideo] 音声URLの解析に失敗:', rawAudioPath, e);
                // フォールバック: 相対パスとして処理を試みる
                const fallbackPath = rawAudioPath.replace(/^https?:\/\/[^/]+/, '');
                if (fallbackPath.startsWith('/uploads/')) {
                  audioSrc = staticFile(fallbackPath.slice(1));
                  debug('[ProductVideo] 音声URLフォールバック:', {
                    fallbackPath,
                    final: audioSrc,
                  });
                } else {
                  // エラー: 空文字列にして、音声をスキップ
                  warn('[ProductVideo] 音声URLを処理できませんでした。音声をスキップします:', rawAudioPath);
                  audioSrc = '';
                }
              }
            } else if (rawAudioPath.startsWith('/')) {
              // 相対パス（/で始まる）の場合
              // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
              // /uploads/audio/... → uploads/audio/... (先頭の/を削除)
              audioSrc = staticFile(rawAudioPath.slice(1));
              debug('[ProductVideo] 音声相対パス→staticFile:', {
                original: rawAudioPath,
                staticPath: rawAudioPath.slice(1),
                final: audioSrc,
                isServer: typeof window === 'undefined',
              });
            } else {
              // /で始まらない相対パスの場合
              // Remotion Playerでは、クライアント側でもstaticFile()を使用する必要がある
              audioSrc = staticFile(rawAudioPath);
              debug('[ProductVideo] 音声相対パス→staticFile:', {
                original: rawAudioPath,
                final: audioSrc,
                isServer: typeof window === 'undefined',
              });
            }
            
            // audioSrcが空の場合は音声をスキップ
            if (!audioSrc || audioSrc.trim() === '') {
              warn('[ProductVideo] ⚠️ 音声URLが無効なため、音声をスキップします:', {
                original: rawAudioPath,
                processed: audioSrc,
              });
              return null;
            }
            
            // サーバー側でのみ詳細ログを出力
            if (typeof window === 'undefined') {
              debug('[ProductVideo] 音声ファイル読み込み:', {
                clipIndex: clip.index,
                plotName: clip.plotName,
                rawPath: rawAudioPath,
                finalSrc: audioSrc,
                isAbsoluteUrl: rawAudioPath.startsWith('http'),
                isRelativePath: rawAudioPath.startsWith('/'),
              });
            }
            
            return (
            <Audio 
                src={audioSrc}
              playbackRate={audioPlaybackRate}
              startFrom={clip.audioStartTime ? Math.ceil(clip.audioStartTime * safeFps) : 0}
              volume={subtitleAudioVolume} // 字幕読み上げの音量を設定
            />
            );
          })()}

          {/* Subtitles - シーンの全期間表示（clip.textが設定されている場合、かつaudioEnabledがtrueの場合のみ） */}
          {/* 編集前の動画（audioEnabled=false）では字幕を表示しない */}
          {audioEnabled && clip.text && clip.text.trim() && <Subtitle text={clip.text} />}
        </LayoutTemplate>
      </ClipTransition>
    </AbsoluteFill>
  );
};

