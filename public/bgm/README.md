# BGM library (developer note)

> **Most users should not touch this folder.** The primary way to add BGM is the in-app upload button on the **BGM settings** panel, which persists your personal library to `localStorage` and survives across projects.
>
> This folder is an optional code-level seed for deployments that want to ship pre-bundled tracks. `lib/bgmLibrary.ts` exports an empty `BGM_LIBRARY` array — adding entries there makes those tracks appear in the BGM panel for every user of that deployment.
>
> The instructions below are for that developer-seeding flow.

---

# BGMライブラリ（開発者向け）

このフォルダには、デプロイ時に同梱するBGMファイルを配置します（通常ユーザーはアプリ内のBGM設定パネルのアップロード機能で十分です）。

## BGMファイルの追加方法

1. **BGMファイルを配置**
   - このフォルダ（`public/bgm/`）にMP3ファイルを配置します
   - ファイル名は任意ですが、わかりやすい名前にしてください
   - 例: `upbeat-1.mp3`, `calm-1.mp3`, `corporate-1.mp3`

2. **ライブラリに登録**
   - `lib/bgmLibrary.ts`を開きます
   - `BGM_LIBRARY`配列に新しいBGM情報を追加します

   ```typescript
   {
     id: 'unique-id',           // 一意のID
     name: 'BGM名',             // 表示名
     description: '説明',       // 説明文
     genre: 'ジャンル',         // ジャンル（upbeat, calm, corporate, energeticなど）
     url: '/bgm/ファイル名.mp3', // ファイルパス
     mood: 'ムード',            // ムード（happy, relaxed, professionalなど）
   }
   ```

## 推奨ファイル形式

- **形式**: MP3
- **ビットレート**: 128kbps以上推奨
- **長さ**: 30秒〜3分程度（ループ再生されるため短くても可）

## ジャンル一覧

- **upbeat**: 明るく楽しい雰囲気
- **calm**: 落ち着いた雰囲気
- **corporate**: ビジネス向け
- **energetic**: エネルギッシュ

## 注意事項

- 著作権フリーのBGMを使用してください
- ファイルサイズは適切に（1ファイルあたり5MB以下推奨）
- ファイル名に日本語や特殊文字は避けてください

