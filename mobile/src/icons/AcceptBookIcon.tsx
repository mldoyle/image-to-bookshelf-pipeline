import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

const SvgAcceptBookIcon = (props: SvgProps) => (
  <Svg width={18} height={18} fill="none" {...props}>
    <Path
      stroke={props.color ?? "#fff"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 9H9m0 0h4m-4 0v4m0-4V5M1 13.8V4.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C2.52 1 3.08 1 4.2 1h9.6c1.12 0 1.68 0 2.108.218.377.192.682.497.874.874.218.428.218.988.218 2.108v9.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C15.48 17 14.922 17 13.804 17H4.197c-1.118 0-1.678 0-2.105-.218a2 2 0 0 1-.874-.874C1 15.48 1 14.92 1 13.8Z"
    />
  </Svg>
);

export default SvgAcceptBookIcon;
