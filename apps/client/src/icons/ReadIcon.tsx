import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

const SvgReadIcon = (props: SvgProps) => (
  <Svg width={20} height={20} fill="none" {...props}>
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M10 5.833V17.5"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M2.5 15a.833.833 0 0 1-.833-.833V3.333A.833.833 0 0 1 2.5 2.5h4.167A3.333 3.333 0 0 1 10 5.833 3.333 3.333 0 0 1 13.333 2.5H17.5a.833.833 0 0 1 .833.833v10.834A.833.833 0 0 1 17.5 15h-5a3.333 3.333 0 0 0-2.5 1.036A3.333 3.333 0 0 0 7.5 15h-5Z"
    />
  </Svg>
);

export default SvgReadIcon;
