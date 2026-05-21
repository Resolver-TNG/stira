# References

Papers and research that informed this design. Listed as context, not as claims of correctness.

---

## Emotion Representations in LLMs

**Sofroniew et al. (2026)** — "Emotion Concepts and their Function in a Large Language Model"
- arXiv: [2604.07729](https://arxiv.org/abs/2604.07729)
- Anthropic Interpretability team. Found 171 "functional emotion" representations in Claude Sonnet 4.5 that causally influence behavior.
- Key finding: emotion vectors are *locally scoped* (track operative emotion at each token, not persistent state). They drive preferences, reward hacking, sycophancy.
- Geometry mirrors human valence/arousal circumplex.
- **Relevance to Stira:** Validates that LLMs have internal emotion-like machinery worth externalizing as a control surface. Our matrix design echoes the valence×arousal structure they found internally.

**arXiv:2604.13466** — "Functional Emotions or Situational Contexts? A Discriminating Test"
- Counter-hypothesis: emotion vectors may be projections of richer *situational context* structures onto human emotional axes, not emotions per se.
- **Relevance:** We don't claim Stira models "real emotions." It's a control surface — whether the underlying mechanism is emotional or situational doesn't change the utility.

---

## Emotion Transcription

**UEC Inaba Lab (2025)** — "Emotion Transcription in Conversation (ETC)"
- 電気通信大学 稲葉研究室
- Dataset: [github.com/UEC-InabaLab/ETCDataset](https://github.com/UEC-InabaLab/ETCDataset)
- Proposed natural-language description of speaker emotions as a task, instead of discrete categories or dimensional values.
- **Relevance to Stira:** Our `transcription` field (natural language state description) is directly inspired by ETC. Numeric params alone miss nuance; free-text transcription captures what numbers can't.

---

## Persona & Alignment

**Hu, Rostami, Thomason (2026)** — "Expert Personas Improve LLM Alignment but Damage Accuracy" (PRISM)
- arXiv: [2603.18507](https://arxiv.org/abs/2603.18507)
- Expert persona prompts improve alignment tasks (+17.7% JailbreakBench) but hurt discriminative accuracy (MMLU -3.6%).
- PRISM: intent-based gated LoRA routing — activate persona only where it helps.
- **Relevance:** Personas have measurable behavioral effects. Stira's breaker = "when persona behavior becomes pathological, gate it off." Same routing logic, different layer.

---

## Personality in Agents

**Fujiyama et al. (2025)** — "Personality Emergence in LLM Agents Reflecting Needs through Interaction with the Environment"
- 電気通信大学 大須賀研究室 (UEC Ohsuga Lab)
- IEEE CCET 2025
- LLM agents develop personality traits through environmental interaction.
- **Relevance:** Personality isn't just injected — it emerges and drifts. Stira's drift detection addresses this: tracking when emergence becomes instability.

**Klinkert et al. (2024)** — "Driving Generative Agents With Their Personality"
- arXiv: [2402.14879](https://arxiv.org/abs/2402.14879)
- Psychometric values (Big Five) driving NPC behavior in games via Affective Computing systems.
- **Relevance:** Demonstrates parametric personality models work for behavioral steering. Stira generalizes this pattern beyond games.

---

## Practical Observation

**Context-limit drift detection via tone:**
- When an agent has a defined communication style (tone, verbal tics, formality level), context window exhaustion manifests as *style degradation* before factual errors appear.
- A well-defined persona acts as a canary — tone drift is the earliest observable signal that the agent is losing coherence.
- **Relevance to Stira:** This is a practical benefit of maintaining behavioral parameters. Stability decay correlates with observable tone changes, giving operators an early warning system that pure capability metrics miss.

---

## Design Lineage (not direct references)

- Russell's Circumplex Model of Affect (valence × arousal)
- Plutchik's Wheel of Emotions (categorical structure)
- Cowen & Keltner (2017) PNAS — 27 emotion categories, empirical dissimilarity matrices
- BDI (Belief-Desire-Intention) agent architectures (Rao & Georgeff, 1995)
- Affective Computing (Picard, 1997, MIT Media Lab)

---

_These are inputs, not authorities. The implementation is what matters._
