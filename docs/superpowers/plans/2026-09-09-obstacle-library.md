# 20 obstacle redesign

User-approved scope: recognizable shapes and different ways to cross them, not recolors. Keep the complete silhouette during passage; no hard crop or deletion at the player plane. Keep all seven courses and the 13,312-byte ZIP ceiling.

Art direction: small sculpted skyway toys; indigo outlines, ivory highlight planes, a restrained rainbow accent. Consistent ground markings show collision footprint. Timed hazards display charging progress. Share six physics families, with twenty explicit recipes differing in shape and crossing pattern.

Implementation:
1. Separate historical articulated character renderer from submission sprite renderer; keep a compact visible decoding fallback.
2. Replace cutaway with continuous distance opacity, retaining a visible silhouette through passage.
3. Twenty named obstacle recipes: four crystal structures, four weather hazards, four moving constructs, four gaps, two collapsing surfaces, two launch pads. Use one catalog for course recipes and authoring metadata.
4. Render every catalog entry in the map editor, with usage counts, actual placement links, and crossing guidance.
5. Verify timed/moving bounds and contacts, all seven input-driven routes, continuous rendering, editor previews, and the actual ZIP size.


Completed: 20 recipes deployed across all seven courses; distinct timing and geometry; atlas and placement deep links; continuous opacity without clipping/culling; historical vector renderer excluded from submission. Current ZIP 12,711 bytes. Full input-driven routes validated; visual review and regression results are recorded in docs/stage-design.md.
