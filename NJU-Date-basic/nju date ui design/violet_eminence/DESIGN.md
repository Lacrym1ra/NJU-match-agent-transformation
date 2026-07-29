# Design System Document

## 1. Overview & Creative North Star: "The Digital Curator"

This design system is engineered to elevate the dating experience from a transactional "swipe" culture to a curated, editorial journey. The Creative North Star, **"The Digital Curator,"** views each user profile and interaction as a high-end gallery exhibit. 

Unlike standard dating apps that rely on rigid grids and aggressive primary buttons, this system utilizes **intentional asymmetry**, large-scale typography, and layered surfaces to create a sense of breathing room and intellectual depth. We break the "template" look by overlapping elements—such as images bleeding into text blocks—and using a typography scale that demands attention. The goal is to make the user feel like they are flipping through a premium lifestyle magazine, fostering an atmosphere of prestige and serious intent.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule

The palette is anchored by the deep, intellectual NJU Purple (`primary: #420047`), balanced against a sophisticated range of "warm-neutrals" that provide a softer touch than clinical whites.

### The "No-Line" Rule
To maintain a high-end aesthetic, **1px solid borders are strictly prohibited** for sectioning or containment. Boundaries must be defined through:
- **Background Color Shifts:** Placing a `surface_container_low` section atop a `surface` background.
- **Tonal Transitions:** Using subtle shifts in the Material surface tiers to imply structure.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical layers. We use a "Nesting" principle to denote hierarchy:
- **Base Level:** `surface` (#fff8f7) for the primary application background.
- **Level 1 (Sectioning):** `surface_container_low` (#fbf2f1) for large grouped content blocks.
- **Level 2 (Active Cards):** `surface_container_lowest` (#ffffff) for the most interactive elements, creating a "pop" against the lower tiers.

### The "Glass & Gradient" Rule
Floating elements (like navigation bars or action sheets) should utilize **Glassmorphism**. 
- **Application:** Use `surface` with 80% opacity and a `backdrop-filter: blur(20px)`.
- **Signature Texture:** Primary CTAs should not be flat. Apply a subtle linear gradient from `primary_container` (#611066) to `primary` (#420047) at a 135-degree angle to add "soul" and a sense of tactile premium quality.

---

## 3. Typography: Editorial Authority

The typography system pairs the geometric clarity of **Inter** for functional reading with the modern, high-fashion personality of **Manrope** for display moments.

- **Display & Headline (Manrope):** These are the "Editorial" voices. `display-lg` (3.5rem) should be used with tight letter-spacing (-0.02em) to create a bold, authoritative impact on landing screens or profile headers.
- **Title & Body (Inter):** These handle the "Functional" voice. `body-lg` (1rem) is optimized for readability with a generous line-height (1.6) to ensure the interface feels airy.
- **Label (Inter):** Used for micro-copy and metadata. Always in uppercase with slight letter-spacing (+0.05em) when used for categories to reinforce the premium, "curated" feel.

---

## 4. Elevation & Depth: Tonal Layering

We move away from traditional drop shadows in favor of **Tonal Layering**, creating a "soft-touch" interface that feels integrated rather than floating.

- **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` card placed on a `surface_container_high` background provides all the visual affordance needed for "lift" without the clutter of shadows.
- **Ambient Shadows:** When a floating effect is non-negotiable (e.g., a "Send Message" FAB), use an **Ambient Shadow**:
  - `box-shadow: 0 12px 32px rgba(66, 0, 71, 0.06);` (a subtle tint of the primary color).
- **The "Ghost Border" Fallback:** For accessibility in high-glare environments, use a "Ghost Border": `outline_variant` at 15% opacity. Never use 100% opaque outlines.
- **Backdrop Blurs:** Use `surface_variant` at 40% opacity with a blur for modal overlays, ensuring the user never loses the context of the "layer" beneath.

---

## 5. Components: Softness & Sophistication

### Buttons
- **Primary:** Gradient-filled (`primary_container` to `primary`), `xl` (3rem) corner radius. Use `on_primary` for text.
- **Secondary:** `surface_container_highest` background with `primary` text. No border.
- **Tertiary:** Purely typographic using `primary` color, emboldened weight, with a `sm` (0.5rem) padding for a soft hover state.

### Cards & Lists
- **The Divider Rule:** Forbid the use of horizontal divider lines. Use `spacing-6` (2rem) of vertical white space or a subtle background shift to `surface_container_low` to separate items.
- **Profile Cards:** Utilize the `lg` (2rem) corner radius. Images should have a subtle inner-shadow to "inset" them into the card surface.

### Inputs & Selection
- **Input Fields:** Use `surface_container_high` backgrounds with no borders. Focus state is indicated by a "Ghost Border" of `primary` at 20% opacity and a subtle growth in the background's tonal depth.
- **Chips:** Filter chips use `surface_container_lowest` with `secondary` text. Selected states flip to `secondary_container` background.
- **Checkboxes/Radios:** Softened geometries. Radios use a thick `primary` ring with a `surface` inner-gap to ensure they look bespoke rather than browser-default.

### Additional Premium Components
- **The Curator Timer:** A custom countdown component for "Weekly Reveals," utilizing `display-sm` typography and semi-transparent `primary_fixed_dim` backgrounds.
- **Smooth-Scroll Profile Reveal:** A custom interaction component where profile details "slide up" over the profile image using a parallax effect and `backdrop-blur`.

---

## 6. Do's and Don'ts

### Do
- **Do** use white space as a structural element. If an interface feels "empty," increase the typography size rather than adding lines.
- **Do** lean into the `xl` (3rem) border radii for large containers to maintain the "soft and friendly" brand promise.
- **Do** use the `on_surface_variant` for secondary text to ensure a soft, low-contrast (but accessible) editorial feel.

### Don't
- **Don't** use pure black (#000000) or pure grey. Always use the tinted neutrals (e.g., `on_surface: #1e1b1a`).
- **Don't** use 90-degree corners. Even "sharp" elements must have at least a `sm` (0.5rem) radius.
- **Don't** crowd the edges. Respect the `spacing-6` (2rem) outer margin for all mobile screens to ensure the content feels "presented" on a canvas.