import { createContext, useContext, useMemo } from "react";
import { buildTasteProfile } from "./taste.js";

// The taste quiz answers, available to every screen that builds a taste profile
// so Tonight, For You, Shelves, Challenges and the marathon planner all agree.
export const CalibrationContext = createContext(null);

export const useCalibration = () => useContext(CalibrationContext);

// Your taste profile: the library plus the quiz answers.
export function useTasteProfile(library) {
  const calibration = useCalibration();
  return useMemo(() => buildTasteProfile(library, { calibration }), [library, calibration]);
}
