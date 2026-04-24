# Abekyo Editor

[English](./README.md) / 日本語

[![CI](https://github.com/abekyo/abekyo-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/abekyo/abekyo-editor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Remotion](https://www.remotion.dev/) と Next.js 上に構築されたオープンソースのセルフホスト型動画エディタです。画像や動画クリップをアップロードしてタイムライン上に並べ、字幕・BGM を追加してMP4へ書き出せます。すべてブラウザ内で編集し、あなた自身のサーバーでレンダリングします。

## 主な機能

- **画像 / 動画タイムライン** — 任意の枚数の画像または動画クリップ（MP4 / MOV / WebM）をドロップし、並べ替え、トリミング。エディタの **+ シーン追加** をクリックするとメディア選択ダイアログが開き、選択 → アップロード → クリップ追加を1ステップで完了
- **クリップ単位のナレーション** — 各クリップに音声ファイルを添付。クリップ尺は音声の長さに自動調整
- **BGMトラック** — 一度アップロードすれば複数プロジェクトで再利用可能。開始/終了位置のトリミング、音量調整、フェードイン/アウト対応
- **字幕エディタ** — 書体プリセット（フォント、シャドウ、縁取り）、字幕ごとのタイミング、画面上でドラッグ可能な位置指定
- **トランジションとモーション** — フェード、クロスフェード、スライド、ワイプ、ズーム、加えてクリップ単位のケン・バーンズ / パン / パルスエフェクト
- **サーバーサイドでのMP4書き出し** — `/api/render`ルートが `@remotion/renderer` を使って自マシン上でレンダリング。NDJSON 進捗ストリーミング、IPごとのレートリミット、同時実行数キャップ、クライアント切断時の `cancelSignal` 伝播。第三者レンダリングサービスやAPIキーは不要
- **マジックバイト方式のアップロード検証** — `/api/upload` はクライアント申告のMIMEを無視し、ファイルシグネチャを実バイトで検証してから保存。`.html` を `.png` に拡張子だけ書き換えても弾かれます
- **バイリンガルUI** — 既定は英語、ランディングページのトグルで日本語に切替可能。`messages/<locale>.json` を追加するだけで他言語も対応可能。CI 用の整合性チェック（`npm run i18n:check`）も同梱
- **ランタイム外部依存ゼロ** — DB、認証プロバイダ、決済ゲートウェイなし。`.env.example` は全項目オプションのオーバーライドのみ

## 必要要件

- **Node.js 20 以上**
- **ディスク空き容量 ~700 MB**（依存関係用）
- **初回書き出し時に ~90 MB の Chrome Headless Shell をダウンロード**（Remotion が自動管理、初回のみ）

## クイックスタート

```bash
git clone https://github.com/<your-fork>/Abekyo-editor.git
cd Abekyo-editor
npm install
npm run dev
```

http://localhost:3000 を開き、画像を何枚かアップロードして **Start Editing** をクリック、編集後に **Export** を押してください。書き出されたMP4は `public/uploads/output/` に保存され、自動的にダウンロードされます。

## プロジェクト構成

```
Abekyo-editor/
├── app/
│   ├── page.tsx                 # ホーム — アップロードUI
│   ├── video-edit/page.tsx      # エディタシェル（storeからclipsを読み込み）
│   ├── api/upload/route.ts      # multipartファイル受信 → public/uploads/
│   └── api/render/route.ts      # Remotionバンドル + renderMedia → MP4
├── components/
│   ├── VideoEditor.tsx          # エディタシェル — タイムライン、サイドパネル、プレビュー、書き出しを統括
│   ├── Onboarding.tsx           # 初回訪問時のガイドツアー（lib/onboardingTargets.ts のIDで対象解決）
│   ├── LanguageSwitcher.tsx     # EN/JAトグル（cookie方式）
│   ├── ProgressBar.tsx          # ページ遷移の進捗バー
│   ├── PlotEditor.tsx           # 単独のプロットテキストエディタ
│   ├── VideoThumbnail.tsx       # クリップサムネイル
│   └── editor/                  # VideoEditor.tsx から抽出したサブコンポーネント群（Phase 1–3）
│       ├── EditorToolbar.tsx        # 上部ツールバー（undo/redo、再生、保存、書き出し）
│       ├── SidePanelsContainer.tsx  # Properties / Subtitle / BGM の排他スライドイン
│       ├── ModernTimeline.tsx       # マルチトラックタイムライン（クリップ / 字幕 / BGM）
│       ├── ClipProperties.tsx       # クリップ詳細設定パネル本体
│       ├── SubtitleEditor.tsx       # 字幕エディタパネル本体
│       ├── BgmSettings.tsx          # BGMライブラリ + アップロード + トリミング
│       ├── MediaUploadButton.tsx    # クリップ画像/動画差し替えボタン
│       ├── ToolButton.tsx           # サイドツールバーのアイコン+ラベルボタン
│       ├── dialogs/
│       │   ├── ExportDialog.tsx     # 書き出し解像度ピッカー
│       │   ├── ExitConfirmDialog.tsx# 「保存して終了？」確認
│       │   └── ShortcutsOverlay.tsx # キーボードショートカット一覧
│       └── hooks/
│           ├── useKeyboardShortcuts.ts # 全 keydown バインディング
│           ├── useClipHandlers.ts      # クリップ CRUD: delete / reorder / extend / copy / paste
│           └── useSubtitleHandlers.ts  # 字幕 CRUD: add / edit / delete / copy / paste
├── src/                         # Remotionコンポジション（ProductVideo, Transitions, Subtitle 等）
├── lib/
│   ├── store.ts                 # Zustand — 永続的なプロジェクトデータ（clips / BGM / 動画設定）
│   ├── editorStore.ts           # Zustand — エディタの一時状態（選択、currentTime、undo スタック、パネル切替）
│   ├── subtitlePresets.ts       # 書体プリセット
│   ├── bgmLibrary.ts            # 型定義 + クライアントサイドヘルパー（ランタイムデータは localStorage）
│   ├── onboardingTargets.ts     # オンボーディングツアーが指す DOM id の型付きレジストリ
│   ├── hooks/useUrlConverter.ts # Remotion player 用 URL 変換ヘルパー
│   └── utils/                   # logger（サーバー + クライアント）と metadata ヘルパー
├── messages/
│   ├── en.json                  # 英語翻訳（デフォルト）
│   └── ja.json                  # 日本語翻訳
├── scripts/
│   └── check-i18n.mjs           # messages/*.json のキー整合性チェック（CI で実行）
├── tests/
│   ├── upload-detect.test.ts    # マジックバイトによるメディア種別判定（unit）
│   ├── upload-route.test.ts     # POST /api/upload 統合テスト（fs はモック）
│   ├── render-rate-limit.test.ts # スライディングウィンドウ式レートリミッタ、IP 抽出（unit）
│   ├── render-route.test.ts     # POST /api/render 統合テスト（Remotion はモック）
│   ├── editorStore.test.ts      # Zustand エディタストアの action（undo/redo/panel）
│   ├── check-i18n.test.ts       # i18n 整合性スクリプト（サブプロセス起動）
│   ├── components/              # React Testing Library smoke tests（jsdom）
│   │   ├── VideoEditor.test.tsx     # エディタ起動 + toolbar / panel toggle 統合テスト
│   │   ├── MediaUploadButton.test.tsx
│   │   ├── ClipProperties.test.tsx
│   │   ├── SubtitleEditor.test.tsx
│   │   ├── BgmSettings.test.tsx
│   │   └── Onboarding.test.tsx
│   ├── helpers/render.tsx       # NextIntlClientProvider 込みの render ヘルパー
│   └── setup-jsdom.ts           # jest-dom matcher と jsdom polyfill
├── .github/
│   └── workflows/ci.yml         # 全 push / PR で typecheck / test / i18n / build / lint を実行
└── public/uploads/
    ├── image/                   # ユーザーアップロードの画像
    ├── audio/                   # ユーザーアップロードの音声（ナレーション + BGM）
    ├── video/                   # ユーザーアップロードの動画クリップ（MP4 / MOV / WebM）
    └── output/                  # 書き出し済みMP4ファイル
```

## 技術スタック

| レイヤー | ライブラリ |
|---|---|
| フレームワーク | Next.js 16（App Router、Turbopack） |
| UI | React 19、Tailwind CSS 4 |
| 状態管理 | Zustand |
| i18n | next-intl（cookieベースのロケール） |
| 動画エンジン | Remotion 4（サーバー側は `@remotion/bundler` + `@remotion/renderer`、ブラウザ側プレビューは `@remotion/player`） |
| 言語 | TypeScript 5 |

## npm スクリプト

| コマンド | 用途 |
|---|---|
| `npm run dev` | Next.js dev server 起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run lint` | ESLint |
| `npm test` | Vitest スイートを実行 — ユニットテスト（アップロードのマジックバイト判定、レンダリングのレートリミッタ、IP 抽出、i18n 整合性）、エディタストアの action テスト、主要な編集パネルの React Testing Library スモークテストを含む |
| `npm run test:watch` | Vitest の watch モード |
| `npm run test:coverage` | v8 カバレッジレポート付きで実行 |
| `npm run i18n:check` | `messages/*.json` のキー整合性を検証（CI 推奨） |
| `npm run remotion:studio` | Remotion Studio を開いてコンポジションをデバッグ |
| `npm run remotion:render` | CLI経由でレンダリング（上級者向け） |

## 設定

`.env.example` を `.env.local` にコピーし、必要に応じて調整してください。すべてオプションで、未設定でもアプリは動作します。

| 変数 | デフォルト | 用途 |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | メタデータのカノニカル URL 生成と `/api/render` 内での絶対 URL 解決。本番では公開ドメインを指定 |
| `NEXT_PUBLIC_GITHUB_URL` | _未設定_ | ランディングページの GitHub ボタンとフッターリンクが指す URL。未設定だとボタン自体が非表示になり、ダミーリンクが残らない |
| `RENDER_MAX_CONCURRENT` | `1` | `/api/render` の同時実行ジョブ数上限。Remotion は重い（Chromium + ffmpeg）ので潤沢なハードウェア時のみ引き上げる |
| `RENDER_RATE_LIMIT_WINDOW_MS` | `600000`（10分） | `/api/render` の IP ごとスライディングウィンドウ長 |
| `RENDER_RATE_LIMIT_MAX` | `10` | ウィンドウ内に同一 IP から受け付ける `/api/render` リクエスト上限 |

## キーボードショートカット

エディタにはデスクトップ NLE に倣ったキーボードショートカットが実装されています。入力欄（input / textarea）にフォーカスがあるときはショートカットが無効化されるため、文字入力と干渉しません。ツールバーからアプリ内のショートカット一覧オーバーレイを開けます。

### 再生・ナビゲーション

| キー | 動作 |
|---|---|
| `Space` | 再生 / 一時停止 |
| `←` / `→` | 1 フレーム戻る / 進む（30 fps） |
| `↑` / `↓` | 前 / 次のクリップへジャンプ（再生ヘッドをクリップ先頭に移動） |
| `Esc` | 開いているダイアログ・サイドパネルを閉じる |

### 編集

| キー | 動作 |
|---|---|
| `S` | 再生ヘッド位置で選択中のクリップまたは字幕を分割 |
| `A` | 選択範囲を直前のクリップ境界までカット |
| `D` | 選択範囲を直後のクリップ境界までカット |
| `Delete` / `Backspace` | 選択中のクリップ・字幕を削除 |
| `Cmd` / `Ctrl` + `N` | クリップを追加（メディアピッカーを開く） |

### クリップボード

字幕が選択されていれば字幕を、なければ選択中のクリップを対象に、自動でルーティングされます。

| キー | 動作 |
|---|---|
| `Cmd` / `Ctrl` + `C` | コピー |
| `Cmd` / `Ctrl` + `V` | ペースト（コピー元の種類に応じた場所に貼り付け） |
| `Cmd` / `Ctrl` + `X` | カット |

### 履歴

| キー | 動作 |
|---|---|
| `Cmd` / `Ctrl` + `Z` | 元に戻す |
| `Cmd` / `Ctrl` + `Shift` + `Z` | やり直し |
| `Cmd` / `Ctrl` + `Y` | やり直し（Windows 風エイリアス） |

### 書き出しダイアログ

| キー | 動作 |
|---|---|
| `Enter` | 確定して書き出し開始 |
| `Esc` | キャンセルしてダイアログを閉じる |

バインディングは [`components/editor/hooks/useKeyboardShortcuts.ts`](components/editor/hooks/useKeyboardShortcuts.ts) に集約されています。単一の switch 文で、監査・拡張が容易です。

## 言語を追加する

1. `messages/<locale>.json` を `messages/en.json` と同じ構造で作成
2. `i18n/routing.ts` に新しいロケールコードを追加（`locales: ['en', 'ja', '<new>']`）
3. `components/LanguageSwitcher.tsx` にそのロケール用のボタンを追加

これだけです。`lang` cookieの値に応じてアプリが自動的に翻訳を切り替えます。

## 設計メモ

- **認証は同梱しない**: このエディタは、既存スタックの認証（リバースプロキシ、社内ネットワーク、ラッパーアプリ等）の背後でセルフホストする前提です。`/api/render` と `/api/upload` にはレートリミットと同時実行数キャップが入っていますが、ユーザー識別はありません。これらのエンドポイントを認証なしで公開インターネットに晒さないでください
- **画像と動画クリップ、動画の音声はミュート**: 各クリップの主素材は画像または短い動画（MP4 / MOV / WebM）です。動画クリップは Remotion の `<OffthreadVideo>` で再生され、元の音声トラックはミュートされます（クリップごとに独立したナレーションチャネルがあるため）。トリミングはクリップ尺で行い、ソース動画の時間範囲指定はサポートしていません
- **BGMライブラリは空で出荷**: ユーザーはBGM設定パネルのアップロードボタンから個人ライブラリを構築できます（`localStorage`で永続化）
- **書き出しはサーバーサイド専用**: Export は Next.js サーバーの `/api/render` を経由します。ブラウザネイティブのMP4エンコードはありません。Chrome Headless Shell が必要です（Remotion が初回書き出し時に自動ダウンロード、~90 MB）
- **ファイルアップロードはローカルディスク**: ファイルは `public/uploads/` 配下に保存されます。マルチテナントデプロイの場合は `app/api/upload/route.ts` を S3 / R2 / GCS などのオブジェクトストレージに書き換えてください

## コントリビュート

PRを歓迎します。特に以下の貢献が有用です:

- 追加UI言語 — 新しい `messages/<locale>.json` を追加してPRを出してください
- 新しいトランジションや画像エフェクト — `src/Transitions.tsx` と `src/ImageEffects.tsx` を参照
- ビジュアルの改善とアクセシビリティ向上
- `/api/upload` と `/api/render` 出力用のオブジェクトストレージアダプタ

`.env.example` は最小限に保ってください。有償サービスへの実行時依存を追加しないでください。

## ライセンス

MIT © 2026 Opportunity Inc. [LICENSE](./LICENSE) を参照。

## クレジット

Abekyo Editor は以下のプロジェクトの上に成り立っています:

- 動画エンジンとして [Remotion](https://www.remotion.dev/)
- Next.js および React チーム
- next-intl、Zustand、Tailwind
