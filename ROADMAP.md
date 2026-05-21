# Roadmap

_方針決定: 2026-05-21_

---

## Phase 0 完了条件（DoD）

- [ ] engine: `npm ci && npm run build && npm test` exit 0
- [ ] engine: `now` 引数対応済み（decay関数）
- [ ] engine: 同入力→同出力の決定論性テスト 1本以上
- [ ] engine: version不一致時に処理拒否する仕組み
- [ ] OC adapter: init / decay-cron / apply-event / status 全スクリプト動作
- [ ] OC adapter: テスト用サブエージェントで **72h連続稼働** 異常なし
- [ ] simulate CLI: 3人格 × 100 step で JSONL出力可能
- [ ] doc: breaker コントラクト + DoD 記載済み

Phase 0 完了後、engine API を freeze。Phase 1 で adapter 追加時に engine signature は変えない。

---

## Phase 0 — 動くデモ（最優先）

目標: `stira simulate` で人格driftが見える状態にする

- [x] `engine/` の npm install + テスト全通し ✅
- [x] ADR-007: Trace as the Evaluation Boundary ✅ (5/22)
- [x] event.schema に traceId/turn 追加 ✅ (5/22, P0.1)
- [x] TraceRecord型定義 ✅ (5/22, P0.2)
- [ ] `stira simulate` CLI 実装
  - persona.json + stimuli.jsonl を入力
  - TraceRecord[] をJSONL出力（パラメータ時系列 + breaker/drift）
  - breaker発動時にログ出力
- [ ] ADR-005: Time Source & Decay Semantics（テストで時間注入可能に）
- [ ] README に最小コード例（5行）追加
- [ ] README にインストール方法追加

## Phase 0.5 — 安全機構

- [ ] ADR-002 実装: Breaker Recovery Path
  - warn = auto-recovery (hysteresis)
  - block = manual reset
- [ ] `resetMode` / `hysteresis` フィールド追加（spec + types）
- [ ] ADR-004: Schema Versioning & Migration policy
- [ ] ADR-006: Canonical Stimulus Categories（category語彙管理）

## Phase 1 — 公開準備

- [ ] GitHub public リポ作成（`Resolver-TNG/stira`）
- [ ] CI（GitHub Actions: lint + test）
- [ ] npm publish 可能な状態にする
- [ ] simulate出力の簡易webビューア（パラメータ時系列グラフ）
- [ ] テスト人格追加（7-10体目標: pathological case, quickly-drifts等）
- [ ] docs/ index に「読者別の入口」追加

## Phase 1.5 — PersonaArena統合 + 差別化 (NEW 5/22)

> PersonaArena (arXiv:2605.17044) を参考に、評価バックエンド + キャリブレーションを実装

- [ ] `stira eval` CLI実装 (simulate → adapter → judge → report)
- [ ] `adapters/personaarena/` — TraceRecord[] → PA入力変換 + 相関レポート
- [x] `bcWindow` native metric (ADR-008: 高速プロキシ) ✅ 実装済(5/22)
- [x] ADR-008: Native vs External Metrics ✅ (5/22)
- [x] ADR-009: DPO Export Pathway (fence) ✅ (5/22)
- [ ] `100-turn-social.jsonl` 制作 (60低+25中+10高+5矛盾)
- [ ] **100ターンBC比較実験** — Stira制御 vs ベースライン（GTCデモのヘッドライン）
- [ ] 相関テーブル: bcWindow ↔ PA-BC の r値算出

## Phase 2 — 実証

- [ ] 自分の環境（OpenClaw）で実運用開始
- [ ] drift検出の実データ収集
- [ ] Claude Code adapter 実動確認
- [ ] `stira calibrate` CLI (N personas × M stimuli → 相関マトリクス)
- [ ] UGC-1k personas import tooling (offline, LLM-assisted)
- [ ] Multi-judge harness (PA §3.3 debate protocol)
- [ ] 記事化（Qiita or Zenn: 「エージェントの人格driftを数値で追う」）

## Phase 3 — 拡張

- [ ] GTC Taipei / re:Invent でデモ可能な状態
- [ ] 理論論文との接続（参照実装としてのポジション）
- [ ] コミュニティ向け persona 投稿テンプレ

---

## 開発フロー

```
マスター（方針・最終判断）
    ↓
Resident AI（一貫性・指向性・設計・レビュー）
    ↓ ACP
Transient AI（ステートレス・実装・使い捨て）
```

詳細: [docs/development-model.md](docs/development-model.md)

## 判断済み事項

| 判断 | 決定 | ADR |
|---|---|---|
| Engine は LLM を呼ばない | Accepted | 001 |
| Breaker は固定コアのみ | Accepted | — |
| Single-writer file-based | Accepted | 003 |
| Breaker recovery: warn=auto, block=manual | Proposed | 002 |
| Matrix baseline は不変 | Accepted | — |
| Schema v0.x は破壊的変更あり。version不一致で拒否 | Accepted | 004 |
| Breaker発火時: engineは返すだけ、停止はadapter | Accepted | 005 |
| Phase 1 は CC のみ。Kiro は Phase 2 | Accepted | — |
| Resident AI = 「判断の半減期が長いもの全て」 | Accepted | development-model.md |
| Transient AI = 「再現可能で半減期が短いもの」 | Accepted | development-model.md |
| 「心のモデル」ではなく「制御面」 | Accepted | philosophy.md |
| 概念説明は薄く。断定しない | Accepted | README tone |
| 特定エージェント固有要素は含まない | Accepted | — |
| TraceRecord[]が外部評価との契約面 | Accepted | 007 |
| Native metricはLLM不使用、Externalはadapter経由 | Accepted | 008 |
| DPOはv0.3+。早期PRは拒否 | Proposed | 009 |
| PersonaArenaはhard dependencyにしない | Accepted | 007 |

## Opus 4.7 レビュー要約（3ラウンド）

**1行評価（Opus 4.7）:**
> 「人格 drift を、観測可能な状態遷移として外部化する制約エンジン。」

**残課題:**
1. 動くデモ（simulate CLI）
2. ACP向けADR追加（time source, versioning, category語彙）
3. TASK_TEMPLATE強化（spec不可侵、エスケープハッチ）← 済

---

_次の一手: Phase 0 を ACP 委任で回す。_
