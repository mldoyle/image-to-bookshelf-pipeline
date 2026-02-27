type UseFontsHook = (fontMap: Record<string, number>) => [boolean, Error | null];

const loadUseFonts = (): UseFontsHook => {
  try {
    const expoFont = require("expo-font") as { useFonts?: UseFontsHook };
    if (expoFont.useFonts) {
      return expoFont.useFonts;
    }
  } catch {
    // Fall through to Expo's nested dependency path.
  }

  const nestedExpoFont = require("expo/node_modules/expo-font") as { useFonts: UseFontsHook };
  return nestedExpoFont.useFonts;
};

export const useAppFonts = loadUseFonts();

