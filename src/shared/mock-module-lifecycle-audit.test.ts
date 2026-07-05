import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

function __repoRootFrom(start: string): string {
  let dir = start
  for (;;) {
    if (existsSync(path.join(dir, "bun.lock")) || existsSync(path.join(dir, ".git"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error("repo root sentinel not found")
    dir = parent
  }
}

const SOURCE_ROOT = path.resolve(import.meta.dir, "..")
const WORKSPACE_ROOT = __repoRootFrom(import.meta.dir)

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (/zauc-mocks/.test(entry.name)) return []
      return listSourceFiles(entryPath)
    }
    if (
      entry.isFile()
      && entry.name.endsWith(".ts")
      && !entry.name.endsWith(".test.ts")
      && !entry.name.endsWith(".d.ts")
    ) {
      return [entryPath]
    }
    return []
  }))

  return nestedFiles.flat()
}

async function listTestFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (/zauc-mocks/.test(entry.name)) return []
      return listTestFiles(entryPath)
    }
    if (
      entry.isFile()
      && entry.name.endsWith(".test.ts")
    ) {
      return [entryPath]
    }
    return []
  }))

  return nestedFiles.flat()
}

function relativeSourcePath(filePath: string): string {
  return path.relative(WORKSPACE_ROOT, filePath)
}

function fileHasMockModule(sourceFile: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
    ) {
      const obj = node.expression.expression
      const prop = node.expression.name
      if (obj.name.text === "mock" && prop.text === "module") {
        found = true
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function fileHasMockRestore(sourceFile: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
    ) {
      const prop = node.expression.name
      if (prop.text === "restore") {
        let obj: ts.Expression = node.expression.expression
        if (ts.isPropertyAccessExpression(obj)) {
          if (obj.name.text === "module" && ts.isPropertyAccessExpression(obj.expression)) {
            if (obj.expression.name.text === "mock") {
              found = true
              return
            }
          }
          if (obj.name.text === "mock") {
            found = true
            return
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function fileHasMockRestoreInSnippet(contents: string): boolean {
  return /mock\.(?:module\.)?restore\s*\(/.test(contents)
}

describe("mock.module lifecycle audit", () => {
  test("#given production TypeScript sources #when mock.module() is used #then a corresponding restore() must exist in the same file", async () => {
    const files = [...await listSourceFiles(SOURCE_ROOT), ...await listTestFiles(SOURCE_ROOT)]
    const offenders: string[] = []

    for (const filePath of files) {
      const contents = await readFile(filePath, "utf8")
      if (!contents.includes("mock.module(")) continue

      const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

      if (fileHasMockModule(sourceFile) && !fileHasMockRestore(sourceFile) && !fileHasMockRestoreInSnippet(contents)) {
        offenders.push(relativeSourcePath(filePath))
      }
    }

    expect(offenders).toEqual([])
  })
})
