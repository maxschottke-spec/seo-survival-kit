# DACH Medical & Health SEO Terms

Compliance reference for German-speaking markets (Germany, Austria, Switzerland). Risk classification for anchor texts, page titles, and content claims on products that touch health/medical territory (mattresses, ergonomic furniture, supplements, wellness, etc.).

**Disclaimer**: This is a SEO compliance guide, not legal advice. For binding rulings under the Heilmittelwerbegesetz (HWG) or Lebensmittel-, Bedarfsgegenstaende- und Futtermittelgesetzbuch (LFGB), consult a qualified lawyer.

## Risk Tiers

### High Risk — Block by Default

Medical effect claims that require substantiation under HWG/LFGB. Do not introduce as new anchor or content claim without explicit approval AND verified substantiation on the target page.

| Term | Reason |
|---|---|
| heilend / heilt | Healing claim — strictly regulated |
| medizinisch empfohlen | Implies medical endorsement |
| aerztlich empfohlen | Implies doctor endorsement |
| von Orthopaeden empfohlen | Implies orthopedist endorsement |
| therapeutisch / Therapie | Therapeutic claim |
| schmerzlindernd | Pain-relief claim |
| lindert Schmerzen | Pain-relief claim |
| gegen Schmerzen | Anti-pain claim |
| gesundheitsfoerdernd | Health-promoting claim (when unsubstantiated) |
| orthopaedisch (as effect claim) | When framed as medical effect, not as product category |
| klinisch erprobt / klinisch getestet | Clinical testing claim |
| heilsam | Healing-related |
| heilfoerdernd | Healing-promoting |
| beugt vor (medical) | Medical prevention claim |

**Multiplier**: x2 to risk points. Requires `compliance_review: required` in Change Plan.

### Medium Risk — Compliance Check Required

Health-adjacent terms that are common in product categories but require careful context. Acceptable as informational/educational framing, problematic as direct product claims.

| Term | Acceptable Context | Problematic Context |
|---|---|---|
| orthopaedisch | Product category name (Shopware category) | Effect claim ("orthopedic mattress heals back pain") |
| Skoliose | Educational content ("info on scoliosis") | Product claim ("scoliosis mattress treats curvature") |
| Bandscheibenvorfall | Educational content | "Cures herniated disc" |
| Rueckenschmerzen | Question/guide context ("which mattress for back pain") | Claim ("relieves back pain") |
| Nackenschmerzen | Educational | Direct claim |
| Wirbelsaeulenprobleme | Educational | Claim |
| Druckentlastung | Product feature explanation | Medical effect |
| ergonomisch (as medical effect) | Product description | Medical wording |
| Pflegebett | Context-dependent (medical care product) | Generic mattress |
| Allergiker | Product category, OEKO-TEX context | Cure for allergies |

**Multiplier**: x2 to risk points. Required: verify the target page substantiates the claim with factual/product-feature explanations, not medical effects.

### Low Risk — Allowed When Factual

Functional, descriptive, and use-case terminology. Allowed without compliance flagging when used factually and not as a health claim.

| Term | Allowed Usage |
|---|---|
| ergonomisch (factual) | "Ergonomic shape" — design, not medical effect |
| komfortabel | Comfort description |
| stuetzend | Support function (mechanical, not therapeutic) |
| druckverteilend (factual) | Product feature, when explained mechanically |
| fuer Seitenschlaefer | Sleep position use case |
| fuer Bauchschlaefer | Sleep position use case |
| fuer hoeheres Koerpergewicht | Body weight range |
| Matratze bis 150 kg | Weight specification |
| punktelastisch | Material property |
| atmungsaktiv | Material property |
| schadstoffgeprueft | Verified certification (OEKO-TEX, etc.) |
| OEKO-TEX zertifiziert | Verified certification |

**No multiplier**. Standard risk points apply.

## Verification Workflow

For every anchor text or content change involving health-adjacent terms:

1. **Classify**: Look up the term in this reference. Note the risk tier.
2. **Check target page**: Does the target page substantiate the claim?
   - For High Risk: must have verifiable substantiation (clinical studies, official endorsements, certifications)
   - For Medium Risk: must use factual/educational framing, not direct medical claims
   - For Low Risk: no additional check needed
3. **Apply multiplier**: x2 to base risk points for Medium and High Risk terms
4. **Flag in Change Plan**:

```json
{
  "compliance_review": "required|recommended|none",
  "medical_terms_detected": [
    {"term": "...", "risk_tier": "high|medium|low", "target_substantiates": true|false|"unknown"}
  ]
}
```

5. **Stop rule**: If High Risk term is being introduced new (not removing/neutralizing) and target page does not substantiate, halt and request explicit approval.

## Recovery Pattern: Neutralizing Risky Anchors

Common pattern from recovery operations: replacing medical/risky anchors with neutral alternatives.

| Risky Anchor | Neutral Alternative | Notes |
|---|---|---|
| Orthopaedische Matratze | Ergonomische Matratze | Mechanical/design framing |
| Heilende Matratze | Stuetzende Matratze | Function, not effect |
| Schmerzlindernde Matratze | Druckverteilende Matratze | Mechanical property |
| Medizinische Matratze | (avoid entirely or be specific) | Too broad |
| Aerztlich empfohlene Matratze | Empfohlene Matratze fuer ... | Remove medical endorsement |

These neutralizations are typically `1-2 risk points` and qualify as `repair_hygiene` changes (see `SEO_CHANGE_GOVERNOR.md`).

## Out-of-Scope

This reference does not cover:
- Food / supplement claims (LFGB) — separate framework
- Cosmetic product claims (Kosmetikverordnung) — separate framework
- Medical devices (MPG/MDR) — separate framework
- Pharmaceutical advertising (HWG full scope) — requires legal review

For these, escalate to qualified legal counsel.

## See Also

- `references/SAFE_LIVE_CHANGE_RULES.md` — Compliance hooks in approval workflow
- `references/SEO_CHANGE_GOVERNOR.md` — Risk point multipliers
- `docs/LIVE_CHANGE_QA.md` — Pre-change compliance checklist
