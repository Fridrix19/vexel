// Пресет PrimeVue для Vexel: тёмный экран, янтарь, прямые углы
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export default definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
    blue: { 50: '#FFF6E0', 100: '#FFE9B0', 200: '#FFD978', 300: '#FFC940', 400: '#FFBA1A', 500: '#FFB000', 600: '#D99100', 700: '#B87A00', 800: '#8A5C00', 900: '#5C3D00', 950: '#2E1F00' },
    ink:  { 0: '#FFFFFF', 50: '#F2E9D6', 100: '#E2D5B8', 200: '#C9B896', 300: '#A8977A', 400: '#8A7A5F', 500: '#5C4E36', 600: '#3A3123', 700: '#241F17', 800: '#1A1712', 900: '#12100C', 950: '#0A0907' },
    green: { 400: '#9CC47E', 600: '#3F6B2F' }, amber: { 400: '#F0B14A', 600: '#8F5400' }, red: { 400: '#FF7B6B', 600: '#B42318' }
  },
  semantic: {
    primary: { 50: '{blue.50}', 100: '{blue.100}', 200: '{blue.200}', 300: '{blue.300}', 400: '{blue.400}', 500: '{blue.500}', 600: '{blue.600}', 700: '{blue.700}', 800: '{blue.800}', 900: '{blue.900}', 950: '{blue.950}' },
    focusRing: { width: '2px', style: 'solid', color: '{primary.500}', offset: '2px' },
    formField: { paddingX: '0.875rem', paddingY: '0.7rem', borderRadius: '0', focusRing: { width: '0', style: 'none', color: 'transparent', offset: '0' } },
    colorScheme: {
      light: {
        surface: { 0: '#FFFFFF', 50: '{ink.50}', 100: '{ink.100}', 200: '{ink.200}', 300: '{ink.300}', 400: '{ink.400}', 500: '{ink.500}', 600: '{ink.600}', 700: '{ink.700}', 800: '{ink.800}', 900: '{ink.900}', 950: '{ink.950}' },
        primary: { color: '#1A1712', contrastColor: '#FBF8F1', hoverColor: '#D8431C', activeColor: '#B8381A' },
        highlight: { background: '#F3E2D6', focusBackground: '#EBCDBB', color: '#1A1712', focusColor: '#1A1712' },
        text: { color: '#3A342A', hoverColor: '#1A1712', mutedColor: '#5C5447', hoverMutedColor: '#3A342A' },
        formField: { background: '#FBF8F1', disabledBackground: '#EBE5D8', filledBackground: '#FBF8F1', borderColor: '#B5A994', hoverBorderColor: '#5C5447', focusBorderColor: '#1A1712', invalidBorderColor: '{red.600}', color: '#1A1712', placeholderColor: '#766C5E', invalidPlaceholderColor: '{red.600}', iconColor: '#766C5E', shadow: 'none' },
        content: { background: '#FBF8F1', hoverBackground: '#EBE5D8', borderColor: '#D6CCBA', color: '#3A342A', hoverColor: '#1A1712' }
      },
      dark: {
        surface: { 0: '#FFFFFF', 50: '{ink.50}', 100: '{ink.100}', 200: '{ink.200}', 300: '{ink.300}', 400: '{ink.400}', 500: '{ink.500}', 600: '{ink.600}', 700: '{ink.700}', 800: '{ink.800}', 900: '{ink.900}', 950: '{ink.950}' },
        primary: { color: '#FFB000', contrastColor: '#0A0907', hoverColor: '#FFC940', activeColor: '#D99100' },
        highlight: { background: '#2A2010', focusBackground: '#3A2C12', color: '#FFB000', focusColor: '#FFB000' },
        text: { color: '#DCCDAE', hoverColor: '#F5E9D0', mutedColor: '#968767', hoverMutedColor: '#DCCDAE' },
        formField: { background: '#0A0907', disabledBackground: '#12100C', filledBackground: '#0A0907', borderColor: '#6B5524', hoverBorderColor: '#968767', focusBorderColor: '#FFB000', invalidBorderColor: '{red.400}', color: '#F5E9D0', placeholderColor: '#968767', invalidPlaceholderColor: '{red.400}', iconColor: '#968767', shadow: 'none' },
        content: { background: '#13110D', hoverBackground: '#1A1712', borderColor: '#3A3123', color: '#DCCDAE', hoverColor: '#F5E9D0' }
      }
    }
  },
  components: {
    button: { root: { borderRadius: '0', paddingX: '1.25rem', paddingY: '0.7rem', gap: '0.5rem', label: { fontWeight: '700' }, sm: { paddingX: '0.9rem', paddingY: '0.45rem', fontSize: '0.8rem' } },
              colorScheme: { light: { secondary: { background: 'transparent', hoverBackground: '#EBE5D8', borderColor: '#1A1712', hoverBorderColor: '#1A1712', color: '#1A1712', hoverColor: '#1A1712' } },
                             dark:  { secondary: { background: 'transparent', hoverBackground: '#1A1712', borderColor: '#6B5524', hoverBorderColor: '#FFB000', color: '#FFB000', hoverColor: '#FFB000' } } } },
    togglebutton: { root: { borderRadius: '0', padding: '0.6rem 0.9rem', gap: '0.25rem' } },
    selectbutton: { root: { borderRadius: '0' } },
    inputtext: { root: { paddingX: '0.875rem', paddingY: '0.7rem' } },
    tabs: { tab: { padding: '0.6rem 1rem', fontWeight: '700', borderWidth: '0 0 3px 0' }, tablist: { background: 'transparent' }, activeBar: { height: '3px' } },
    message: { root: { borderRadius: '0' }, simple: { content: { padding: '0' } } },
    toast: { root: { borderRadius: '0', width: 'min(360px, calc(100vw - 32px))' } }
  }
})
