import { useDispatch, useSelector } from "react-redux";
import { toggleLeftSidebar, toggleRightSidebar } from "@/redux/slices/uiSlice";

/** Desktop sidebar widths (rem). Full = Tailwind w-xs (20rem); rail = 5rem. */
export const SIDEBAR_FULL = 20;
export const SIDEBAR_RAIL = 5;

export const useSidebars = () => {
  const dispatch = useDispatch();
  const { leftCollapsed, rightCollapsed } = useSelector((s) => s.ui);
  return {
    leftCollapsed: !!leftCollapsed,
    rightCollapsed: !!rightCollapsed,
    toggleLeft: () => dispatch(toggleLeftSidebar()),
    toggleRight: () => dispatch(toggleRightSidebar()),
  };
};
