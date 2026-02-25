import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const icons = [
  {
    input: "assets/icons/Back.svg",
    output: "src/icons/BackIcon.tsx"
  },
  {
    input: "assets/icons/select-books.svg",
    output: "src/icons/SelectCapturesIcon.tsx"
  },
  {
    input: "assets/icons/Property 1=no captures.svg",
    output: "src/icons/SelectNoCapturesIcon.tsx"
  },
  {
    input: "assets/icons/accept-book.svg",
    output: "src/icons/AcceptBookIcon.tsx"
  },
  {
    input: "assets/icons/reject-book.svg",
    output: "src/icons/DeclineBookIcon.tsx"
  },
  {
    input: "assets/icons/orientation=portrait.svg",
    output: "src/icons/RotatePortraitIcon.tsx"
  },
  {
    input: "assets/icons/orientation=landscape.svg",
    output: "src/icons/RotateLandscapeIcon.tsx"
  },
  {
    input: "assets/icons/orientation=no hint.svg",
    output: "src/icons/OrientationNoHintIcon.tsx"
  },
  {
    input: "assets/icons/zoom=in.svg",
    output: "src/icons/ZoomInHintIcon.tsx"
  },
  {
    input: "assets/icons/zoom=out.svg",
    output: "src/icons/ZoomOutHintIcon.tsx"
  },
  {
    input: "assets/icons/Read.svg",
    output: "src/icons/ReadIcon.tsx"
  },
  {
    input: "assets/icons/Shelves.svg",
    output: "src/icons/ShelvesIcon.tsx"
  },
  {
    input: "assets/icons/Friends.svg",
    output: "src/icons/FriendsIcon.tsx"
  }
];

const localSvgr = path.join(root, "node_modules", ".bin", "svgr");
const useLocalSvgr = existsSync(localSvgr);
const command = useLocalSvgr ? localSvgr : "npx";
const baseArgs = useLocalSvgr ? [] : ["--yes", "@svgr/cli"];

icons.forEach((icon) => {
  const absoluteInput = path.join(root, icon.input);
  const absoluteOutput = path.join(root, icon.output);
  const outputDir = path.dirname(absoluteOutput);
  const componentName = path.basename(icon.output, ".tsx");
  mkdirSync(outputDir, { recursive: true });

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "svgr-icons-"));
  const tempInputDir = path.join(tempRoot, "input");
  const tempOutputDir = path.join(tempRoot, "output");
  mkdirSync(tempInputDir, { recursive: true });
  mkdirSync(tempOutputDir, { recursive: true });

  const tempInputFile = path.join(tempInputDir, `${componentName}.svg`);
  const tempOutputFile = path.join(tempOutputDir, `${componentName}.tsx`);
  copyFileSync(absoluteInput, tempInputFile);

  const args = [
    ...baseArgs,
    "--native",
    "--typescript",
    "--out-dir",
    tempOutputDir,
    tempInputFile
  ];

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }

  if (!existsSync(tempOutputFile)) {
    rmSync(tempRoot, { recursive: true, force: true });
    console.error(`SVGR did not generate expected file: ${tempOutputFile}`);
    process.exit(1);
  }

  const generated = readFileSync(tempOutputFile, "utf8")
    .replace(/\s+xmlns="[^"]*"/g, "")
    .replace(/\s+xmlnsXlink="[^"]*"/g, "");
  writeFileSync(absoluteOutput, generated, "utf8");
  rmSync(tempRoot, { recursive: true, force: true });
});

console.log(`Built ${icons.length} icons into src/icons.`);
