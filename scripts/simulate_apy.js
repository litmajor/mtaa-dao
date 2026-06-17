// simulate_apy.js
// Simple node script to print APY curves for different scaleDivisor values.

function calcAPY(baseBp, scaleDivisor, tvlFraction) {
  const tvlBp = Math.floor(tvlFraction * 10000);
  const reduction = Math.floor((tvlBp * tvlBp) / scaleDivisor);
  let apy = Math.max(300, Math.min(1800, baseBp - reduction));
  return apy;
}

function printCurve(divisors) {
  for (const d of divisors) {
    console.log('\nscaleDivisor =', d);
    let row = 'TVL%  ';
    for (let p = 0; p <= 50; p += 5) row += p.toString().padStart(6);
    console.log(row);
    for (let f = 0; f <= 50; f += 5) {
      // single-line per TVL% (0..50)
    }
    let line = '';
    for (let p = 0; p <= 50; p += 5) {
      const frac = p / 100;
      const apy = calcAPY(1800, d, frac);
      line += apy.toString().padStart(6);
    }
    console.log(line);
  }
}

const divisors = [1000, 2500, 5000, 10000];
const tvlSteps = [0, 500, 1000, 1500, 2000, 2500, 3000]; // 0% to 30%
printCurve(divisors);

console.log('\nUsage: node scripts/simulate_apy.js');
