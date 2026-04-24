// BGMライブラリの型と、配列を扱うクライアントサイド用ユーティリティ。
// 実データは現在 in-app の localStorage に保持され、ここには定義のみが残る
// (ランタイムでサーバーから配信する SSR ローダは長らく未使用だったため削除)。

export interface BgmTrack {
  id: string;
  name: string;
  description: string;
  genre: string; // ジャンル（例: 'upbeat', 'calm', 'corporate', 'energetic'）
  url: string; // ファイルパス（public/bgm/ からの相対パス、または /uploads/audio/）
  duration?: number; // 秒数（オプション）
  mood?: string; // ムード（例: 'happy', 'serious', 'relaxed'）
}

// クライアントサイド用のデフォルト BGM ライブラリ（OSS 配布時は空、
// 個別の楽曲はアプリの BGM 設定パネルからアップロードして localStorage に蓄積）。
export const BGM_LIBRARY: BgmTrack[] = [];

// ジャンルでフィルタリング
export const getBgmByGenre = (library: BgmTrack[], genre: string): BgmTrack[] =>
  library.filter((track) => track.genre === genre);

// ID で BGM を取得
export const getBgmById = (library: BgmTrack[], id: string): BgmTrack | undefined =>
  library.find((track) => track.id === id);

// ジャンル一覧を取得
export const getGenres = (library: BgmTrack[]): string[] =>
  Array.from(new Set(library.map((track) => track.genre)));
