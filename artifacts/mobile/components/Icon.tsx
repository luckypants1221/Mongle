import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";

export type FeatherIconName =
  | "activity" | "alert-circle" | "arrow-left" | "arrow-right"
  | "bar-chart-2" | "bell" | "calendar" | "check-circle"
  | "chevron-down" | "chevron-left" | "chevron-right" | "chevron-up"
  | "clock" | "droplet" | "edit-2" | "edit-3" | "eye" | "eye-off"
  | "home" | "info" | "lock" | "log-in" | "log-out" | "mail"
  | "minus" | "moon" | "music" | "plus" | "radio" | "shield" | "sliders" | "star"
  | "stop-circle" | "sun" | "thermometer" | "user" | "volume-x" | "wind"
  | "cloud-rain" | "x";

interface FeatherProps {
  name: FeatherIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function FeatherIcon({ name, size = 24, color = "#000", style }: FeatherProps) {
  const s = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };
  const f = { fill: color, stroke: "none" as const };

  const renderPaths = () => {
    switch (name) {
      case "activity":
        return <Polyline {...s} points="22,12 18,12 15,21 9,3 6,12 2,12" />;
      case "alert-circle":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={10} />
            <Line {...s} x1={12} y1={8} x2={12} y2={12} />
            <Line {...s} x1={12} y1={16} x2={12.01} y2={16} />
          </>
        );
      case "arrow-left":
        return (
          <>
            <Line {...s} x1={19} y1={12} x2={5} y2={12} />
            <Polyline {...s} points="12,19 5,12 12,5" />
          </>
        );
      case "arrow-right":
        return (
          <>
            <Line {...s} x1={5} y1={12} x2={19} y2={12} />
            <Polyline {...s} points="12,5 19,12 12,19" />
          </>
        );
      case "bar-chart-2":
        return (
          <>
            <Line {...s} x1={18} y1={20} x2={18} y2={10} />
            <Line {...s} x1={12} y1={20} x2={12} y2={4} />
            <Line {...s} x1={6} y1={20} x2={6} y2={14} />
          </>
        );
      case "bell":
        return (
          <>
            <Path {...s} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <Path {...s} d="M13.73 21a2 2 0 0 1-3.46 0" />
          </>
        );
      case "calendar":
        return (
          <>
            <Rect {...s} x={3} y={4} width={18} height={18} rx={2} ry={2} />
            <Line {...s} x1={16} y1={2} x2={16} y2={6} />
            <Line {...s} x1={8} y1={2} x2={8} y2={6} />
            <Line {...s} x1={3} y1={10} x2={21} y2={10} />
          </>
        );
      case "check-circle":
        return (
          <>
            <Path {...s} d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <Polyline {...s} points="22,4 12,14.01 9,11.01" />
          </>
        );
      case "chevron-down":
        return <Polyline {...s} points="6,9 12,15 18,9" />;
      case "chevron-left":
        return <Polyline {...s} points="15,18 9,12 15,6" />;
      case "chevron-right":
        return <Polyline {...s} points="9,18 15,12 9,6" />;
      case "chevron-up":
        return <Polyline {...s} points="18,15 12,9 6,15" />;
      case "clock":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={10} />
            <Polyline {...s} points="12,6 12,12 16,14" />
          </>
        );
      case "droplet":
        return <Path {...s} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
      case "edit-2":
        return <Path {...s} d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />;
      case "edit-3":
        return (
          <>
            <Path {...s} d="M12 20h9" />
            <Path {...s} d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </>
        );
      case "eye":
        return (
          <>
            <Path {...s} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <Circle {...s} cx={12} cy={12} r={3} />
          </>
        );
      case "eye-off":
        return (
          <>
            <Path {...s} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <Path {...s} d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <Line {...s} x1={1} y1={1} x2={23} y2={23} />
          </>
        );
      case "home":
        return (
          <>
            <Path {...s} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <Polyline {...s} points="9,22 9,12 15,12 15,22" />
          </>
        );
      case "info":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={10} />
            <Line {...s} x1={12} y1={16} x2={12} y2={12} />
            <Line {...s} x1={12} y1={8} x2={12.01} y2={8} />
          </>
        );
      case "lock":
        return (
          <>
            <Rect {...s} x={3} y={11} width={18} height={11} rx={2} ry={2} />
            <Path {...s} d="M7 11V7a5 5 0 0 1 10 0v4" />
          </>
        );
      case "log-in":
        return (
          <>
            <Path {...s} d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <Polyline {...s} points="10,17 15,12 10,7" />
            <Line {...s} x1={15} y1={12} x2={3} y2={12} />
          </>
        );
      case "log-out":
        return (
          <>
            <Path {...s} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <Polyline {...s} points="16,17 21,12 16,7" />
            <Line {...s} x1={21} y1={12} x2={9} y2={12} />
          </>
        );
      case "mail":
        return (
          <>
            <Path {...s} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <Polyline {...s} points="22,6 12,13 2,6" />
          </>
        );
      case "minus":
        return <Line {...s} x1={5} y1={12} x2={19} y2={12} />;
      case "moon":
        return <Path {...s} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />;
      case "music":
        return (
          <>
            <Path {...s} d="M9 18V5l12-2v13" />
            <Circle {...s} cx={6} cy={18} r={3} />
            <Circle {...s} cx={18} cy={16} r={3} />
          </>
        );
      case "volume-x":
        return (
          <>
            <Polygon {...s} points="11,5 6,9 2,9 2,15 6,15 11,19" />
            <Line {...s} x1={23} y1={9} x2={17} y2={15} />
            <Line {...s} x1={17} y1={9} x2={23} y2={15} />
          </>
        );
      case "wind":
        return (
          <Path {...s} d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        );
      case "cloud-rain":
        return (
          <>
            <Line {...s} x1={16} y1={13} x2={16} y2={21} />
            <Line {...s} x1={8} y1={13} x2={8} y2={21} />
            <Line {...s} x1={12} y1={15} x2={12} y2={23} />
            <Path {...s} d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
          </>
        );
      case "radio":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={2} />
            <Path {...s} d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </>
        );
      case "plus":
        return (
          <>
            <Line {...s} x1={12} y1={5} x2={12} y2={19} />
            <Line {...s} x1={5} y1={12} x2={19} y2={12} />
          </>
        );
      case "shield":
        return <Path {...s} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
      case "sliders":
        return (
          <>
            <Line {...s} x1={4} y1={21} x2={4} y2={14} />
            <Line {...s} x1={4} y1={10} x2={4} y2={3} />
            <Line {...s} x1={12} y1={21} x2={12} y2={12} />
            <Line {...s} x1={12} y1={8} x2={12} y2={3} />
            <Line {...s} x1={20} y1={21} x2={20} y2={16} />
            <Line {...s} x1={20} y1={12} x2={20} y2={3} />
            <Line {...s} x1={1} y1={14} x2={7} y2={14} />
            <Line {...s} x1={9} y1={8} x2={15} y2={8} />
            <Line {...s} x1={17} y1={16} x2={23} y2={16} />
          </>
        );
      case "star":
        return (
          <Polygon
            {...s}
            fill={color}
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          />
        );
      case "stop-circle":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={10} />
            <Rect {...s} x={9} y={9} width={6} height={6} />
          </>
        );
      case "sun":
        return (
          <>
            <Circle {...s} cx={12} cy={12} r={5} />
            <Line {...s} x1={12} y1={1} x2={12} y2={3} />
            <Line {...s} x1={12} y1={21} x2={12} y2={23} />
            <Line {...s} x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
            <Line {...s} x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
            <Line {...s} x1={1} y1={12} x2={3} y2={12} />
            <Line {...s} x1={21} y1={12} x2={23} y2={12} />
            <Line {...s} x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
            <Line {...s} x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
          </>
        );
      case "thermometer":
        return <Path {...s} d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />;
      case "user":
        return (
          <>
            <Path {...s} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <Circle {...s} cx={12} cy={7} r={4} />
          </>
        );
      case "x":
        return (
          <>
            <Line {...s} x1={18} y1={6} x2={6} y2={18} />
            <Line {...s} x1={6} y1={6} x2={18} y2={18} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style as object}
    >
      {renderPaths()}
    </Svg>
  );
}

export { FeatherIcon as Feather };
