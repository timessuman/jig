import { Command } from 'commander';

const program = new Command();
program
  .name('jig')
  .description('A design system for coding agents.')
  .version('0.1.0');

program.parse();
