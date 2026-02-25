import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

const SvgFriendsIcon = (props: SvgProps) => (
  <Svg width={20} height={20} fill="none" {...props}>
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M13.333 17.5v-1.667A3.333 3.333 0 0 0 10 12.5H5a3.333 3.333 0 0 0-3.333 3.333V17.5"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M7.5 9.167a3.333 3.333 0 1 0 0-6.667 3.333 3.333 0 0 0 0 6.667"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M18.333 17.5v-1.667a3.333 3.333 0 0 0-2.5-3.225"
    />
    <Path
      stroke={props.color ?? "#8E95A8"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.66667}
      d="M13.333 2.608a3.334 3.334 0 0 1 0 6.458"
    />
  </Svg>
);

export default SvgFriendsIcon;
