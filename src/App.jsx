import React, { useMemo } from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import { alpha, ThemeProvider, createTheme } from '@mui/material/styles';
import {
  createBrowserRouter,
  RouterProvider
} from "react-router-dom";

import ToastProvider from 'components/Toast/ToastProvider';

import BridgeHomePage from './pages/BridgeHomePage';
import Claim from './pages/Claim';
import NFT from './pages/NFT';
import { ThemeModeProvider, useThemeMode } from './providers/ThemeModeProvider';
import Web3ConnectionProvider from './providers/Web3ConnectionProvider';
import WrappedWeb3ReactProvider from './providers/WrappedWeb3ReactProvider';

const buildTheme = (mode) => {
  const isDarkMode = mode === 'dark';
  const accentColor = '#3165d4';
  const accentHoverColor = '#2b5cc2';
  const dividerColor = isDarkMode ? 'rgba(124, 144, 178, 0.18)' : 'rgba(168, 183, 208, 0.34)';
  const paperColor = isDarkMode ? '#101722' : '#ffffff';
  const defaultBackgroundColor = isDarkMode ? '#0a0f18' : '#f7f9fc';
  const primaryTextColor = isDarkMode ? '#f6f8fc' : '#0f172a';
  const secondaryTextColor = isDarkMode ? '#a9b5cb' : '#64748b';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: accentColor
      },
      background: {
        default: defaultBackgroundColor,
        paper: paperColor
      },
      divider: dividerColor,
      text: {
        primary: primaryTextColor,
        secondary: secondaryTextColor
      }
    },
    shape: {
      borderRadius: 18
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 180ms ease, color 180ms ease'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 18
          },
          standardInfo: {
            backgroundColor: isDarkMode ? alpha('#182338', 0.94) : '#eff6ff',
            color: isDarkMode ? '#dbeafe' : '#1d4ed8',
            border: `1px solid ${isDarkMode ? alpha('#4f7fff', 0.24) : '#bfdbfe'}`
          },
          standardWarning: {
            backgroundColor: isDarkMode ? alpha('#2b2115', 0.96) : '#fff7ed',
            color: isDarkMode ? '#fed7aa' : '#9a3412',
            border: `1px solid ${isDarkMode ? alpha('#fb923c', 0.22) : '#fdba74'}`
          },
          standardError: {
            backgroundColor: isDarkMode ? alpha('#2a171b', 0.96) : '#fef2f2',
            color: isDarkMode ? '#fecaca' : '#b42318',
            border: `1px solid ${isDarkMode ? alpha('#ef4444', 0.2) : '#fecaca'}`
          },
          standardSuccess: {
            backgroundColor: isDarkMode ? alpha('#16261e', 0.96) : '#edf9f1',
            color: isDarkMode ? '#bbf7d0' : '#166534',
            border: `1px solid ${isDarkMode ? alpha('#22c55e', 0.2) : '#bbf7d0'}`
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: isDarkMode ? alpha('#131b28', 0.96) : alpha('#ffffff', 0.96),
            '& fieldset': {
              borderColor: dividerColor
            },
            '&:hover fieldset': {
              borderColor: isDarkMode ? alpha(accentColor, 0.5) : alpha(accentColor, 0.42)
            },
            '&.Mui-focused fieldset': {
              borderColor: accentColor
            }
          },
          input: {
            color: primaryTextColor
          }
        }
      },
      MuiInput: {
        styleOverrides: {
          root: {
            color: primaryTextColor,
            '&:before': {
              borderBottomColor: dividerColor
            },
            '&:hover:not(.Mui-disabled, .Mui-error):before': {
              borderBottomColor: alpha(accentColor, 0.42)
            },
            '&:after': {
              borderBottomColor: accentColor
            }
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: primaryTextColor
          },
          input: {
            color: primaryTextColor
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: secondaryTextColor
          }
        }
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: secondaryTextColor,
            '&.Mui-focused': {
              color: accentColor
            }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: secondaryTextColor
          }
        }
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: paperColor,
            color: primaryTextColor,
            border: `1px solid ${dividerColor}`,
            boxShadow: isDarkMode ? '0 24px 64px rgba(0, 0, 0, 0.44)' : '0 18px 36px rgba(15, 23, 42, 0.12)'
          },
          option: {
            '&[aria-selected="true"]': {
              backgroundColor: alpha(accentColor, isDarkMode ? 0.18 : 0.12)
            },
            '&.Mui-focused': {
              backgroundColor: alpha(accentColor, isDarkMode ? 0.14 : 0.08)
            }
          }
        }
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: accentColor
            },
            '&.Mui-checked + .MuiSwitch-track': {
              backgroundColor: accentColor
            }
          },
          track: {
            backgroundColor: isDarkMode ? alpha('#a9b5cb', 0.28) : alpha('#0f172a', 0.2)
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 700,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none'
            },
            '&.Mui-focusVisible': {
              boxShadow: 'none'
            }
          },
          containedPrimary: {
            backgroundColor: accentColor,
            '&:hover': {
              backgroundColor: accentHoverColor
            }
          }
        }
      }
    }
  });
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <BridgeHomePage />,
    errorElement: <div>Not a Valid path</div>
  },
  {
    path: "/claim",
    element: <Claim />
  },
  {
    path: "/nft",
    element: <NFT />
  }
]);

function App() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WrappedWeb3ReactProvider>
        <Web3ConnectionProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </Web3ConnectionProvider>
      </WrappedWeb3ReactProvider>
    </ThemeProvider>
  );
}

const AppRoot = () => (
  <ThemeModeProvider>
    <App />
  </ThemeModeProvider>
);

export default AppRoot;
