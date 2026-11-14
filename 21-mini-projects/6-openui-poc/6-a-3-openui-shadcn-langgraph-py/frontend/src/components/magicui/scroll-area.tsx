"use client";
import * as Primitive from "@radix-ui/react-scroll-area";
import type { ComponentProps } from "react";
export function ScrollArea({children,...props}:ComponentProps<typeof Primitive.Root>){return <Primitive.Root {...props}><Primitive.Viewport className="size-full">{children}</Primitive.Viewport><Primitive.Scrollbar orientation="vertical"><Primitive.Thumb /></Primitive.Scrollbar></Primitive.Root>;}
