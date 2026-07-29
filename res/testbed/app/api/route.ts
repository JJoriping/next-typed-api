import type { NextTypedRoute } from "@daldalso/next-typed-route";
import { NextResponse } from "next/server";

export const GET:NextTypedRoute = () => new NextResponse();
export const POST = getTypedRoute();

function getTypedRoute():NextTypedRoute{
  return () => new NextResponse();
}