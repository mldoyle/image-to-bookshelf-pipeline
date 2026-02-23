import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
const SvgRotatePortraitIcon = (props: SvgProps) => (
  <Svg
    width={35}
    height={53}
    fill="none"
    {...props}
  >
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 18.867v21.267c0 2.053 0 3.078.37 3.863.327.69.846 1.252 1.486 1.604C4.583 46 5.534 46 7.435 46h6.13c1.9 0 2.851 0 3.578-.4a3.55 3.55 0 0 0 1.487-1.603c.37-.784.37-1.809.37-3.858V18.861c0-2.05 0-3.076-.37-3.86a3.55 3.55 0 0 0-1.487-1.601c-.728-.4-1.679-.4-3.583-.4H7.44c-1.904 0-2.857 0-3.584.4-.64.351-1.16.912-1.485 1.602C2 15.786 2 16.814 2 18.867M27.213 8.039l-3.504-3.503L27.246 1m5.857 14.347a8 8 0 0 0 .556-4.353 7.864 7.864 0 0 0-5.49-6.346 7.96 7.96 0 0 0-4.381-.07"
    />
  </Svg>
);
export default SvgRotatePortraitIcon;
