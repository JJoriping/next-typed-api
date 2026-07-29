#!/usr/bin/env node
import { parseArgs } from "util";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { relative, resolve } from "path";
import { error, log, success } from "@daldalso/logger";
import { generateEndpointDefinition, generateEnvDefinition as generateEnvironmentDefinition, generatePageDefinition, initialize } from "./core.js";
import Watcher from "watcher";

const cwd = process.cwd();
const { values } = parseArgs({
  options: {
    path: {
      type: "string",
      short: "p"
    },
    watch: {
      type: "boolean",
      short: "w",
      default: false
    }
  }
});
const pageFilePattern = /(?:^|[/\\])(page|layout)\.(?:jsx?|tsx?)$/;
const routeFilePattern = /(?:^|[/\\])(route)\.(?:jsx?|tsx?)$/;
const keyIgnorancePattern = /^\(.+?\)$/;
const environmentFilePattern = /^\.env(\..+)?$/;

async function main():Promise<void>{
  log(values.watch ? "next-typed-route is running in watch mode..." : "next-typed-route is running...");
  const rootPath = values.path || getRootPath();
  const output = resolve(cwd, ".next-typed-route");
  const appPath = resolve(rootPath, "app");

  initialize(rootPath);
  mkdirSync(output, { recursive: true });
  copyFileSync(resolve(import.meta.dirname, "../res/next.d.ts"), resolve(output, "next.d.ts"));

  if(values.watch){
    const sourceWatcher = new Watcher(appPath, { recursive: true, renameDetection: true });
    const environmentWatcher = new Watcher(rootPath);

    sourceWatcher.on('add', path => runSource(path));
    sourceWatcher.on('addDir', path => runSource(path));
    sourceWatcher.on('change', path => runSource(path));
    sourceWatcher.on('rename', (before, after) => runSource(before, after));
    sourceWatcher.on('renameDir', (before, after) => runSource(before, after));
    sourceWatcher.on('unlink', path => runSource(path));
    sourceWatcher.on('unlinkDir', path => runSource(path));

    environmentWatcher.on('change', () => runEnvironment());
    environmentWatcher.on('unlink', () => runEnvironment());
  }else{
    const updated = runSource(appPath);
    runEnvironment();
    success(`next-typed-route has updated ${updated} files.`);
  }

  function runSource(...paths:string[]):number{
    let updated = 0;

    for(const v of paths){
      const relativePath = relative(appPath, v);
      const fileName = getFileName(relativePath) + ".d.ts";
      if(!existsSync(v)){
        if(existsSync(resolve(output, fileName))){
          unlinkSync(resolve(output, fileName));
        }
        continue;
      }
      if(statSync(v).isDirectory()){
        updated += runSource(...readdirSync(v).map(w => resolve(v, w)));
        continue;
      }
      let R:string|undefined;
      const pageFileChunk = relativePath.match(pageFilePattern);

      if(pageFileChunk){
        if(pageFileChunk[1] === "layout" && paths.some(w => {
          const otherFileChunk = relative(appPath, w).match(pageFilePattern);
          if(otherFileChunk?.[1] !== "page") return false;
          return pageFileChunk[0] === otherFileChunk[0].replace("page.", "layout.");
        })) continue;
        R = generatePageDefinition(getKey(relativePath), v);
      }else if(routeFilePattern.test(relativePath)){
        R = generateEndpointDefinition(getKey(relativePath), v);
      }
      if(!R) continue;
      writeFileSync(resolve(output, fileName), R);
      updated++;
    }
    return updated;
  }
  function runEnvironment():void{
    for(const v of readdirSync(rootPath)){
      if(!environmentFilePattern.test(v)) continue;
      const fileName = getFileName(v) + ".d.ts";
      const R = generateEnvironmentDefinition(getKey(v), resolve(rootPath, v));

      writeFileSync(resolve(output, fileName), R);
    }
  }
}
function getRootPath():string{
  if(!existsSync(resolve(cwd, "next-env.d.ts"))){
    error("Unable to find next-env.d.ts. Please check the current working directory.");
    process.exit(1);
  }
  if(!existsSync(resolve(cwd, "app"))){
    error("Unable to find app directory. Currently only App Router is supported.");
    process.exit(1);
  }
  return cwd;
}
function getKey(value:string):string{
  const chunk = value.split(/[/\\]/);
  const R:string[] = [];

  chunk.pop();
  for(const v of chunk){
    if(keyIgnorancePattern.test(v)){
      continue;
    }
    R.push(v);
  }
  return R.join('/');
}
function getFileName(value:string):string{
  return value.replace(/[./\\]/g, "_");
}

main();