"use client";
import { ModelingView } from "./ModelingView";
import { useModeling } from "./useModeling";
export function SecModelingPage() { return <ModelingView {...useModeling()} />; }
