import fs from 'fs'
import os from 'os'
import path from "path"

const directory = path.join(os.homedir(), '.npc')

// check if directory does not exist
if (!fs.existsSync(directory)) {
  fs.mkdirSync(directory, { recursive: true })
  console.log('~/.npc directory is created.')
}

function readJson(path: string): any {
  try {
    const json = fs.readFileSync(path)
    return JSON.parse(json.toString())
  } catch (e) {
    return undefined
  }
}

function writeJson(path: string, json: any) {
  fs.writeFileSync(path, JSON.stringify(json))
}

export const Disk = {
  directory,
  readJson,
  writeJson,
}