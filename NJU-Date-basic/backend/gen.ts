import fs from 'fs';
import { QUESTION_BANK } from './src/db/seed.ts';

const content = `// AUTO-GENERATED from backend/src/db/seed.ts\n\nexport const MOCK_QUESTION_SECTIONS = ${JSON.stringify(QUESTION_BANK, null, 2)};\n`;
fs.writeFileSync('../frontend/src/api/mockQuestions.ts', content, 'utf8');
console.log('Mock questions generated successfully!');
