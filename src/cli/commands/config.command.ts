import chalk from "chalk";
import { FilesystemManager } from "../../infrastructure/filesystem.manager.js";
import { ConfigManager } from "../../infrastructure/config.manager.js";

export async function configShowCommand(): Promise<void> {
  const filesystemManager = new FilesystemManager();
  const configManager = new ConfigManager(filesystemManager);
  const config = await configManager.load();

  console.log(chalk.bold("Текущая конфигурация Tolmach:\n"));
  console.log(JSON.stringify(config, null, 2));
  console.log(chalk.gray(`\nФайл конфигурации: ${configManager.configPath}`));
}

export async function configSetCommand(key: string, value: string): Promise<void> {
  const filesystemManager = new FilesystemManager();
  const configManager = new ConfigManager(filesystemManager);
  await configManager.load();

  const parts = key.split(".");
  if (parts.length !== 2) {
    console.error(chalk.red('Ключ должен быть в формате "секция.параметр", например "llm.provider"'));
    process.exitCode = 1;
    return;
  }

  const [section, param] = parts as [string, string];
  const update: Record<string, unknown> = {};
  const sectionObj: Record<string, unknown> = {};

  let parsedValue: unknown = value;
  if (value === "true") parsedValue = true;
  else if (value === "false") parsedValue = false;
  else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
  else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

  sectionObj[param] = parsedValue;
  update[section] = sectionObj;

  await configManager.save(update);
  console.log(chalk.green(`✓ ${key} = ${String(parsedValue)}`));
}

export function configPathCommand(): void {
  const filesystemManager = new FilesystemManager();
  const configManager = new ConfigManager(filesystemManager);
  console.log(configManager.configPath);
}
