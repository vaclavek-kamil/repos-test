const simpleGit = require("simple-git");
const git = simpleGit();
const { execSync } = require("child_process");

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

const source = args.find((arg) => arg.startsWith("--source=")) || "main";
const production = args.find((arg) => arg.startsWith("--production"))
  ? true
  : false;

const sourceBranchName = source.split("=")[1];
const branches = production ? productionBranches : testBranches;

async function branchExists(branch) {
  const branches = await git.branch(["--list", branch]);
  return branches.all.includes(branch);
}

async function createBranch(branch, sourceBranch) {
  try {
    await git.checkoutBranch(branch, sourceBranch);
    console.log(`Created and checked out to new branch ${branch}`);
  } catch (err) {
    console.error(`Error creating branch ${branch}: ${err.message}`);
    process.exit(1);
  }
}

async function mergeBranches() {
  try {
    // Fetch all branches
    await git.fetch();

    for (const branch of branches) {
      // Check if the target branch exists
      const exists = await branchExists(branch);
      if (!exists) {
        // Create the target branch from the source branch if it doesn't exist
        await createBranch(branch, sourceBranchName);
      } else {
        // Checkout the target branch if it exists
        await git.checkout(branch);
        console.log(`Checked out to branch ${branch}`);
      }

      // Merge the source branch into the target branch
      try {
        // Use the "ours" strategy for specified paths
        await git.raw([
          "merge",
          "--strategy=ours",
          "--no-commit",
          sourceBranchName,
          "--",
          ...pathsToIgnore,
        ]);
        console.log(
          `Merged with "ours" strategy for templates directory and config.js file`
        );

        // Merge the rest of the changes normally
        await git.merge([sourceBranchName, "--no-ff"]);
        console.log(`Merged ${sourceBranchName} into ${branch}`);
      } catch (mergeError) {
        console.error(`Error during merge: ${mergeError.message}`);
        // Abort the merge in case of conflict or error
        await git.merge(["--abort"]);
        console.log(`Merge aborted for ${branch}`);
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
