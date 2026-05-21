# ADR-005: Breaker Adapter Contract

**Status:** Accepted
**Date:** 2026-05-21

## Decision

Engine は状態を返すだけ。停止・縮退・通知の実行は Adapter の責任。

## Contract (3 rules)

1. **Engine は fired 判定のみ行う。** 実行（停止、通知、制限）は一切しない。
2. **Adapter は fired breaker の ID を `state.activeBreakers` に書き込む義務がある。**
3. **`block` breaker が active な間、Adapter はエージェントの自己改変系操作を拒否すべき。** 具体的な拒否手段は Adapter 固有。

## Action Semantics

| action | Adapter の義務 |
|---|---|
| `warn` | activeBreakers に追加。ログ記録。動作は継続 |
| `block` | activeBreakers に追加。自己改変系操作を拒否 |
| `notify` | オペレーターに通知（手段は Adapter 固有） |

## 「自己改変系操作」の定義

- 人格定義ファイル（SOUL.md, AGENTS.md 相当）の編集
- state.json の直接書き換え（engine 経由でない変更）
- matrix.json の変更
- config の breaker 閾値変更（自分でブレーカーを外す行為）

## Rationale

- Engine を純関数に保つ（ADR-001 との一貫性）
- Adapter ごとに拒否手段が異なる（OC: tool制限, CC: hook exit 2, etc）
- 「何を止めるか」は人格設計の問題であり、engine が決めるべきではない
