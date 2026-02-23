import * as React from "react";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
const SvgOrientationNoHintIcon = (props: SvgProps) => (
  <Svg
    width={35}
    height={42}
    fill="none"
    {...props}
  >
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.867 27h21.267c2.053 0 3.078 0 3.863-.37a3.55 3.55 0 0 0 1.604-1.486c.399-.727.399-1.678.399-3.579v-6.13c0-1.9 0-2.851-.4-3.578a3.55 3.55 0 0 0-1.603-1.487c-.784-.37-1.808-.37-3.858-.37H6.861c-2.05 0-3.076 0-3.86.37-.69.326-1.25.848-1.601 1.487-.4.728-.4 1.679-.4 3.583v6.12c0 1.904 0 2.857.4 3.584.351.64.912 1.16 1.602 1.485C3.786 27 4.814 27 6.867 27"
    />
  </Svg>
);
export default SvgOrientationNoHintIcon;
