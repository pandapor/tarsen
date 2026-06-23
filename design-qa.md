# Tarsen design QA

- Source visual truth: `/Users/subadimir/Library/Caches/com.apple.SwiftUI.Drag-2ADAC209-0222-4FC7-9CFD-8A8419002BD7/ChatGPT Image 23 июн. 2026 г., 20_12_45.png`
- Implementation screenshot: `/Users/subadimir/Desktop/tarsen/tarsen-preview.png`
- Comparison board: `/Users/subadimir/Desktop/tarsen/design-comparison.jpg`
- Viewport: 1055 px desktop; responsive spot-check at 390 × 844
- State: landing page, default state

## Full-view comparison evidence

The implementation follows the selected reference's composition: floating rounded header, left-aligned developer-tool hero, dark terminal on the right, small integration badges, violet command CTA, three feature cards, a split benefit/terminal section, and a restrained footer. Tarsen-specific security content intentionally replaces Preflight's deployment content. The additional compact agent section reflects the PRD and keeps the same spacing and typography system.

## Focused comparison evidence

Focused checks covered the hero and terminal because they carry the product identity. Their grid proportions, dark terminal contrast, violet accent, monospace hierarchy, and rounded/shadow treatment match the source direction. Icons use Phosphor rather than handmade graphics. There are no photography or illustration assets in the source that require generation.

## Required fidelity surfaces

- Fonts and typography: geometric system/Geist-compatible sans with system monospace; headline weight, scale, wrapping and terminal hierarchy match the reference direction.
- Spacing and layout rhythm: header, hero, feature rail, split section, and mobile stacking preserve the source's generous rhythm. Mobile cards and terminal remain readable without horizontal overflow.
- Colors and tokens: white base, ink text, lavender surfaces, violet actions, dark navy terminal, and semantic red/amber/green signals are consistent and accessible.
- Image and icon fidelity: the source contains interface icons rather than imagery; Phosphor icons are used throughout and no placeholder or CSS-drawn assets remain.
- Copy and content: all visible copy is Tarsen-specific and aligned with the PRD's check-before-run positioning.

## Findings

No actionable P0/P1/P2 mismatches remain. The longer page height is an intentional consequence of the PRD-required AI agent explanation, not visual drift.

## Patches made

- Replaced remote font loading with build-safe local font stacks.
- Preserved the reference's responsive two-column-to-stacked behavior.
- Added functional mobile navigation and install-command copy state.
- Kept terminal output legible at the mobile breakpoint.

## Follow-up polish

- P3: replace placeholder GitHub destination and star count when the repository URL is available.

final result: passed
