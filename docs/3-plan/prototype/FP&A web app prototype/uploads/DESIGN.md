---
name: Executive Precision
colors:
  surface: '#f7f9ff'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ee'
  surface-container-highest: '#e0e2e8'
  on-surface: '#181c20'
  on-surface-variant: '#3f484f'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eff1f6'
  outline: '#707880'
  outline-variant: '#bfc7d1'
  surface-tint: '#006492'
  primary: '#006492'
  on-primary: '#ffffff'
  primary-container: '#0d7eb5'
  on-primary-container: '#00050c'
  inverse-primary: '#8bceff'
  secondary: '#456179'
  on-secondary: '#ffffff'
  secondary-container: '#c5e3ff'
  on-secondary-container: '#49667d'
  tertiary: '#875200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a96802'
  on-tertiary-container: '#0a0400'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cae6ff'
  primary-fixed-dim: '#8bceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004b6f'
  secondary-fixed: '#cae6ff'
  secondary-fixed-dim: '#accae5'
  on-secondary-fixed: '#001e30'
  on-secondary-fixed-variant: '#2c4a60'
  tertiary-fixed: '#ffddba'
  tertiary-fixed-dim: '#ffb866'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#f7f9ff'
  on-background: '#181c20'
  surface-variant: '#e0e2e8'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  data-density-tight: 8px
  data-density-comfy: 16px
---

## Brand & Style
The design system is engineered for high-stakes financial environments where precision, trust, and clarity are paramount. The brand personality is **Authoritative, Methodical, and Transparent**, catering to FP&A professionals who require rapid data synthesis without cognitive overhead.

The visual style is **Corporate Minimalism**—a structured approach that prioritizes data density and hierarchy. It draws inspiration from "terminal-style" efficiency but applies a modern, refined layer of whitespace and systematic alignment. The goal is to evoke the reliability of legacy financial institutions with the seamless UX of modern SaaS fintech.

## Colors
This design system utilizes a professional, precision-oriented palette.
- **Primary & Secondary:** A specialized azure blue (`#0D7EB5`) and slate blue-grey (`#5D7A92`) provide a "Trusted Tech" foundation, used for core navigation, primary actions, and structural headers.
- **Accent & Tertiary:** A deep amber-bronze (`#AB6A05`) is used for tertiary accents, drawing attention to specific data highlights or callouts without breaking the corporate aesthetic.
- **Financial Status:** Semantic colors are calibrated for legibility. Success emerald, alert crimson, and warning amber are used exclusively for data status (variances, risk flags, and performance indicators).
- **Surface Strategy:** The system uses a neutral slate-grey base (`#74777C`) to derive its surface tokens, creating a cohesive atmosphere that reduces glare during long-form data analysis.

## Typography
Typography is the backbone of this design system, optimized for **tabular data and numerical precision.**
- **Headlines:** IBM Plex Sans offers a technical yet approachable structure for page titles and section headers.
- **Body:** Inter is used for general UI and descriptions due to its exceptional legibility at small sizes.
- **Numerical Data:** JetBrains Mono (monospaced) is strictly enforced for all currency values, percentages, and table cells. This ensures that decimal points align perfectly in vertical columns, facilitating faster scanning of financial reports.
- **Labels:** Use all-caps labels with slight tracking for metadata and table headers.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The sidebar navigation is fixed (240px), while the main content area utilizes a 12-column fluid grid to maximize the visibility of expansive data tables.

- **Data Density:** Use a 4px base unit. For high-density financial grids, use `data-density-tight` (8px) for cell padding. For dashboard views and KPI cards, use `data-density-comfy` (16px).
- **Breakpoints:** 
  - Desktop: 1440px+ (Primary target for FP&A workflows)
  - Tablet: 1024px (Cards stack, tables gain horizontal scroll)
  - Mobile: 375px (Condensed KPI view, simplified navigation)

## Elevation & Depth
This design system avoids heavy shadows to maintain a clean, "flat" professional look. Depth is conveyed through **Tonal Layering and Low-Contrast Outlines.**

- **Level 0:** Background based on Neutral Slate (`#74777C`).
- **Level 1:** Content Cards and Data Grids (`#FFFFFF` with a 1px subtle outline).
- **Level 2:** Modals and Popovers. Use a very subtle, diffused shadow to differentiate overlays from the main workspace.
- **Interactive:** Hover states on rows and buttons should use a subtle wash rather than a shadow "lift."

## Shapes
In line with the "Enterprise Pro" aesthetic, shapes are **Soft but Geometric.** A 4px (`rounded-sm`) radius is the standard for almost all elements (buttons, inputs, cards). This creates a modern feel without appearing too "consumer-oriented" or playful.

- **KPI Cards:** Use a consistent 4px radius.
- **Search Bars:** Follow the same 4px radius; avoid pill shapes to maintain the structured, architectural feel of the application.

## Components
- **Data Tables:** The core component. Feature sticky headers, zebra striping (subtle), and monospaced font for cells. Variance cells should use background tints (soft green/red) rather than just colored text for better visibility.
- **KPI Cards:** Include a primary metric, a comparison percentage, and a miniature sparkline. Sparklines should use a 2px stroke width in the primary blue.
- **Buttons:** 
  - *Primary:* Solid azure blue (`#0D7EB5`) with white text.
  - *Secondary:* Outline with secondary slate-grey.
  - *Action:* High-density icon-only buttons for table row actions.
- **Filters:** Horizontal filter bar above tables using "Button Group" style toggles and dropdowns with clear selection counts.
- **Inputs:** High-contrast borders that darken on focus. Use "Helper Text" below fields for financial validation rules.
- **Financial Charting:** Use a standardized palette for charts (`primary blue`, `chart-purple`). Avoid gradients in bar charts; use solid fills to maintain the minimalist aesthetic.