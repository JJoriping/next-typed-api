/* eslint-disable unicorn/prevent-abbreviations */
import type { NextURL } from "next/dist/server/web/next-url.js";
import type { NextRequest, NextResponse } from "next/server.js";
import type { ReactNode } from "react";
import type { CallAPIOptions, DefaultRequestObject, RequestArgumentsOf } from "./types.js";

export type NextTypedRoute<Req = DefaultRequestObject, Res = void> = (
  req:Omit<NextRequest, 'json'|'nextUrl'>&{
    'json': () => Promise<Req extends { 'body': infer R } ? R : never>,
    'nextUrl': Omit<NextURL, 'searchParams'>&{
      'searchParams': Req extends { 'query': infer R extends string } ? TypedURLSearchParams<R> : never
    }
  },
  params:Record<string, string|string[]>
) => NextResponse<Res>|Promise<NextResponse<Res>>;
export type NextTypedPage<Page extends keyof NextPageTable, P extends { 'query'?: string } = {}> = (props:P&NextPageTable[Page]) => ReactNode;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NextEndpointTable{}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NextPageTable{}
export type Endpoint<Req, Res> = { 'req': Req, 'res': Res };
export interface TypedURLSearchParams<T extends string>{
  get(name:Exclude<T, `${string}[]`|`${string}?`>):string;
  get(name:T extends `${infer R}?` ? R : never):string|null;
  getAll(name:T extends `${infer R}[]` ? R : never):string[];
}

export default function callAPI<T extends keyof NextEndpointTable>(path:T, ...args:RequestArgumentsOf<T>):Promise<NextEndpointTable[T]['res']>{
  return callRawAPI(path, ...args).then(res => res.json());
}
export function callRawAPI<T extends keyof NextEndpointTable>(path:T, ...args:RequestArgumentsOf<T>):Promise<Response>{
  let method:string, url:string|URL;
  [ method, url ] = (path as string).split(' ');
  const requestObject = args[0] as Record<string, any>|undefined;
  const { host, ...fetchOptions } = requestObject?.['options'] as CallAPIOptions || {};
  const params = requestObject?.['params'] as Record<string, string|string[]|undefined>|undefined;
  const query = requestObject?.['query'] as Record<string, string[]>|undefined;

  if(params){
    for(const [ k, v ] of Object.entries(params)){
      switch(typeof v){
        case "string":
          url = url.replaceAll(`[${k}]`, v);
          break;
        case "undefined":
          url = url.replaceAll(`/[[...${k}]]`, "");
          break;
        default:
          url = url.replaceAll(`[...${k}]`, v.join('/'));
          break;
      }
    }
  }
  if(query){
    const searchParams = new URLSearchParams();
    for(const [ k, v ] of Object.entries(query)){
      if(typeof v === "string"){
        searchParams.append(k, v);
      }else for(const w of v){
        searchParams.append(k, w);
      }
    }
    url = `${url}?${searchParams.toString()}`;
  }
  if(host){
    url = new URL(url, host);
  }
  return fetch(url, {
    method,
    body: requestObject?.['body'],
    ...fetchOptions
  });
}