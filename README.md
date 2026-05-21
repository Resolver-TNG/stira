# Stira

AIエージェントの行動状態を制約付き状態機械で管理するライブラリ。

## なぜ書いたか

長く動かすエージェントを運用していて、人格や口調が静かに崩れる（drift する）のが扱いづらかった。能力テストでは拾えないが、ユーザー体験としては明らかにおかしい、という現象。

状態と遷移を明示的に持たせて、閾値を超えたら制限をかける形にしたら扱いやすくなった。これはそれをライブラリにしたもの。

## Installation

```bash
# Engine (pure functions)
cd engine && npm install
npm run build

# CLI
cd cli && npm install
npm run build
```

## Quick Start

```typescript
import { applyEvent, decay, getFiredBreakers } from '@stira/engine';
const next = applyEvent(state, event, matrix);            // state += matrix[cat] * intensity
const decayed = decay(next, elapsedMs, config.decay);     // time-based drift toward floor
const fired = getFiredBreakers(decayed, config.breakers); // [] when nothing tripped
```

## CLI Usage

```bash
# Simulate persona against stimuli JSONL
node cli/dist/index.js simulate \
  --persona personas/restless-scout.json \
  --stimuli stimuli/stress-test.jsonl

# Write output to file
node cli/dist/index.js simulate \
  --persona personas/restless-scout.json \
  --stimuli stimuli/normal-day.jsonl \
  --output /tmp/run.jsonl
```

出力は JSONL — `init`, `decay`, `event` の3種のレコードが時系列で並ぶ。
`event` レコードには `breakers` 配列が含まれ、発火したブレーカーを示す。

サンプル出力:

```jsonl
{"step":0,"type":"init","timestamp":"2026-01-01T00:00:00.000Z","params":{"stability":0.95,"vigilance":0.5}}
{"step":1,"type":"decay","timestamp":"2026-01-01T08:00:00Z","elapsedMs":28800000,"params":{"stability":0.95,"vigilance":0.26}}
{"step":1,"type":"event","eventId":"s01","category":"connection","intensity":0.5,"params":{"stability":1,"vigilance":0.06},"breakers":[]}
```

## できること

- N次元の行動パラメータを永続化
- 刺激-反応行列（matrix）で遷移パターンを定義
- 時間経過での自然減衰
- サーキットブレーカー（閾値で行動制限）
- 位相崩壊検出（人格の数値的安定性が壊れたら警告）
- 口調/スタイルの崩壊を早期検知する仕組みとしても機能する

## できないこと

- マルチエージェント協調
- 行列の自動学習・最適化
- 「正しいエージェント設計」の答え

## 使うべきか

- 長時間動くエージェントで人格/口調が崩れるのが気になるなら、試す価値はあるかもしれない
- 短いタスクで完結するエージェントには大げさ
- 記憶管理が欲しいなら MemGPT/Letta の方が適切。Stira は personality state に特化している

## 設計思想

- **Engine は LLM を呼ばない**（純関数。テスト可能）
- **固定コア（stability, vigilance）のみブレーカー発動可能**（安全性をユーザーが壊せない）
- **行列のベースラインは不変**（drift 検出の基準）
- **Adapter 層でハーネス差を吸収**（OpenClaw / Claude Code / 自前）
- **ACP 委任前提の構造**（spec と test が先にあり、実装は AI に投げる）

詳しくは [docs/philosophy.md](docs/philosophy.md) を参照。

## 構造

```
stira/
├── spec/           # JSON Schema — ハーネス非依存の仕様
├── engine/         # TypeScript 純関数 — 計算エンジン
├── cli/            # CLI simulate コマンド
├── stimuli/        # テスト用刺激シナリオ JSONL
├── personas/       # テスト人格（権利フリーオリジナル）
├── adapters/       # ハーネス固有実装
├── adr/            # Architecture Decision Records
└── docs/           # ガイド・思想・参考文献
```

## 思想的背景（参考）

- Anthropic, "Emotion Concepts and their Function in a LLM" (arXiv:2604.07729)
- PRISM, "Expert Personas Improve LLM Alignment" (arXiv:2603.18507)
- UEC 稲葉研, Emotion Transcription in Conversation (ETC)
- UEC 大須賀研, Personality Emergence in LLM Agents (CCET 2025)

これらを読んで、自分の運用感覚と合った部分を実装に落としている。論文の主張を全面的に支持しているわけではない。

## 開発について

このライブラリ自体、設計は人間と AI で決めて、実装は ACP 経由でコーディング AI に投げて作っている。「エージェントを制約するライブラリをエージェントが書く」というドッグフーディング。

## Status

🚧 Pre-alpha — Phase 0 実装済み。

## License

Apache-2.0
