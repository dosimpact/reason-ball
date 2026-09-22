"use client";

import { createContext } from "react";

/** Freeze business inputs/actions while allowing readers to expand source details. */
export const SurfaceReadOnly = createContext(false);
