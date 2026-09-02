# ADR-0010: shadcn/ui Component Library

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog needed a consistent, accessible, and maintainable component library for building the frontend UI. As a music industry application with professional users, the UI needed to be polished, functional, and consistent across all features.

### Problem Statement

We evaluated several UI component library approaches:

1. **Build from Scratch:** Create custom components using Tailwind CSS
2. **Component Library:** Use an existing library (Material UI, Chakra UI, Ant Design)
3. **Headless UI:** Use unstyled components (Radix UI, Headless UI) + Tailwind
4. **shadcn/ui:** Copy-paste Radix-based components with Tailwind styling
5. **Tailwind UI:** Purchase Tailwind's official component library

Our requirements:
- **Consistency:** Uniform look and feel across the application
- **Accessibility:** WCAG 2.1 AA compliance
- **Customization:** Ability to match our brand identity
- **Type Safety:** Full TypeScript support
- **Maintainability:** Easy to update and extend
- **Developer Experience:** Productive and intuitive to use
- **Performance:** Minimal bundle size impact
- **Documentation:** Good learning resources and examples

### Constraints

- Must work with React 18+ and TypeScript
- Must integrate with Tailwind CSS (our styling choice)
- Must support custom theming (brand colors, typography)
- Must be license-compatible (open-source or affordable)
- Must have good community support
- Must be actively maintained

---

## Decision

**We chose [shadcn/ui](https://ui.shadcn.com/) as our component library, using it as a foundation of copy-paste components built on Radix UI and styled with Tailwind CSS.**

### Implementation

1. **Core Philosophy:**
   - Components are copied into our codebase (not installed as npm packages)
   - We own the components, can modify them freely
   - Built on Radix UI (unstyled, accessible primitives)
   - Styled with Tailwind CSS
   - Extended with our own custom components

2. **Setup:**
   ```bash
   # Add shadcn/ui to project
   npx shadcn-ui@latest init
   
   # Add individual components
   npx shadcn-ui@latest add button
   npx shadcn-ui@latest add dialog
   npx shadcn-ui@latest add table
   ```

3. **Component Structure:**
   ```
   src/components/
   ├── ui/                    # shadcn/ui components
   │   ├── button.tsx
   │   ├── dialog.tsx
   │   ├── input.tsx
   │   ├── table.tsx
   │   └── ...
   │
   ├── admin/                # Admin console components
   ├── onboarding/           # Onboarding flow components
   ├── visual/               # Decorative / animated components
   │
   └── <~60 flat files>      # Feature components live at the top level:
       ├── AppSidebar.tsx    #   ShareModal.tsx, TopBar.tsx,
       ├── TopBar.tsx        #   InviteMemberModal.tsx, ...
       └── ...
   ```

4. **Customization:**
   - Extended Tailwind theme with brand colors
   - Custom variants for common patterns
   - Brand-specific component modifications

5. **Usage:**
   ```typescript
   import { Button } from '@/components/ui/button'
   import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
   ```

---

## Alternatives Considered

### Option 1: Build from Scratch with Tailwind

**Pros:**
- **Full Control:** Complete ownership of all components
- **No Dependencies:** Minimal external dependencies
- **Perfect Fit:** Components exactly match our needs
- **Learning:** Good for understanding UI fundamentals

**Cons:**
- **Time-Consuming:** Significant development time for common components
- **Accessibility Risk:** Easy to miss accessibility requirements
- **Inconsistency:** Hard to maintain consistency across team
- **Boilerplate:** Repetitive patterns for common interactions
- **Maintenance:** All bugs are our responsibility

**Why Not Chosen:** Building everything from scratch would have delayed development significantly. shadcn/ui gives us 80% of what we need out of the box while still providing full control.

### Option 2: Material UI (MUI)

**Pros:**
- **Mature:** Industry standard, battle-tested
- **Comprehensive:** Large library of components
- **Good Documentation:** Extensive guides and examples
- **Theming:** Robust theming system
- **Community:** Large, active community

**Cons:**
- **Opinionated Styling:** Material Design aesthetic may not fit our brand
- **Bundle Size:** Larger bundle size impact
- **Complexity:** Can be complex to customize
- **CSS-in-JS:** Uses Emotion/MUI styling (we prefer Tailwind)
- **Learning Curve:** Different mental model than Tailwind

**Why Not Chosen:** The styling approach (CSS-in-JS vs Tailwind) and visual aesthetic didn't align with our design preferences. We wanted a Tailwind-first approach.

### Option 3: Chakra UI

**Pros:**
- **Simple:** Easy to use, intuitive API
- **Accessible:** Built-in accessibility
- **Theming:** Good theming support
- **TypeScript:** First-class TypeScript support

**Cons:**
- **Styling:** Uses its own styling system (not Tailwind)
- **Bundle Size:** Larger than desired
- **Customization:** Limited ability to customize underlying styles
- **Ecosystem:** Smaller than MUI

**Why Not Chosen:** Similar to MUI, Chakra uses its own styling system rather than Tailwind. We wanted to standardize on Tailwind across the application.

### Option 4: Ant Design

**Pros:**
- **Comprehensive:** Huge library of components
- **Enterprise Ready:** Used by large companies
- **Consistent:** Very consistent look and feel

**Cons:**
- **Ant Design Aesthetic:** Very opinionated styling ("Ant Design look")
- **Bundle Size:** Very large
- **Complex:** Can be overwhelming
- **CSS-in-JS:** Uses its own styling system
- **Not Tailwind:** Incompatible with Tailwind-first approach

**Why Not Chosen:** The visual style doesn't match our brand identity, and it uses a different styling approach.

### Option 5: Radix UI Only (Without shadcn)

**Pros:**
- **Unstyled:** Complete control over styling
- **Accessible:** Excellent accessibility
- **Primitive:** Low-level building blocks
- **Lightweight:** Small bundle size
- **Tailwind-Compatible:** Works perfectly with Tailwind

**Cons:**
- **No Styling:** Must style everything from scratch
- **Boilerplate:** Significant code for each component
- **Time-Consuming:** Slower development
- **Inconsistency:** Hard to maintain consistent patterns

**Why Not Chosen:** While Radix is excellent, starting from completely unstyled primitives would be too time-consuming. shadcn/ui provides the perfect middle ground: Radix primitives with pre-styled, Tailwind-compatible components.

### Option 6: Tailwind UI (Paid)

**Pros:**
- **Official:** From Tailwind creators
- **Polished:** High-quality, well-designed components
- **Tailwind-Native:** Perfect Tailwind integration
- **Copy-Paste:** Similar approach to shadcn

**Cons:**
- **Cost:** $299 one-time per developer (expensive for team)
- **Closed Source:** Can't see implementation
- **No Ownership:** Components aren't in our codebase
- **Limited:** Smaller library than shadcn

**Why Not Chosen:** The cost was prohibitive for a startup team. shadcn/ui provides similar benefits for free.

---

## Consequences

### Positive

1. **Productivity:** Rapid development with pre-built components
2. **Consistency:** Uniform look and feel across application
3. **Accessibility:** WCAG-compliant components out of the box
4. **Ownership:** Full control over components (they're in our codebase)
5. **Tailwind Integration:** Perfect integration with Tailwind CSS
6. **Customization:** Easy to modify components to match our brand
7. **Type Safety:** Full TypeScript support
8. **Documentation:** Good examples and patterns from shadcn
9. **Community:** Growing community and ecosystem
10. **No Lock-in:** Can modify or replace components anytime

### Negative

1. **Initial Setup:** Requires some initial setup and configuration
2. **Component Selection:** Need to choose which components to add
3. **Updates:** Don't automatically get shadcn/ui updates
4. **File Management:** More files in the codebase
5. **Learning Curve:** Team needs to learn the component patterns

### Mitigations

1. **Curated Set:** Maintain a curated set of approved components
2. **Component Registry:** Document which components are available and their usage
3. **Update Process:** Establish process for updating to new shadcn/ui versions
4. **Code Organization:** Keep components well-organized
5. **Training:** Provide examples and patterns for new developers

---

## References

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [shadcn/ui GitHub](https://github.com/shadcn-ui/ui)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) - Frontend patterns

---

## Appendix: Implementation Notes

### Tailwind Theme Extension

```typescript
// tailwind.config.ts (abridged -- the real file)
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}",
            "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans:    ["Sora", "Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      // Colors are CSS variables, never literal hex -- this is what makes the
      // shadcn theming model (and the dark-mode class switch) work.
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))",     foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))" },
        // ...popover, card, sidebar
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

**Two things to get right when editing this file:**

- The display typeface is **Sora**, with Inter as the first fallback — not Inter.
- Colors resolve through `hsl(var(--token))`. Writing a literal hex here breaks theming
  and dark mode. The actual values live as HSL triples on `:root` and `.dark` in
  `src/index.css`.


### Custom CSS Variables

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.5rem;
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 22.4 76.3% 58.6%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 22.4 76.3% 58.6%;
  }
}
```

### Component Customization Example

```typescript
// src/components/ui/button.tsx (modified from shadcn)
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center rounded-lg text-sm font-medium",
    "transition-colors focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    "data-[state=open]:bg-secondary/80",
    "ring-offset-background",
    "hover:bg-primary/90",
    "active:scale-[0.98]"
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-secondary/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary/10",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "bg-brand-orange text-white hover:bg-brand-orange/90",
        brandSecondary: "bg-brand-purple text-white hover:bg-brand-purple/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        xs: "h-7 px-2 text-xs",
        xxs: "h-6 px-1.5 text-2xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Custom Components

Built on top of shadcn/ui primitives:

```typescript
// Illustrative composition -- there is no TrackCard.tsx; feature components
// live flat in src/components/. The point is the shadcn import surface.
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause, MoreVertical } from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'

function TrackRow({ track, onClick, onMore }: { track: Track, onClick?: () => void, onMore?: () => void }) {
  const { currentTrack, isPlaying, togglePlay } = useAudioPlayer()
  const isCurrent = currentTrack?.id === track.id
  
  return (
    <Card className="group cursor-pointer hover:shadow-lg transition-shadow">
      <CardHeader className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay(track)
              }}
            >
              {isCurrent && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div>
              <h3 className="font-semibold text-sm">{track.title}</h3>
              <p className="text-xs text-muted-foreground">{track.artist}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onMore?.() }}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDuration(track.duration_sec)}</span>
          <span className="text-border">|</span>
          <span>{track.bpm} BPM</span>
          <span className="text-border">|</span>
          <span>{track.key}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 1.0.0 |
| **Status** | Accepted |
| **Owner** | Ishan |
| **Last Review** | August 18, 2026 |
| **Next Review** | August 11, 2027 |

---

*This ADR is a living document and may be updated as our UI component library approach evolves.*
