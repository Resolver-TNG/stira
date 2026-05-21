# ADR-006: Canonical Stimulus Categories

**Status:** Accepted
**Date:** 2026-05-21

## Context

`Event.category` は matrix 上の列を指す文字列キー。Engine は category 文字列の中身に意味を持たない（純関数で `matrix[category]` を引くだけ）。

しかし Adapter（特に LLM ベースのカテゴライザ）は「どのカテゴリ語彙を使うか」の指針を必要とする。語彙が adapter ごとに揃わないと:

- persona ファイル（matrix.json）の互換性が崩れる
- 異なる adapter で同じ persona を共有できない
- ドキュメントとコードのズレが発生する

そのため **「推奨される標準語彙」** を ADR レベルで明文化しておく。ただし強制ではない。

## Decision

### Default Vocabulary (6 categories)

Stira spec が推奨する標準カテゴリは以下の 6 つ:

| category | 意味 |
|---|---|
| `joy` | 喜び・達成感・ポジティブな驚き |
| `threat` | 脅威・危険・敵対的状況 |
| `achievement` | タスク完遂・成功・目標達成 |
| `loss` | 喪失・失敗・別れ |
| `uncertainty` | 不確実性・曖昧さ・判断不能 |
| `connection` | 繋がり・共感・親密な対話 |

これらは SOUL.md の Emotion Matrix v3 で採用されている語彙と一致しており、Cowen & Keltner (2017) PNAS 27 感情カテゴリからの射影として設計されている（詳細は SOUL.md を参照）。

### These are recommendations, not constants

- Engine は category 名を **enum でバリデートしない**。任意の文字列を受け入れる。
- 上記 6 カテゴリを使わなくても spec violation ではない。
- ただし persona テンプレートを公開する場合は、これら 6 つから始めるのが推奨される（共有しやすいため）。

### Custom Categories

- Custom category を追加するのは matrix の `triggers` 列に新しいキーを足すだけ。
- Engine 側に登録は不要 — matrix に存在すれば暗黙的に「定義されている」。
- 例: `betrayal`, `flow`, `boredom`, `hunger` など、persona の都合で自由に拡張できる。

### Undefined Categories → No-op (already implemented)

`event.category` が matrix の `triggers` に存在しない場合、Engine の `applyEvent` は **no-op**（state を変更しない）。

これは既実装の engine 仕様であり、ADR-001（pure functions）と整合する:

- Engine は category の妥当性を判断しない（adapter の責任）
- 不明な category でも例外を投げず、静かに無視する
- ログ・警告は adapter 層で行う（必要なら）

`rationale` フィールドは category が無効でも保持されるべき。監査証跡として価値がある。

### Adapter Guidelines (LLM-based categorization)

Adapter が LLM 等でイベントから category を判定する場合の指針:

1. **曖昧な場合は `uncertainty` にフォールバック** — 「どの category にも当てはまらない」を専用カテゴリで吸収する。`uncertainty` は spec が常に推奨するキーで、matrix 設計時もここに最低限のエントリを置くべき。

2. **複合刺激は最も強い方を選択（分割しない）** — 例えば「失敗したけど学びがあった」イベントを `loss` と `achievement` の 2 イベントに分割しない。1 イベント = 1 category が原則。intensity を上げ、もう片方の影響は無視する。

   - 理由: matrix は「同時にどう動くか」を既に行列形式で持っており、1 イベントを 2 つに割るのは matrix の意図と二重カウントになる。

3. **intensity 0.0 のイベントは送らない** — engine 仕様上 no-op になるため無意味。送ると history が無駄に膨らみ、audit trail のシグナルノイズ比が下がる。

4. **`rationale` を必ず埋める** — adapter が「なぜこの category にしたか」を 1 行残すこと。後から persona drift を分析する際の最重要シグナル。

5. **境界事例は document 化する** — 「どういうイベントを `connection` と判定するか」を adapter リポジトリ側で persona ごとに記述すべき。matrix の数値だけでは再現性がない。

### Source field 推奨運用

`event.source` は spec で `"user" | "system" | "tool" | "self"` の 4 値:

- `user`: 対話相手由来の刺激（マスターの発言など）
- `system`: 環境・cron・schedule 由来（時間経過、外部通知）
- `tool`: ツール実行結果由来（ビルド失敗、API エラー）
- `self`: エージェント自身の内省由来

Adapter は category 判定と並行して source も埋めることが推奨される。drift 分析時に「どの source からの刺激で人格が動いたか」が重要な手がかりになる。

## Rationale

- 「全 adapter で語彙を揃えたい」 vs 「強制は spec の重さに釣り合わない」のトレードオフを、**推奨 + 自由拡張** の二段構えで解く
- ADR-001 と一貫性 — engine は category の意味に touch しない
- LLM categorization の指針を明文化することで、adapter 実装者ごとの解釈ぶれを抑える
- 6 カテゴリは SOUL.md と Cowen & Keltner との対応がすでに取れており、エビデンスベースの初期値として妥当

## Consequences

- 公開 persona テンプレート（personas/*.json）はデフォルト 6 カテゴリを使うべき
- カスタム category を持つ persona は README で明示する（共有時の互換性のため）
- Engine の test fixture は 6 カテゴリと拡張カテゴリの両方をカバーする
- v1.0 freeze 時点でこの 6 語彙を spec 推奨として SPEC.md に記載する（ADR-004 freeze criteria と連動）
- 将来 category 語彙を変更する場合は新 ADR を追加（このカテゴリ集合自体が persona 互換性の基盤になるため、軽率に変更しない）
