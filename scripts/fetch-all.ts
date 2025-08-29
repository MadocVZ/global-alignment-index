import { run as co2 } from './pipelines/co2.ts';
import { run as life_expectancy } from './pipelines/life_expectancy.ts';
import { run as extreme_poverty } from './pipelines/extreme_poverty.ts';

export async function runAll() {
  const pipelines = [
    { name: 'co2_ppm', run: co2 },
    { name: 'life_expectancy', run: life_expectancy },
    { name: 'extreme_poverty', run: extreme_poverty },
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
