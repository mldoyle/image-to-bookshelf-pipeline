import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

const SvgDeclineBookIcon = (props: SvgProps) => (
  <Svg width={19} height={19} fill="none" {...props}>
    <Path
      stroke={props.color ?? "#fff"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m6.312 6.313 3.188 3.187m0 0 3.187 3.187M9.5 9.5l-3.188 3.187M9.5 9.5l3.187-3.187M1 14.6V4.4c0-1.19 0-1.785.232-2.24a2 2 0 0 1 .928-.928C2.615 1 3.21 1 4.4 1h10.2c1.19 0 1.785 0 2.24.232a2 2 0 0 1 .928.928C18 2.615 18 3.21 18 4.4v10.2c0 1.19 0 1.785-.232 2.24a2 2 0 0 1-.928.928C16.386 18 15.791 18 14.604 18H4.397c-1.188 0-1.783 0-2.237-.231a2 2 0 0 1-.929-.929C1 16.385 1 15.79 1 14.6Z"
    />
  </Svg>
);

export default SvgDeclineBookIcon;
