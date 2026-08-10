# Talk to the City

<!-- hy-mt2-i18n:start -->
[English](./README.md) | [中文](./README_zh-CN.md) | **日本語** | [Español](./README_es.md)
<!-- hy-mt2-i18n:end -->


[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city)は、詳細な定性データを分析することで集団による審議や意思決定を向上させるための、オープンソースでLLMを活用したSaaSツールです。このツールは回答を集約し、類似した意見を主要トピックとサブトピックからなる階層構造で整理します。

**ライブで試してみる**: [https://talktothe.city/](https://talktothe.city/)

### 開発者向け

以下についての詳細な手順は、[DEVELOPMENT.md](DEVELOPMENT.md)をご覧ください：

- クラウド依存関係（Firebase、GCSなど）のセットアップ
- 環境変数の設定
- すべてのサービスのローカルでのインストールおよび実行

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   next-client   │◄──►│ express-server  │◄──►│pipeline-worker  │
│   (フロントエンド)    │    │   (バックエンド)     │    │ (LLM処理)│
│   ポート: 3000    │    │   ポート: 8080    │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │
          │                      │
          ▼                      ▼
       ┌─────────────────────────────────────┐
       │             共通コンポーネント          │
       │         （共有型、スキーマ、ユーティリティ）│
       └─────────────────────────────────────┘
```

**外部サービス**: Firebase（認証）、Google Cloud Storage（レポート）、Redis（キャッシング）、Google Pub/Sub（ジョブ）

## サンプルデータ

サンプルのCSVファイルは、`examples/sample_csv_files/`ディレクトリにあります：

- `reddit_climate_change_posts_500.csv`: 気候変動に関する議論投稿

期待されるCSV形式：

```csv
id,interview,comment
1,participant_1,これはサンプルのコメントです
2,participant_2、別の参加者の返答
```

## ライセンス

[![License](https://img.shields.io/badge/license-Apache%202-blue)](LICENSE.txt)

---

**質問がありますか？** 質問やフィードバックがある場合、または影響力の大きいアプリケーションの開発において直接協力したい場合は、<hello@aiobjectives.org>までご連絡ください。
