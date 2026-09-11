/** @jsxImportSource react */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { koreanUiMessages, type UiMessages } from "./ui-messages";

const UiMessagesContext = createContext<UiMessages>(koreanUiMessages);

export function UiMessagesProvider({ messages = koreanUiMessages, children }: {
  messages?: UiMessages;
  children: ReactNode;
}) {
  return <UiMessagesContext.Provider value={messages}>{children}</UiMessagesContext.Provider>;
}

export function useUiMessages() {
  return useContext(UiMessagesContext);
}
