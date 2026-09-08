# Asset management implementation plan

**Goal:** Maintain an auditable inventory and reproducible runtime atlas without growing the JS13K submission with development metadata.

**Architecture:** A development-only JSON manifest records each file's role, provenance, license notes, relationships, and runtime frame contract. Node tools inspect files, generate the embedded atlas module, check drift, and build a local visual catalog. The existing Canvas renderer consumes only generated constants.

**Constraints:** No new dependencies. ZIP limit remains 13,312 bytes. Preserve existing image bytes and gameplay. Do not infer missing authorship or license evidence. Keep source/reference originals and generated reports out of the submission. Work in the requested current project; no publishing or commits are part of this request.

- [x] Add asset validation tests using isolated temporary repositories: missing/unregistered files, duplicate IDs, invalid relationships, frame mismatch, byte budget, generation drift, and PNG transparency analysis.
- [x] Implement manifest auditing and deterministic generation. Move the existing compact atlas to `assets/runtime/`; generate `src/generated/assets.mjs`; keep the public art exports compatible.
- [x] Integrate checks with build and tests, and generation with the development server. Verify the actual sprite drawing branch as well as the existing geometry fallback.
- [x] Add a local searchable catalog with source/license information, image previews, frame animation, and audit findings. Keep its generated HTML/JSON under ignored `reports/assets/`.
- [x] Inspect the catalog and runtime in a browser, document measured findings and prioritized improvements, and run the complete tests/build. Compare the final ZIP against the 12,767-byte baseline.

The design deliberately uses repository files plus a CLI. Documentation alone would not catch drift; an external media service would add deployment and network dependencies without helping a single-file offline game.
