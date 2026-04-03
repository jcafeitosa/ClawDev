import { Command } from "commander";
import { onboard } from "./commands/onboard.js";
import { doctor } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { configure } from "./commands/configure.js";
import { addAllowedHostname } from "./commands/allowed-hostname.js";
import { heartbeatRun } from "./commands/heartbeat-run.js";
import { runCommand } from "./commands/run.js";
import { bootstrapCeoInvite } from "./commands/auth-bootstrap-ceo.js";
import { dbBackupCommand } from "./commands/db-backup.js";
import { planCommand } from "./commands/plan.js";
import { sddCommand } from "./commands/sdd.js";
import { sddInitCommand } from "./commands/sdd.js";
import { specCommand } from "./commands/spec.js";
import { adrCommand } from "./commands/adr.js";
import { registerContextCommands } from "./commands/client/context.js";
import { registerCompanyCommands } from "./commands/client/company.js";
import { registerIssueCommands } from "./commands/client/issue.js";
import { registerAgentCommands } from "./commands/client/agent.js";
import { registerApprovalCommands } from "./commands/client/approval.js";
import { registerActivityCommands } from "./commands/client/activity.js";
import { registerDashboardCommands } from "./commands/client/dashboard.js";
import { applyDataDirOverride, type DataDirOptionLike } from "./config/data-dir.js";
import { loadClawDevEnvFile } from "./config/env.js";
import { registerWorktreeCommands } from "./commands/worktree.js";
import { registerPluginCommands } from "./commands/client/plugin.js";
import { registerClientAuthCommands } from "./commands/client/auth.js";

const program = new Command();
const DATA_DIR_OPTION_HELP =
  "ClawDev data directory root (isolates state from ~/.clawdev)";

program
  .name("clawdev")
  .description("ClawDev CLI — setup, diagnose, and configure your instance")
  .version("0.2.7");

program.hook("preAction", (_thisCommand, actionCommand) => {
  const options = actionCommand.optsWithGlobals() as DataDirOptionLike;
  const optionNames = new Set(actionCommand.options.map((option) => option.attributeName()));
  applyDataDirOverride(options, {
    hasConfigOption: optionNames.has("config"),
    hasContextOption: optionNames.has("context"),
  });
  loadClawDevEnvFile(options.config);
});

program
  .command("onboard")
  .description("Interactive first-run setup wizard")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-y, --yes", "Accept defaults (quickstart + start immediately)", false)
  .option("--run", "Start ClawDev immediately after saving config", false)
  .action(onboard);

program
  .command("doctor")
  .description("Run diagnostic checks on your ClawDev setup")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--repair", "Attempt to repair issues automatically")
  .alias("--fix")
  .option("-y, --yes", "Skip repair confirmation prompts")
  .action(async (opts) => {
    await doctor(opts);
  });

program
  .command("env")
  .description("Print environment variables for deployment")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(envCommand);

program
  .command("configure")
  .description("Update configuration sections")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-s, --section <section>", "Section to configure (llm, database, logging, server, storage, secrets)")
  .action(configure);

program
  .command("db:backup")
  .description("Create a one-off database backup using current config")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--dir <path>", "Backup output directory (overrides config)")
  .option("--retention-days <days>", "Retention window used for pruning", (value) => Number(value))
  .option("--filename-prefix <prefix>", "Backup filename prefix", "clawdev")
  .option("--json", "Print backup metadata as JSON")
  .action(async (opts) => {
    await dbBackupCommand(opts);
  });

const plan = program.command("plan").description("Spec-driven development helpers");

plan
  .command("new")
  .description("Scaffold a dated SDD plan in internal-docs/plans")
  .argument("<slug>", "Plan slug used in the filename")
  .option("-t, --title <title>", "Display title used in the document heading")
  .option("--dir <path>", "Output directory for the plan file", "internal-docs/plans")
  .option("--force", "Overwrite an existing file", false)
  .action(async (slug, opts) => {
    await planCommand({ slug, title: opts.title, dir: opts.dir, force: opts.force });
  });

const sdd = program.command("sdd").description("Full spec-driven development scaffolding");

sdd
  .command("init")
  .description("Interactively scaffold a full SDD bundle")
  .option("-t, --title <title>", "Display title used across the generated documents")
  .option("-s, --slug <slug>", "Bundle slug used in the directory name")
  .option("--dir <path>", "Output directory for the bundle", "internal-docs/plans")
  .option("--force", "Overwrite existing files", false)
  .option("-y, --yes", "Skip the final confirmation prompt", false)
  .action(async (opts) => {
    await sddInitCommand({ title: opts.title, slug: opts.slug, dir: opts.dir, force: opts.force, yes: opts.yes });
  });

sdd
  .command("new")
  .description("Scaffold a dated SDD bundle in internal-docs/plans")
  .argument("<slug>", "Bundle slug used in the directory name")
  .option("-t, --title <title>", "Display title used across the generated documents")
  .option("--dir <path>", "Output directory for the bundle", "internal-docs/plans")
  .option("--force", "Overwrite existing files", false)
  .action(async (slug, opts) => {
    await sddCommand({ slug, title: opts.title, dir: opts.dir, force: opts.force });
  });

const spec = program.command("spec").description("Spec document helpers");

spec
  .command("new")
  .description("Scaffold a dated spec in internal-docs/spec")
  .argument("<slug>", "Spec slug used in the filename")
  .option("-t, --title <title>", "Display title used in the document heading")
  .option("--dir <path>", "Output directory for the spec file", "internal-docs/spec")
  .option("--force", "Overwrite an existing file", false)
  .action(async (slug, opts) => {
    await specCommand({ slug, title: opts.title, dir: opts.dir, force: opts.force });
  });

const adr = program.command("adr").description("Architecture decision record helpers");

adr
  .command("new")
  .description("Scaffold a dated ADR in internal-docs/plans")
  .argument("<slug>", "ADR slug used in the filename")
  .option("-t, --title <title>", "Display title used in the document heading")
  .option("--dir <path>", "Output directory for the ADR file", "internal-docs/plans")
  .option("--force", "Overwrite an existing file", false)
  .action(async (slug, opts) => {
    await adrCommand({ slug, title: opts.title, dir: opts.dir, force: opts.force });
  });

program
  .command("allowed-hostname")
  .description("Allow a hostname for authenticated/private mode access")
  .argument("<host>", "Hostname to allow (for example dotta-macbook-pro)")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .action(addAllowedHostname);

program
  .command("run")
  .description("Bootstrap local setup (onboard + doctor) and run ClawDev")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("-i, --instance <id>", "Local instance id (default: default)")
  .option("--repair", "Attempt automatic repairs during doctor", true)
  .option("--no-repair", "Disable automatic repairs during doctor")
  .action(runCommand);

const heartbeat = program.command("heartbeat").description("Heartbeat utilities");

heartbeat
  .command("run")
  .description("Run one agent heartbeat and stream live logs")
  .requiredOption("-a, --agent-id <agentId>", "Agent ID to invoke")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--context <path>", "Path to CLI context file")
  .option("--profile <name>", "CLI context profile name")
  .option("--api-base <url>", "Base URL for the ClawDev server API")
  .option("--api-key <token>", "Bearer token for agent-authenticated calls")
  .option(
    "--source <source>",
    "Invocation source (timer | assignment | on_demand | automation)",
    "on_demand",
  )
  .option("--trigger <trigger>", "Trigger detail (manual | ping | callback | system)", "manual")
  .option("--timeout-ms <ms>", "Max time to wait before giving up", "0")
  .option("--json", "Output raw JSON where applicable")
  .option("--debug", "Show raw adapter stdout/stderr JSON chunks")
  .action(heartbeatRun);

registerContextCommands(program);
registerCompanyCommands(program);
registerIssueCommands(program);
registerAgentCommands(program);
registerApprovalCommands(program);
registerActivityCommands(program);
registerDashboardCommands(program);
registerWorktreeCommands(program);
registerPluginCommands(program);

const auth = program.command("auth").description("Authentication and bootstrap utilities");

auth
  .command("bootstrap-ceo")
  .description("Create a one-time bootstrap invite URL for first instance admin")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --data-dir <path>", DATA_DIR_OPTION_HELP)
  .option("--force", "Create new invite even if admin already exists", false)
  .option("--expires-hours <hours>", "Invite expiration window in hours", (value) => Number(value))
  .option("--base-url <url>", "Public base URL used to print invite link")
  .action(bootstrapCeoInvite);

registerClientAuthCommands(auth);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
