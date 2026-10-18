import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
 testDir:'./e2e/playwright/tests',timeout:150000,expect:{timeout:15000},workers:1,fullyParallel:false,
 reporter:[['list'],['html',{outputFolder:'output/playwright-report',open:'never'}],['json',{outputFile:'output/validation/e2e.json'}]],
 outputDir:'output/test-results',
 use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:3045',channel:'chrome',headless:true,viewport:{width:1600,height:1050},screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:process.env.BASE_URL?undefined:[
  {command:'uv run langgraph dev --port 2037 --no-browser',cwd:path.resolve('../backend-langgraph'),url:'http://127.0.0.1:2037/canvas/health',reuseExistingServer:false,timeout:60000},
  {command:'npm run dev',url:'http://127.0.0.1:3045',reuseExistingServer:false,timeout:60000},
 ],
});
