import process from "node:process";
import { createGitHubReleaseClient } from "./github-release-client.mjs";

const client = createGitHubReleaseClient({
  token: process.env.GITHUB_TOKEN,
  repository: process.env.GITHUB_REPOSITORY,
});

const repository = await client.validateRepository();
console.log("GitHub access verified.");
console.log(`Repository:     ${repository.fullName}`);
console.log(`Private:        ${repository.private ? "yes" : "no"}`);
console.log(`Default branch: ${repository.defaultBranch}`);
console.log("Write access:   yes");
console.log("No GitHub resource was changed.");
