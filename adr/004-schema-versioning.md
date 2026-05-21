# ADR-004: Schema Versioning & Migration

**Status:** Accepted
**Date:** 2026-05-21

## Decision

v0.x の間は schema の破壊的変更あり。後方互換は保証しない。

## Rules

1. 全 JSON ファイル (state, matrix, config) に `version` フィールドを持つ
2. Engine は `version` を確認し、期待値と不一致の場合は処理を拒否する（例外 or error result）
3. 拒否時のメッセージ: 「version mismatch. Run `stira init` to reinitialize.」
4. v1.0 以降で自動 migration (`migrate()` 関数) を検討する
5. README に「v0.x は breaking changes あり」と明記

## Migration Procedure

Version 不一致で拒否される仕様は既に実装済み。ここでは **どのケースで何をするか** の方針を明文化する。

### v0.x → v0.y (within v0.x line)

- **Breaking changes 許可。**
- State file は再生成されなくてはならない：ユーザーは `stira init` で `.stira/` を初期化する。
- 旧 state の保存はオペレーター責任（必要なら手動で `.stira/state.json.bak` に退避）。
- Migration コードは書かない — schema が固まっていない段階での migration は負債になる。

### v0.x → v1.0 (Freeze)

v1.0 リリースさせるための凍結基準（freeze criteria）：

1. **全 Phase 0 テスト pass** — engine/cli/adapters の全ユニットテスト・統合テストが green。
2. **72時間稼働実績** — 実際のエージェント上で 72h 連続で schema エラー・クラッシュなく動作した実績。
3. **必須 ADR 集を全て Accepted** — ADR-001〜005 が Proposed のままの間は freeze しない。
4. **README + spec/SPEC.md** の仕様記述がコードと一致していること。

v1.0 リリース以降は「後方互換を保証する」モードに遷移する。

### v1.x → v1.y (within v1.x line)

- **Additive only.** 既存フィールドの削除・型変更・セマンティクス変更は禁止。
- 新しい **optional フィールド** の追加は OK（デフォルト値を付けることで旧 state と互換）。
- engine は v1.0 と v1.y の state を両方読める：内部でデフォルト補完して処理。
- テストは「旧 fixture を読んでも中身が初期値と一致する」という backward-compat テストを追加する。

### v1.x → v2.0

- **新 ADR 必須。** v2 への移行は migration 関数・タイミング・推奨テストろールバックを ADR で定義してからコードを書く。
- Engine に `migrate(oldState, fromVersion, toVersion)` を導入し、v1.x → v2.0 の変換をテスト付きで提供する。
- v1.x と v2.x は一定期間 (最低 1 minor) 並行サポートし、ユーザーに移行期間を与える。

### Engine の動作マトリクス

| state version | engine v0.x | engine v1.x | engine v2.x |
|---|---|---|---|
| v0 | 処理 (best-effort、不一致で拒否) | 拒否 (init 要請) | 拒否 |
| v1 | 拒否 | 処理 (default 補完あり) | migrate 使用して処理 |
| v2 | 拒否 | 拒否 | 処理 |

「古い engine で新しい state」は常に拒否する—黙ってデフォルトを応用して silent corruption を起こさずに、fail-loud でオペレーターにアップグレードを促す。

## Rationale

- まだ自分しか使っていない
- 後方互換に時間をかける段階ではない
- schema が固まる前に migration コードを書くと、migration 自体がメンテ負債になる
- 一方で v1.0 以降の方針を今明記しておくことで、ユーザーと将来の自分に「いつ、何が凍結されるのか」を示せる

## Consequences

- v0.x ユーザー（= 自分）は breaking change 時に `stira init` で再初期化する
- persona.json は影響を受けない（入力テンプレートであり永続状態ではない）
- v1.0 の凍結後は、フィールド追加は適宜可だが「そのフィールドを静かに削除する」ことはできなくなる — deprecation サイクルを経由して v2.0 で削除する
- v2.0 に進む際には必ず ADR を追加し、migration path を PR レベルでレビューする
