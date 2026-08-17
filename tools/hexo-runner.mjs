import Hexo from 'hexo';

const command = process.argv[2];

if (!command) {
  console.error('Usage: node tools/hexo-runner.mjs <command>');
  process.exit(1);
}

const aliases = {
  build: 'generate',
  g: 'generate',
  s: 'server',
  d: 'deploy'
};

const resolvedCommand = aliases[command] ?? command;
const commandArgs = { _: process.argv.slice(3) };
const hexo = new Hexo(process.cwd(), { _: [resolvedCommand] });
hexo.env.init = true;

try {
  await hexo.init();
  await hexo.call(resolvedCommand, commandArgs);
  await hexo.exit();
} catch (error) {
  console.error(error);
  await hexo.exit(error);
  process.exit(1);
}
