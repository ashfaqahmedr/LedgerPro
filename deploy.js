import FtpDeploy from "ftp-deploy";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();

const ftpDeploy = new FtpDeploy();

const config = {
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  host: process.env.FTP_HOST,
  port: parseInt(process.env.FTP_PORT || "21"),
  localRoot: "./dist",
  remoteRoot: process.env.FTP_REMOTE_ROOT || "/public_html/accpro",
  include: ["*", "**/*"],
  deleteRemote: true,
  forcePasv: true,
  sftp: process.env.FTP_SECURE === "true",
  secure: true,
  secureOptions: {
    rejectUnauthorized: false
  }
};

if (!config.user || !config.password || !config.host) {
  console.error("ERROR: Missing FTP configuration in your local .env file!");
  console.error("Please configure the following variables in your .env file:");
  console.error("  FTP_HOST=\"ftp.hussainienterprises.com\"");
  console.error("  FTP_USER=\"your-ftp-username\"");
  console.error("  FTP_PASSWORD=\"your-ftp-password\"");
  console.error("  FTP_PORT=21");
  console.error("  FTP_REMOTE_ROOT=\"/public_html/accpro\"");
  console.error("  FTP_SECURE=false");
  process.exit(1);
}

// 1. Build the production application programmatically with the correct base path for web deployment
try {
  console.log("Building application for production with base path /accpro/...");
  execSync("npx vite build", {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_BASE_PATH: "/accpro/"
    }
  });
  console.log("Build compiled successfully!\n");
} catch (buildErr) {
  console.error("Build failed. Aborting deployment.");
  process.exit(1);
}

console.log(`Starting deployment of './dist' to ${config.host}:${config.remoteRoot}...`);

ftpDeploy
  .deploy(config)
  .then(() => {
    console.log("\n\nDeployment completed successfully!");
  })
  .catch((err) => {
    console.error("\n\nDeployment failed:", err);
  });

ftpDeploy.on("uploading", function (data) {
  const percent = Math.round((data.transferredFileCount / data.totalFilesCount) * 100);
  process.stdout.write(`\rUploading [${percent}%] (${data.transferredFileCount}/${data.totalFilesCount}): ${data.filename}`);
});
