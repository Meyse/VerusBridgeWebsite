import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import {
  THEME_MODE_STORAGE_KEY,
  ThemeModeProvider
} from 'providers/ThemeModeProvider';

import SiteFooter from './SiteFooter';

const mockSystemTheme = (matchesDarkMode) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: matchesDarkMode,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn()
    }))
  });
};

const renderFooter = () => render(
  <ThemeModeProvider>
    <SiteFooter />
  </ThemeModeProvider>
);

describe('SiteFooter theme switch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    mockSystemTheme(false);
  });

  test('moves theme mode control into the footer and follows system mode by default', () => {
    renderFooter();

    const autoButton = screen.getByRole('button', { name: /auto mode/i });
    const darkButton = screen.getByRole('button', { name: /dark mode/i });
    const lightButton = screen.getByRole('button', { name: /light mode/i });

    expect(autoButton).toHaveAttribute('aria-pressed', 'true');
    expect(darkButton).toHaveAttribute('aria-pressed', 'false');
    expect(lightButton).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('system');

    fireEvent.click(darkButton);

    expect(autoButton).toHaveAttribute('aria-pressed', 'false');
    expect(darkButton).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
  });
});
