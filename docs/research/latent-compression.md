# 研究ノート: Latent Vector Compression in Stira

**Status:** Research / Draft
**Date:** 2026-05-21
**Author:** subagent (Leva)
**Issue:** #10
**Decision:** **❌ 採用しない（Engine 層）／⚠️ 限定採用可（外部 archival 層のみ）**

---

## 0. TL;DR

| 観点 | 判定 | 理由 |
|---|---|---|
| A. State Vector の embedding 化 | ❌ 不適合 | ブレーカー閾値判定が成立しない。Stira の生命線を破壊する。 |
| B. Matrix の低ランク圧縮（SVD/PCA） | ❌ 不適合 | drift 検出は cell 単位の符号反転を見る。低ランク化で位相崩壊検出が劣化。 |
| C. Event History の binary latent 圧縮 | ⚠️ 限定可 | Engine の入力ではない。**外部 archival** としてなら可。監査証跡を別経路で残す条件付き。 |
| D. ハイブリッド（state は named、history は latent） | ⚠️ 限定可 | C と同義。Engine 境界を越えない範囲のみ。 |
| E. Stira 設計原則との整合性 | — | 「Engine は LLM を呼ばない」「閾値判定は解釈可能」を曲げてまで導入する利得はない。 |

**結論:** マスターの問いへの直接の答えは「**Stira の Engine 層では原理的に不適合。外部の event archive 層であれば adapter 拡張として検討可能だが、Phase 0/1 では着手しない。**」

理由は単純で、Stira は「人格の状態を **解釈可能な閾値で** ブレーキする」ことが存在意義であり、latent ベクター化はその解釈可能性を犠牲にして得るのが「コンテキスト節約」だけ。
**Stira が今コスト問題を抱えていない以上、原則を曲げる根拠がない。**

---

## 1. 背景: なぜこの問いが出るのか

### 1.1 Codex compaction のアナロジー

OpenAI Codex の agent loop には `/responses/compact` という endpoint が存在する。会話履歴を「テキスト要約」ではなく **opaque な暗号化された KV cache のスナップショット** として保存し、再展開する仕組み。テキスト要約に伴う情報損失（"agent2 told agent1 about the file" のような抽象化で詳細が落ちる）を回避する。

arXiv:2602.16284「Fast KV Compaction via Attention Matching」は、注意行列の差を最小化する形で 50× 圧縮を達成。LLM 推論側の KV 削減としては実用域。

これを Stira に当てはめると次の3案が浮かぶ:

1. State vector を embedding に圧縮する
2. Matrix を低ランク基底に圧縮する
3. Event history を binary latent に圧縮する

### 1.2 Stira がコンテキストに載せているもの（現状）

`docs/architecture.md` より、per-turn コストはおおよそ:

- `state.params` — 6〜8 個の key-value（~50 tokens）
- `activeBreakers` — 配列（~20 tokens）
- `transcription`（任意）— ~30 tokens

合計 **100〜150 tokens/turn**。matrix も history も LLM コンテキストには載っていない（外部ファイルから on demand）。

> **重要観察**: Stira は今すでに「コンテキストに載せるのは制御面の最小要素のみ」という設計で十分軽量。**latent 圧縮で削れる余地は構造的にほぼ無い。** これが本研究の結論を支配する。

---

## 2. 観点A: State Vector を embedding に射影する

### 2.1 案

現行: `{stability: 0.85, vigilance: 0.2, trust: 0.7, ...}` — named float params
案: 全状態を 64-dim dense embedding に射影。autoencoder で復元可能にする。

### 2.2 利点

- 拡張性: 新しい param を追加しても embedding 次元は固定
- 表現力: 「named floats では捕えられない param 間の交互作用」を埋め込める可能性
- 圧縮: 仮に 32 params あれば 64-dim float32 で 256 bytes、量子化で更に小さく

### 2.3 致命的欠点

#### (a) ブレーカー閾値判定が成立しない

ADR-005 の契約:

> Engine は `fired` 判定のみ行う。Adapter は active breakers を `state.activeBreakers` に書く。
> `block` breaker が active な間、Adapter はエージェントの自己改変系操作を拒否すべき。

これが回るのは「`stability < 0.3` という解釈可能な単純比較」が成立するから。embedding に圧縮した状態で `stability` を取り出すには decoder LLM/NN が必要で、これは ADR-001（Engine pure functions, no LLM）に正面衝突する。

仮に「embedding から stability 軸への projection を学習済み線形層で行う」としても、その線形層は **学習対象であり、ユーザーが解釈できない**。閾値 0.3 がどの意味を持つかが説明できない時点で「サーキットブレーカー」ではなくなる。

#### (b) 位相崩壊検出の意味が失われる

ADR-006 / SOUL.md v3 の emotion matrix では「同一刺激での連動の符号反転」を位相崩壊リスクと定義する（例: `connection` で `attachment` が **減少** したら警告）。これは named param 軸が固定されているからこそ意味を持つ。embedding 軸はそもそも「軸の意味が学習で決まる」ので、符号反転を人間が監査できない。

#### (c) Stira の存在意義の否定

Stira を philosophy.md から再確認:

> Stira のパラメータは「ナレッジ評価の偏差ベクトル」として機能する。
> `trust` が高い → オペレーターからの情報を高く重み付け
> `vigilance` が高い → セキュリティ関連を厳しく評価

ここで挙げた「軸の意味」は **named だからこそ運用上の意味を持つ**。embedding 化は軸を匿名化する操作で、これは Stira を "general purpose state encoder" に変えてしまう。それは別物のライブラリ。

### 2.4 判定: ❌ 不適合

**根拠:**
- ADR-001（Engine pure）と本質的に矛盾
- ADR-005 のブレーカー契約が成立しない
- philosophy.md の「軸の意味が運用シグナル」を破壊する
- そもそも state は per-turn ~50 tokens であり、圧縮の経済合理性が無い

---

## 3. 観点B: Matrix の低ランク圧縮（SVD/PCA）

### 3.1 案

6×6（最低）〜 N×M の matrix を SVD で低ランク基底に分解。
`matrix ≈ U_k Σ_k V_k^T` で k 次元基底に圧縮。
- ペルソナ間の補間が線形空間で可能になる（"persona1 と persona2 の中間"）
- ストレージ削減

### 3.2 利点

- ペルソナ補間: `matrix_blend = α * matrix_A + (1-α) * matrix_B` を低ランク空間で計算
- ノイズ除去: PCA で「主要な反応軸」が浮かび上がる可能性
- 共有可能性: 主要基底が共通なら "Stira persona zoo" の検索が早い

### 3.3 致命的欠点

#### (a) drift 検出が劣化する

`detectDrift()` は **cell 単位の絶対偏差** と **符号反転** を見る（spec に明記）。低ランク再構成された matrix は cell 値が滑らかに「歪む」ため:

- 元 matrix で `[connection][attachment] = 0.9` だった cell が再構成で `0.85` になる
- これは drift detection の閾値（例: ±0.5）には引っかからないが、**累積すると baseline からじわじわ離れる**
- baseline 自体を低ランク化していないと比較軸が一致しない
- 低ランク化すると「baseline immutable」(ADR + architecture.md) の意味も曖昧になる

#### (b) 位相崩壊検出の解像度低下

符号反転は cell 単位の現象。低ランク基底空間では「ある基底軸の係数符号反転」となり、これが「どの (category, param) cell の反転に対応するか」は decompose しないと分からない。Stira の警告メッセージとしては「人格の何が壊れたか」を言えなければ価値が無い。

#### (c) 編集可能性の喪失

matrix.json は **人間が直接編集する想定**（personas/*.json として手書きで配布される）。SVD 表現は人間に編集不能。`personas/restless-scout.json` を「`threat` の `vigilance` を 0.8 に上げたい」というユースケースが破綻する。

### 3.4 比較的マシな部分案: 「展開形 + キャッシュ」

matrix 自体は cell 形式で保持、drift 検出のために PCA basis を **キャッシュ**として持つのは可能（マスターの観点D に近い）。
ただしこれは「圧縮」ではなく「補助インデックス」であり、コスト削減効果は無い。

### 3.5 判定: ❌ 不適合

**根拠:**
- drift 検出（spec 明記の機能）が機能劣化
- 位相崩壊の cell-level 識別が失われる
- matrix は人間編集前提（philosophy.md の「行列の自動学習はやらない」と整合）
- そもそも matrix は LLM コンテキストに載っていない（on demand load）。圧縮の経済合理性がない

---

## 4. 観点C: Event History の binary latent 圧縮

### 4.1 案

`events.jsonl`（append-only audit trail）を、Codex compaction のアナロジーで:
- N 件溜まった event sequence を 1 つの **opaque latent blob** に圧縮
- 「直近 K 件は raw、それ以前は latent」階層構造
- 必要時に decoder で再展開して analytics（drift 分析、persona tuning）に使う

### 4.2 利点

- ストレージ削減（events.jsonl が無限に膨らむ問題への対策）
- latent 空間での「直近の感情軌跡」に対する類似検索が可能になるかもしれない
- analytics 用途として面白い

### 4.3 評価ポイント

ここが3観点中で**唯一筋がある**。理由:

- event history は **Engine の入力ではない**（Engine は applyEvent で 1 イベントずつ処理する。history を読まない）
- LLM コンテキストにも載らない（per-turn cost に history は不在）
- ADR-001（Engine pure）に抵触しない（圧縮は archival 層の責務）

### 4.4 ただし注意点

#### (a) 監査証跡の保証

ADR-006 で `rationale` フィールドを必須化している:

> `rationale` を必ず埋める — adapter が「なぜこの category にしたか」を 1 行残すこと。

これは **可読の自然言語** である必要がある。latent に潰した時点で「後から persona drift を分析する際の最重要シグナル」が opaque になる。

→ 妥協案: latent blob と同時に **plain-text rationale だけは別ストレージに残す**（low-cost、高情報密度）。

#### (b) 不可逆性のリスク

decoder が壊れた／model 更新で latent space が変わった場合、過去の event を完全に失う。jsonl は半永久的に grep できる。「人格の歴史」を opaque に潰すのは取り返しがつかない。

→ 階層化必須: Tier 0 (last 30days raw) / Tier 1 (last 1y compressed) / Tier 2 (older latent + plain-text rationale)。

#### (c) Engine が触ってはいけない

Engine が「圧縮された history を解凍する」コードを持った瞬間 ADR-001 違反。圧縮/解凍は **adapter 層またはオフライン CLI ツール** の責務。

### 4.5 判定: ⚠️ 限定採用可

**条件:**
1. **Engine 層には触らない。** 純関数性は維持。
2. `events.jsonl` の Tier 0（raw 直近）は必ず残す。
3. plain-text `rationale` はどの Tier でも別経路で保持。
4. CLI ツール（例: `stira archive compress --older-than 1y`）として Phase 2 以降に検討。
5. v0.x freeze 基準（ADR-004）を満たすまでは着手しない。**Phase 0 では絶対にやらない。**

**着手優先度:** 低。`events.jsonl` が GB オーダーになって初めて検討する話。Phase 0/1 では non-issue。

---

## 5. 観点D: ハイブリッドアプローチ

### 5.1 案

- State 本体: named params 維持（ブレーカー可読性）
- `transcription` フィールド: latent
- Matrix: human-editable 展開形 + latent キャッシュ
- History: latent 圧縮

### 5.2 評価

実質「観点A/B を捨て、観点C のみ採用する」と同じ構造。

#### transcription の latent 化について

state.schema.json の `transcription` は LLM が生成した自然言語の状態記述。これを latent にする案だが、

- transcription は **per-turn コンテキストに乗せる目的** で導入された（~30 tokens）
- latent にしたらそれを **LLM が読み戻すために decoder pass が必要**
- 30 tokens を節約するために decoder を呼ぶのはペイしない

→ **transcription は latent 化しない。** 短いテキストのままで十分。

#### Matrix キャッシュについて

「展開形 + latent キャッシュ」は前述の通り **圧縮ではなくインデックス**。drift 検出の高速化用 PCA basis をキャッシュするのはアリだが、これは latent compression の話ではない（最適化の議論）。

### 5.3 判定: ⚠️ 限定採用可（実質 C と同義）

採用するのは history 層のみ。State 本体・matrix・transcription は named/plain text を維持。

---

## 6. 観点E: Stira 設計原則との整合性

### 6.1 抵触する原則

| 原則 | 出典 | A | B | C |
|---|---|---|---|---|
| Engine は LLM を呼ばない | ADR-001 | ❌ | ❌ | ✅ (adapter 層なら) |
| Engine は pure functions | ADR-001 | ❌ | ❌ | ✅ |
| Breaker は固定コアの解釈可能閾値 | ADR-005, SPEC | ❌ | — | ✅ |
| Baseline matrix は immutable | architecture.md | — | ❌ | — |
| Drift detection は cell-level | spec/SPEC.md | — | ❌ | — |
| 行列の自動学習はやらない | philosophy.md | — | ❌ (近い) | — |
| 「何が起きてるか分からないけど安全」は思想に反する | philosophy.md | ❌ | ❌ | ⚠️ |

### 6.2 思想面の核心

`philosophy.md` より:

> Stira は「LLM に感情がある」とは主張しない。パラメータは **制御面 (control surface)** であり、内面のモデルではない。

「制御面」が制御面たる条件は **オペレーターが状態を見て・触れる** こと。latent 化は「制御面を opaque にする」操作で、これは Stira を制御面ではなく **black-box state encoder** に変質させる。

> やらないこと: 行列の自動学習（入れた瞬間にテスト不能になる）

低ランク圧縮や autoencoder 化は「学習を入れる」と等価。同じ理由で却下。

### 6.3 Adapter 層では？

ADR-001 は Engine の制約。Adapter 層の自由度は高い。

- LLM ベースの categorization（既に許容）
- archival 層での latent compaction（観点C で条件付き許容）
- transcription 生成時の latent 操作（理論上可だが実益なし）

**Engine 層では NG。Adapter/archival 層でのみ条件付き OK。**

---

## 7. 結論

### 7.1 マスターの問いへの答え

> 「テキストじゃなくて潜在空間のベクター表現でバイナリ圧縮を Stira に組み込むことは可能か？」

**回答:**

> **Stira の Engine 層では不適合。Adapter/archival 層であれば限定的に可能だが、Phase 0/1 では着手すべきでない。**

理由を3行で:

1. Stira の存在意義は「**解釈可能な軸でのブレーカー**」であり、latent 化はこれを破壊する。
2. Stira は per-turn コンテキストコストが構造上既に最小（~150 tokens）で、**圧縮で得る経済合理性が無い**。
3. Codex compaction は「LLM 推論」のための仕組み。Stira は「LLM の外に置いた制御面」であり、解くべき問題が違う。

### 7.2 ADR 化する場合の根拠（雛形）

> **ADR-007 (Proposed): No Latent Compression in Engine Layer**
>
> **Decision:** Engine 層では state vector / matrix / transcription を latent ベクターに圧縮しない。
>
> **Rationale:**
> - ブレーカーは固定コアの解釈可能閾値で発火する（ADR-005）。latent 化は閾値判定の意味を破壊する。
> - drift 検出は matrix cell の絶対偏差・符号反転を見る。低ランク化で解像度が落ちる。
> - 制御面は人間が読み書きできることが要件。latent 化は制御面を opaque box に変質させる。
> - per-turn コンテキストコストは既に最小（~150 tokens）。圧縮の経済合理性が無い。
>
> **Scope:** Engine 層のみ。Adapter / archival ツールでの event history latent 化は将来 ADR で別途検討する。

### 7.3 採用する場合のスコープ（観点C のみ）

将来 events.jsonl が肥大化したときに限り:

- CLI: `stira archive compress --older-than <duration>`
- Tier 0 (raw, last 30d) / Tier 1 (compressed jsonl.gz, last 1y) / Tier 2 (latent blob + plain-text rationale)
- Engine からはアクセス不可（archival は Engine と疎結合）

これは「latent compression」というより **アーカイブ戦略** であり、本研究の主題（state/matrix の latent 化）とは別問題。

---

## 8. 代替案: Stira のコンテキストコスト問題を解く別ルート

そもそも Stira はコンテキストコスト問題を抱えていないが、将来の備えとして:

### 8.1 Event History の運用整理

| 手法 | 効果 | 副作用 |
|---|---|---|
| **Append-only + 期間ローテーション** | events.jsonl を月単位 split、古いものは gzip | テキスト維持なので grep 可能。最も低リスク |
| **Rationale-only retention** | latent 圧縮の代わりに「rationale 文字列だけ残す」 | 構造化情報は失うが監査は可 |
| **Histogram aggregation** | 月単位で `category × param` の発火頻度を集計 | persona drift 分析向け。サイズ激減 |

→ **推奨: 期間ローテーション + 月次 histogram**。latent compression は不要。

### 8.2 State の delta-encoding

state.json は full snapshot だが、cron decay は連続的なので:

- 主要なログ: events.jsonl への適用結果
- 中間状態: 直前 state からの **delta（差分）** だけ events.jsonl に書く

これでログサイズは確実に減る。すでに events.jsonl には event しか書いていないので、これは「state snapshot を頻繁に書かない」運用ガイドラインで足りる。

### 8.3 Transcription の TTL 化

`transcription` は LLM 生成の自然言語。鮮度が落ちると無価値（古い気分の説明は誤解の元）。

- 24h より古い transcription は state.json から削除
- 必要時に再生成

これでコンテキストコスト面の永続的肥大化を防げる（本来 ~30 tokens なので問題化はしないが）。

### 8.4 結論: Stira はそもそも軽い

これらの代替案も「**不要だが備えとして書ける**」レベル。Stira の per-turn cost は ~150 tokens、events.jsonl は通常運用で MB オーダー。
**最適化の前に、最適化が必要かを問う**段階。Phase 2 以降の運用実績を見てから動けばよい。

---

## 9. 補遺: なぜ Codex は latent compaction が要るのか

Codex agent loop は:

- 数百〜数千ターンの multi-agent 協調
- KV cache が GB オーダーまで膨らむ
- LLM 推論時の attention 計算コストが context length に二乗で効く

これに対し Stira は:

- 1 turn あたり数百 tokens の制御面情報
- LLM 推論には Stira は介入しない（あくまで外側の状態管理）
- 増えるのは events.jsonl のディスク使用量だけ（推論コストには影響しない）

つまり「**Codex は推論計算コスト**」「**Stira はディスク容量**」を相手にしており、latent compaction が刺さる軸が違う。同じ手法を借りる動機が薄い。

---

## 10. 参考資料

- arXiv:2602.16284 — Fast KV Compaction via Attention Matching
- OpenAI Codex agent loop — `/responses/compact` endpoint (商用実装)
- arXiv:2604.07729 — Emotion Concepts in LLMs (Anthropic Interpretability)
- Stira: ADR-001 (Engine pure functions)
- Stira: ADR-005 (Breaker Adapter Contract)
- Stira: ADR-006 (Canonical Stimulus Categories)
- Stira: docs/philosophy.md
- Stira: docs/architecture.md（per-turn コスト ~150 tokens の根拠）

---

## 11. Open Questions（マスター判断待ち）

1. **archival 層の latent 化** を将来 ADR-008 として書き起こすか？（Phase 2 以降の検討事項として ROADMAP に置くだけでも可）
2. **events.jsonl の rotation 戦略** を ADR-007 として先に固めるか？（こちらの方が実害が先に来る）
3. 本ドキュメントを **ADR-007 (Rejected): Latent Compression in Engine** として正式 ADR 化するか？それとも research/ 配下のメモのままで保留するか？

---

_— 「臭い狐」、結論を曲げない。原則を曲げてまで latent に潰す価値は、今の Stira には無い。_
