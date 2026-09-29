// Global constraint: touch targets are at least 44px (min-h-11 = 2.75rem).
// Nuxt UI's `xl` size renders ~40px tall, so enforce the minimum once here.
// UInputNumber steppers are xl icon-only UButtons, so they are covered too.
export default defineAppConfig({
  ui: {
    colors: { primary: 'indigo', neutral: 'zinc' },
    button: {
      variants: { size: { xl: { base: 'min-h-11' } } },
      compoundVariants: [{ size: 'xl', square: true, class: { base: 'min-w-11 justify-center' } }],
    },
    input: { variants: { size: { xl: { base: 'min-h-11' } } } },
    select: { variants: { size: { xl: { base: 'min-h-11' } } } },
    inputNumber: { variants: { size: { xl: { base: 'min-h-11' } } } },
  },
})
