import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

type FlashToggleIconProps = SvgProps & {
  enabled: boolean;
};

const SvgFlashToggleIcon = ({ enabled, color, ...props }: FlashToggleIconProps) => {
  const stroke = color ?? "#fff";

  return (
    <Svg width={22} height={22} fill="none" viewBox="0 0 24 24" {...props}>
      <Path
        d="M13.5 2.5 6.75 12h4.5l-1.5 9.5L17.25 12h-4.5l.75-9.5Z"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      {!enabled ? (
        <Path
          d="M4 20 20 4"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      ) : null}
    </Svg>
  );
};

export default SvgFlashToggleIcon;
