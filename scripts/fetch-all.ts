import { run as co2 } from './pipelines/co2.ts';
import { run as life_expectancy } from './pipelines/life_expectancy.ts';
import { run as u5_mortality } from './pipelines/u5_mortality.ts';

export async function runAll() {
  const pipelines = [
    { name: 'co2_ppm', run: co2 },
    { name: 'life_expectancy', run: life_expectancy },
    { name: 'u5_mortality', run: u5_mortality },
  ];
  for (const p of pipelines) {
    console.log(`start ${p.name}`);
    const data = await p.run();
    console.log(`done ${p.name} (${data.length})`);
  }
}

if ((import.meta as any).main) {
  runAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
