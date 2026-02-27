import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
const SvgSelectNoCapturesIcon = (props: SvgProps) => (
  <Svg
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <Path
      stroke="#E5E5E5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M1 7v10.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C1.76 19 2.039 19 2.598 19H13m2-13-4 4-2-2m-4 3.8V4.2c0-1.12 0-1.68.218-2.108.192-.377.497-.682.874-.874C6.52 1 7.08 1 8.2 1h7.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C19 2.52 19 3.08 19 4.2v7.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874c-.428.218-.986.218-2.104.218H8.197c-1.118 0-1.678 0-2.105-.218a2 2 0 0 1-.874-.874C5 13.48 5 12.92 5 11.8"
    />
  </Svg>
);
export default SvgSelectNoCapturesIcon;
