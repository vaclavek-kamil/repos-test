const simpleGit = require("simple-git");
const git = simpleGit();
const fs = require("fs");

const defaultSource = "main";
const productionBranches = ["p1", "p2"];
const testBranches = ["t1", "t2"];
const pathsToIgnore = [
  "build.js",
  "config.json",
  "node_modules",
  ".gitignore",
  "package.json",
  "package_lock.json",
];

const args = process.argv.slice(2);

const source =
  args.find((arg) => arg.startsWith("--source="))?.split("=")[1] ||
  defaultSource;
const production = args.find((arg) => arg.startsWith("--production"))
  ? true
  : false;

const branches = production ? productionBranches : testBranches;

async function branchExists(branch) {
  const branchSummary = await git.branch();
  return branchSummary.all.includes(branch);
}

async function mergeBranches() {
  try {
    // Fetch all branches
    await git.fetch();

    for (const branch of branches) {
      // Check if the branch exists, create it if it doesn't
      const exists = await branchExists(branch);
      if (!exists) {
        await git.checkoutLocalBranch(branch);
        console.log(`Created and checked out to new branch ${branch}`);
      } else {
        await git.checkout(branch);
        console.log(`Checked out to branch ${branch}`);
      }

      // Backup files to be ignored before merge
      const backups = {};
      for (const path of pathsToIgnore) {
        if (fs.existsSync(path)) {
          backups[path] = fs.readFileSync(path);
        }
      }

      // Merge the source branch into the target branch
      try {
        await git.merge([source, "--no-ff"]);
        console.log(`Merged ${source} into ${branch}`);

        // Restore ignored files from backups
        for (const path in backups) {
          fs.writeFileSync(path, backups[path]);
          console.log(`Restored ${path} from backup`);
        }

        // Commit restored files
        await git.add(pathsToIgnore);
        await git.commit(
          `Restored ignored files after merging ${source} into ${branch}`
        );
      } catch (mergeError) {
        console.error(`Error during merge: ${mergeError.message}`);
        // Abort the merge in case of conflict or error
        await git.merge(["--abort"]);
        console.log(`Merge aborted for ${branch}`);

        // Restore backups after aborted merge
        for (const path in backups) {
          fs.writeFileSync(path, backups[path]);
          console.log(`Restored ${path} from backup after aborted merge`);
        }
      }

      // Push the changes to the remote repository
      await git.push("origin", branch);
      console.log(`Pushed ${branch} to remote repository`);
    }

    console.log("Merge completed successfully.");
  } catch (err) {
    console.error(`Error during merge: ${err.message}`);
  }
}

mergeBranches();
