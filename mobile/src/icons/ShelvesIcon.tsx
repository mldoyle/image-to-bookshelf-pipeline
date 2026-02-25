import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

const SvgShelvesIcon = (props: SvgProps) => (
  <Svg width={20} height={20} fill="none" {...props}>
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="m13.333 5 3.334 11.667"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M10 5v11.667"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M6.667 6.666v10"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M3.333 3.333v13.334"
    />
  </Svg>
);

export default SvgShelvesIcon;
