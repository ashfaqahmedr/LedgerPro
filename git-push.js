import { execSync } from "child_process";

// Get the commit message from the terminal arguments (default to "chore: update codebase" if empty)
const message = process.argv.slice(2).join(" ").trim() || "chore: update codebase";

try {
  console.log("1. Staging all changes...");
  execSync("git add .", { stdio: "inherit" });

  console.log(`\n2. Committing changes with message: "${message}"...`);
  try {
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });
  } catch (commitErr) {
    console.log("-> No changes detected to commit.");
  }

  console.log("\n3. Pushing to GitHub main branch...");
  execSync("git push origin main", { stdio: "inherit" });
  
  console.log("\nDone! Codebase successfully pushed to GitHub.");
} catch (err) {
  console.error("\nGit push failed:", err.message);
  process.exit(1);
}
