import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Suppress pino noisy logs during eval run unless DEBUG=true
if (!process.env.DEBUG) {
  process.env.LOG_LEVEL = 'warn';
}

const { detectSpam } = await import('../src/services/spam.service.js');

async function runEvaluation() {
  const datasetPath = path.resolve(__dirname, 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  console.log(`\n===============================================================`);
  console.log(` Starting PhoneMail Spam Classification Benchmark`);
  console.log(` Dataset: ${dataset.length} samples (${dataset.filter(d => d.expected === 'spam').length} spam, ${dataset.filter(d => d.expected === 'ham').length} ham)`);
  console.log(` Model: ${process.env.GROQ_MODEL || 'llama-3.1-8b-instant'}`);
  console.log(`===============================================================\n`);

  let tp = 0; // True Positive: Spam correctly classified as Spam
  let fp = 0; // False Positive: Ham wrongly classified as Spam
  let tn = 0; // True Negative: Ham correctly classified as Ham
  let fn = 0; // False Negative: Spam wrongly classified as Ham

  const wrongPredictions = [];
  const results = [];

  const startTime = Date.now();

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const isExpectedSpam = item.expected === 'spam';

    try {
      const classification = await detectSpam({
        subject: item.subject,
        text: item.text,
        fromEmail: item.fromEmail,
      });

      const predictedSpam = Boolean(classification.isSpam);
      const isCorrect = predictedSpam === isExpectedSpam;

      if (predictedSpam && isExpectedSpam) tp++;
      else if (predictedSpam && !isExpectedSpam) fp++;
      else if (!predictedSpam && !isExpectedSpam) tn++;
      else if (!predictedSpam && isExpectedSpam) fn++;

      results.push({
        id: item.id,
        category: item.category,
        expected: item.expected,
        predicted: predictedSpam ? 'spam' : 'ham',
        correct: isCorrect,
        score: classification.spamScore,
        reason: classification.spamReason,
        source: classification.spamDetails?.source,
      });

      if (!isCorrect) {
        wrongPredictions.push({
          id: item.id,
          category: item.category,
          subject: item.subject,
          fromEmail: item.fromEmail,
          expected: item.expected,
          predicted: predictedSpam ? 'spam' : 'ham',
          score: classification.spamScore,
          reason: classification.spamReason,
          details: classification.spamDetails,
        });
      }

      process.stdout.write(isCorrect ? '.' : 'X');

      // Small throttle so Groq doesn't queue rapid sequential requests
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`\nError evaluating ${item.id}:`, err.message);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const total = tp + fp + tn + fn;
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log(`\n\n---------------------------------------------------------------`);
  console.log(` EVALUATION METRICS REPORT (Completed in ${duration}s)`);
  console.log(`---------------------------------------------------------------`);
  console.log(` Total Emails Evaluated : ${total}`);
  console.log(` Accuracy               : ${(accuracy * 100).toFixed(2)}% (${tp + tn}/${total})`);
  console.log(` Precision              : ${(precision * 100).toFixed(2)}% (${tp}/${tp + fp})`);
  console.log(` Recall                 : ${(recall * 100).toFixed(2)}% (${tp}/${tp + fn})`);
  console.log(` F1-Score               : ${(f1 * 100).toFixed(2)}%`);
  console.log(`---------------------------------------------------------------`);
  console.log(` True Positives  (TP)   : ${tp} (Spam correctly caught)`);
  console.log(` True Negatives  (TN)   : ${tn} (Ham delivered to Inbox)`);
  console.log(` False Positives (FP)   : ${fp} (HAM wrongly sent to Spam)`);
  console.log(` False Negatives (FN)   : ${fn} (SPAM leaked into Inbox)`);
  console.log(`---------------------------------------------------------------`);

  if (wrongPredictions.length > 0) {
    console.log(`\n MISCLASSIFIED EMAILS (${wrongPredictions.length} errors):\n`);
    wrongPredictions.forEach((w, idx) => {
      const typeLabel = w.expected === 'ham' ? 'FALSE POSITIVE (HAM -> SPAM)' : 'FALSE NEGATIVE (SPAM -> INBOX)';
      console.log(` [${idx + 1}] ID: ${w.id} (${w.category})`);
      console.log(`     Type     : ${typeLabel}`);
      console.log(`     From     : ${w.fromEmail}`);
      console.log(`     Subject  : ${w.subject}`);
      console.log(`     Score    : ${w.score}`);
      console.log(`     Reason   : ${w.reason || 'None'}`);
      console.log(`     Rules    : ${JSON.stringify(w.details?.rules || w.details?.heuristicRules || [])}`);
      console.log(``);
    });
  } else {
    console.log(`\n PERFECT SCORE: 100% classification accuracy! Zero misclassifications.\n`);
  }

  return { accuracy, precision, recall, f1, fp, fn, wrongCount: wrongPredictions.length };
}

runEvaluation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Evaluation run failed:', err);
    process.exit(1);
  });
